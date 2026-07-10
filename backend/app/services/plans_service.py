"""Membership plan builder & lifecycle (Section 6).

Plans are owner-defined. Key rules enforced here:
  * Drafts never appear in member signup (Section 6.1).
  * Publishing the first plan flips the org checklist flag that unblocks member
    signup (Section 6 critical constraint).
  * Editing price does NOT reprice existing members — that is preserved by
    snapshotting price onto Subscription at signup (see memberships_service).
  * Archive hides the plan everywhere and records a replacement plan for
    migrating existing members at next renewal (Section 6.7).
"""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.constants import PlanStatus, PlanVisibility
from app.models.organization import Organization
from app.models.plan import MembershipPlan
from app.schemas.plans import PlanCreate, PlanUpdate
from app.services.audit_service import record_audit


async def create_plan(
    session: AsyncSession, *, org: Organization, data: PlanCreate, actor_id: str
) -> MembershipPlan:
    plan = MembershipPlan(
        organization_id=org.id,
        name=data.name,
        public_description=data.public_description,
        internal_notes=data.internal_notes,
        price=data.price,
        currency=data.currency or org.default_currency,
        tax_mode=data.tax_mode,
        tax_rate=data.tax_rate,
        billing_type=data.billing_type,
        cycle_length=data.cycle_length,
        cycle_unit=data.cycle_unit,
        auto_renew=data.auto_renew,
        trial_days=data.trial_days,
        pack_size=data.pack_size,
        validity_days=data.validity_days,
        inclusions_json=data.inclusions_json,
        rules_json=data.rules_json,
        visibility=data.visibility,
        featured=data.featured,
        status=PlanStatus.DRAFT,
    )
    session.add(plan)
    await session.flush()
    await record_audit(session, action="plan.created", organization_id=org.id, actor_user_id=actor_id,
                       entity_type="plan", entity_id=plan.id, new_values={"name": plan.name})
    return plan


async def _get_owned_plan(session: AsyncSession, org_id: str, plan_id: str) -> MembershipPlan:
    plan = await session.get(MembershipPlan, plan_id)
    if plan is None or plan.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Plan not found.")
    return plan


async def update_plan(
    session: AsyncSession, *, org_id: str, plan_id: str, data: PlanUpdate, actor_id: str
) -> MembershipPlan:
    plan = await _get_owned_plan(session, org_id, plan_id)
    old_price = plan.price
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)
    session.add(plan)
    await record_audit(
        session, action="plan.updated", organization_id=org_id, actor_user_id=actor_id,
        entity_type="plan", entity_id=plan.id,
        old_values={"price": old_price}, new_values={"price": plan.price},
        metadata={"note": "existing members keep snapshot price"},
    )
    return plan


async def publish_plan(
    session: AsyncSession, *, org: Organization, plan_id: str, actor_id: str
) -> MembershipPlan:
    plan = await _get_owned_plan(session, org.id, plan_id)
    plan.status = PlanStatus.PUBLISHED
    session.add(plan)
    # Unblock member signup once at least one plan is published.
    if not org.checklist_plan_published:
        org.checklist_plan_published = True
        session.add(org)
    await record_audit(session, action="plan.published", organization_id=org.id, actor_user_id=actor_id,
                       entity_type="plan", entity_id=plan.id)
    from app.realtime import events

    await events.plan_changed(org.id, plan_id=plan.id, action="published")
    return plan


async def set_status(
    session: AsyncSession, *, org_id: str, plan_id: str, status: PlanStatus, actor_id: str
) -> MembershipPlan:
    plan = await _get_owned_plan(session, org_id, plan_id)
    plan.status = status
    session.add(plan)
    await record_audit(session, action=f"plan.{status.value}", organization_id=org_id,
                       actor_user_id=actor_id, entity_type="plan", entity_id=plan.id)
    return plan


async def archive_plan(
    session: AsyncSession, *, org_id: str, plan_id: str, replacement_plan_id: str | None, actor_id: str
) -> MembershipPlan:
    plan = await _get_owned_plan(session, org_id, plan_id)
    if replacement_plan_id:
        await _get_owned_plan(session, org_id, replacement_plan_id)  # validate ownership
        plan.replacement_plan_id = replacement_plan_id
    plan.status = PlanStatus.ARCHIVED
    session.add(plan)
    await record_audit(session, action="plan.archived", organization_id=org_id, actor_user_id=actor_id,
                       entity_type="plan", entity_id=plan.id,
                       metadata={"replacement_plan_id": replacement_plan_id})
    return plan


async def duplicate_plan(
    session: AsyncSession, *, org_id: str, plan_id: str, actor_id: str
) -> MembershipPlan:
    src = await _get_owned_plan(session, org_id, plan_id)
    copy = MembershipPlan(
        **{
            k: v for k, v in src.model_dump().items()
            if k not in {"id", "created_at", "updated_at", "status", "name", "replacement_plan_id"}
        },
        name=f"{src.name} (copy)",
        status=PlanStatus.DRAFT,
    )
    session.add(copy)
    await session.flush()
    await record_audit(session, action="plan.duplicated", organization_id=org_id, actor_user_id=actor_id,
                       entity_type="plan", entity_id=copy.id, metadata={"source": plan_id})
    return copy


async def list_plans(session: AsyncSession, *, org_id: str) -> list[MembershipPlan]:
    return list(
        (
            await session.execute(
                select(MembershipPlan).where(MembershipPlan.organization_id == org_id)
            )
        ).scalars()
    )


async def list_public_plans(session: AsyncSession, *, org_id: str) -> list[MembershipPlan]:
    """Plans a prospective member can see at signup (published + public)."""

    return list(
        (
            await session.execute(
                select(MembershipPlan).where(
                    MembershipPlan.organization_id == org_id,
                    MembershipPlan.status == PlanStatus.PUBLISHED,
                    MembershipPlan.visibility == PlanVisibility.PUBLIC,
                )
            )
        ).scalars()
    )
