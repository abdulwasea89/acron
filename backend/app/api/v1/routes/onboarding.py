"""Onboarding journey API routes (#32).

Members read their own 90-day journey and close their own milestones. Owners and
managers get the roster view, can close staff milestones on a member's behalf,
and can pause/resume a journey. Gated by ``MANAGE_MEMBERS`` (owner/manager).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.deps import get_session, get_tenant, require_capability
from app.core.permissions import Capability
from app.core.tenancy import TenantContext
from app.models.membership import OrganizationMember
from app.schemas.onboarding import (
    CompleteMilestoneIn,
    JourneyOut,
    JourneySummaryOut,
    SetJourneyStatusIn,
)
from app.services import onboarding_service as onboarding

router = APIRouter()


async def _member_row(session: AsyncSession, ctx: TenantContext) -> OrganizationMember:
    """The OrganizationMember row for the current user in this tenant."""

    member = (
        await session.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == ctx.org_id,
                OrganizationMember.user_id == ctx.user_id,
            )
        )
    ).scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="You are not a member of this gym.")
    return member


# ------------------------------------------------------------------ member self
@router.get("/me", response_model=JourneyOut)
async def my_journey(
    ctx: TenantContext = Depends(get_tenant),
    session: AsyncSession = Depends(get_session),
):
    """The current user's onboarding journey."""

    member = await _member_row(session, ctx)
    return JourneyOut(**await onboarding.member_journey_payload(
        session, org_id=ctx.org_id, member_id=member.id
    ))


@router.post("/me/milestones/complete", response_model=JourneyOut)
async def complete_my_milestone(
    data: CompleteMilestoneIn,
    ctx: TenantContext = Depends(get_tenant),
    session: AsyncSession = Depends(get_session),
):
    """Mark one of the current user's own milestones complete."""

    member = await _member_row(session, ctx)
    await onboarding.complete_milestone(
        session,
        org_id=ctx.org_id,
        member_id=member.id,
        code=data.code,
        actor_user_id=ctx.user_id,
        completed_by_member_id=member.id,
        notes=data.notes,
    )
    return JourneyOut(**await onboarding.member_journey_payload(
        session, org_id=ctx.org_id, member_id=member.id
    ))


# --------------------------------------------------------------------- admin
@router.get("/summary", response_model=JourneySummaryOut)
async def summary(
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_MEMBERS)),
    session: AsyncSession = Depends(get_session),
):
    return JourneySummaryOut(**await onboarding.journey_summary(session, org_id=ctx.org_id))


@router.get("/members", response_model=list[JourneyOut])
async def list_journeys(
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_MEMBERS)),
    session: AsyncSession = Depends(get_session),
):
    rows = await onboarding.list_journeys(session, org_id=ctx.org_id)
    return [JourneyOut(**r) for r in rows]


@router.get("/members/{member_id}", response_model=JourneyOut)
async def member_journey(
    member_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_MEMBERS)),
    session: AsyncSession = Depends(get_session),
):
    return JourneyOut(**await onboarding.member_journey_payload(
        session, org_id=ctx.org_id, member_id=member_id
    ))


@router.post("/members/{member_id}/milestones/complete", response_model=JourneyOut)
async def complete_member_milestone(
    member_id: str,
    data: CompleteMilestoneIn,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_MEMBERS)),
    session: AsyncSession = Depends(get_session),
):
    actor = await _member_row(session, ctx)
    await onboarding.complete_milestone(
        session,
        org_id=ctx.org_id,
        member_id=member_id,
        code=data.code,
        actor_user_id=ctx.user_id,
        completed_by_member_id=actor.id,
        notes=data.notes,
    )
    return JourneyOut(**await onboarding.member_journey_payload(
        session, org_id=ctx.org_id, member_id=member_id
    ))


@router.post("/members/{member_id}/status", response_model=JourneyOut)
async def set_status(
    member_id: str,
    data: SetJourneyStatusIn,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_MEMBERS)),
    session: AsyncSession = Depends(get_session),
):
    await onboarding.set_journey_status(
        session, org_id=ctx.org_id, member_id=member_id, pause=data.pause
    )
    return JourneyOut(**await onboarding.member_journey_payload(
        session, org_id=ctx.org_id, member_id=member_id
    ))
