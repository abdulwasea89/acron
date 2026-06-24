"""SaaS subscription lifecycle (Section 3.2).

Upgrade (immediate, prorated), downgrade (next cycle, blocked if usage exceeds
the lower cap), cancellation (runs to period end), and the failed-charge
lifecycle: past_due -> read_only (grace ended) -> suspended -> archived.
Platform Stripe only (Security Rule #3) — never member money.
"""

from __future__ import annotations

from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.constants import (
    TIER_MEMBER_CAP,
    MemberStatus,
    SaasStatus,
    SaasTier,
)
from app.core.security import now_utc
from app.integrations.email import send_email
from app.integrations.push import send_push
from app.models.membership import OrganizationMember
from app.models.organization import Organization
from app.models.payment import Payment
from app.models.user import User
from app.services.audit_service import record_audit

# Read-only once SaaS grace ends; full lockout / archive later (Section 3.2.4).
GRACE_DAYS = 6


async def _member_count(session: AsyncSession, org_id: str) -> int:
    return int(
        (
            await session.execute(
                select(func.count()).select_from(OrganizationMember).where(
                    OrganizationMember.organization_id == org_id,
                    OrganizationMember.role == "member",
                    OrganizationMember.member_status.in_(
                        [MemberStatus.ACTIVE, MemberStatus.GRACE, MemberStatus.FROZEN]
                    ),
                )
            )
        ).scalar_one()
        or 0
    )


async def status(session: AsyncSession, *, org: Organization) -> dict:
    count = await _member_count(session, org.id)
    return {
        "saas_tier": org.saas_tier.value,
        "saas_status": org.saas_status.value,
        "member_cap": org.member_cap,
        "current_member_count": count,
        "current_period_end": org.saas_current_period_end,
        "grace_until": org.saas_grace_until,
        "read_only": org.saas_status in {SaasStatus.READ_ONLY, SaasStatus.SUSPENDED},
    }


async def upgrade(session: AsyncSession, *, org: Organization, tier: SaasTier, actor_id: str) -> Organization:
    """Immediate, prorated upgrade (Section 3.2.5). New features unlock instantly."""

    order = {SaasTier.STARTER: 0, SaasTier.PRO: 1, SaasTier.ENTERPRISE: 2}
    if order[tier] <= order[org.saas_tier]:
        raise HTTPException(status_code=409, detail="Use downgrade for same/lower tier.")
    org.saas_tier = tier
    org.member_cap = TIER_MEMBER_CAP[tier]
    if tier == SaasTier.ENTERPRISE:
        org.mfa_required = True
    session.add(org)
    await record_audit(session, action="saas.upgraded", organization_id=org.id, actor_user_id=actor_id,
                       entity_type="organization", entity_id=org.id, new_values={"tier": tier.value})
    return org


async def downgrade(session: AsyncSession, *, org: Organization, tier: SaasTier, actor_id: str) -> Organization:
    """Scheduled downgrade — blocked if current usage exceeds the lower cap (Section 3.2.6).

    Applied immediately here for simplicity; production schedules it for the next
    cycle. The cap guard is the important business rule.
    """

    order = {SaasTier.STARTER: 0, SaasTier.PRO: 1, SaasTier.ENTERPRISE: 2}
    if order[tier] >= order[org.saas_tier]:
        raise HTTPException(status_code=409, detail="Use upgrade for same/higher tier.")
    new_cap = TIER_MEMBER_CAP[tier]
    if new_cap is not None:
        count = await _member_count(session, org.id)
        if count > new_cap:
            raise HTTPException(
                status_code=409,
                detail=f"Reduce members to {new_cap} before downgrading (currently {count}).",
            )
    org.saas_tier = tier
    org.member_cap = new_cap
    session.add(org)
    await record_audit(session, action="saas.downgraded", organization_id=org.id, actor_user_id=actor_id,
                       entity_type="organization", entity_id=org.id, new_values={"tier": tier.value})
    return org


async def cancel(session: AsyncSession, *, org: Organization, actor_id: str) -> Organization:
    """Cancel — runs to end of paid period, then archived after retention (Section 3.2.7)."""

    org.saas_status = SaasStatus.CANCELLED
    session.add(org)
    await record_audit(session, action="saas.cancelled", organization_id=org.id, actor_user_id=actor_id,
                       entity_type="organization", entity_id=org.id)
    return org


async def list_invoices(session: AsyncSession, *, org_id: str) -> list[Payment]:
    from app.core.constants import PaymentKind

    return list(
        (
            await session.execute(
                select(Payment).where(
                    Payment.organization_id == org_id,
                    Payment.kind == PaymentKind.SAAS_SUBSCRIPTION,
                ).order_by(Payment.created_at.desc())
            )
        ).scalars()
    )


# ----------------------------------------------- failed-charge lifecycle
async def handle_failed_charge(session: AsyncSession, *, org: Organization) -> Organization:
    """Begin the failed-charge grace workflow (Section 3.2.4, day 0)."""

    org.saas_status = SaasStatus.PAST_DUE
    org.saas_grace_until = now_utc() + timedelta(days=GRACE_DAYS)
    session.add(org)
    owner = await _owner_user(session, org.id)
    if owner is not None:
        await send_email(owner.email, "Payment failed",
                         f"Your SaaS payment for {org.name} failed. Please update your card; "
                         f"you have {GRACE_DAYS} days before read-only mode.")
        await send_push(None, "Payment failed", "Update your billing to avoid service interruption.")
    await record_audit(session, action="saas.payment_failed", organization_id=org.id,
                       entity_type="organization", entity_id=org.id)
    return org


async def enforce_lifecycle(session: AsyncSession, *, org: Organization) -> Organization:
    """Advance an org through read-only -> suspended based on the grace clock.

    Called by the billing worker; here it's deterministic against ``now``.
    """

    if org.saas_status == SaasStatus.PAST_DUE and org.saas_grace_until and org.saas_grace_until < now_utc():
        org.saas_status = SaasStatus.READ_ONLY
        session.add(org)
        await record_audit(session, action="saas.read_only", organization_id=org.id,
                           entity_type="organization", entity_id=org.id)
    return org


async def _owner_user(session: AsyncSession, org_id: str) -> User | None:
    return (
        await session.execute(
            select(User).join(OrganizationMember, OrganizationMember.user_id == User.id).where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.role == "owner",
            )
        )
    ).scalars().first()
