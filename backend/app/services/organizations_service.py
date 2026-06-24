"""Organization provisioning & settings service (Sections 3, 4, 7).

Owner registration completion: charges the first SaaS month via the Platform
Stripe account, then provisions the Organization (unique org code), the owner's
OrganizationMember row, and a first auth session. Also exposes the setup
checklist and enrollment/gym-status/Connect operations.
"""

from __future__ import annotations

from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.constants import (
    ConnectStatus,
    MemberStatus,
    Role,
    SaasStatus,
    SaasTier,
    TIER_MEMBER_CAP,
    TIER_PRICE_USD,
)
from app.core.security import now_utc
from app.integrations.email import send_email
from app.integrations.stripe_client import platform_stripe
from app.integrations.stripe_connect import connect_stripe
from app.models.membership import OrganizationMember
from app.models.organization import Organization
from app.models.user import User
from app.schemas.organizations import RegisterGymRequest, SetupChecklist
from app.services import auth_service
from app.services.audit_service import record_audit
from app.utils.org_code import generate_org_code


async def _unique_org_code(session: AsyncSession, name: str) -> str:
    for _ in range(10):
        code = generate_org_code(name)
        exists = (
            await session.execute(select(Organization).where(Organization.org_code == code))
        ).scalar_one_or_none()
        if exists is None:
            return code
    raise HTTPException(status_code=500, detail="Could not generate unique org code.")


async def register_gym(
    session: AsyncSession, data: RegisterGymRequest, *, ip: str | None = None
) -> tuple[Organization, str, str]:
    """Provision an org for a verified owner. Returns (org, access, refresh)."""

    user = (
        await session.execute(select(User).where(User.email == data.owner_email.lower()))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Owner account not found.")
    if not user.email_verified:
        raise HTTPException(status_code=403, detail="Verify your email before registering a gym.")

    # ---- SaaS first-month charge (Section 3.2.2) ----
    customer_id = await platform_stripe.create_customer(user.email, user.full_name)
    if data.tier is not SaasTier.ENTERPRISE:
        price = TIER_PRICE_USD[data.tier] or 0
        pi = await platform_stripe.charge_first_month(
            customer_id=customer_id,
            amount_cents=price * 100,
            currency="usd",
            idempotency_key=f"saas-first-{user.id}-{data.tier.value}",
        )
        if pi.status != "succeeded":
            raise HTTPException(status_code=402, detail="SaaS payment failed. Please retry.")
    subscription_id = await platform_stripe.create_subscription(
        customer_id=customer_id, tier=data.tier.value
    )

    # ---- Provision organization ----
    d = data.details
    org = Organization(
        name=d.name,
        org_code=await _unique_org_code(session, d.name),
        country=d.country,
        timezone=d.timezone,
        default_currency=d.default_currency,
        address=d.address,
        logo_url=d.logo_url,
        accent_color=d.accent_color,
        working_hours=d.working_hours,
        saas_tier=data.tier,
        saas_status=SaasStatus.ACTIVE,
        member_cap=TIER_MEMBER_CAP[data.tier],
        stripe_customer_id=customer_id,
        stripe_subscription_id=subscription_id,
        saas_current_period_end=now_utc() + timedelta(days=30),
        mfa_required=(data.tier is SaasTier.ENTERPRISE),
    )
    session.add(org)
    await session.flush()

    # ---- Owner membership ----
    owner_member = OrganizationMember(
        organization_id=org.id,
        user_id=user.id,
        role=Role.OWNER,
        member_status=MemberStatus.ACTIVE,
        joined_at=now_utc(),
        profile_complete=True,
    )
    session.add(owner_member)
    await session.flush()

    await record_audit(
        session, action="org.provisioned", actor_user_id=user.id,
        organization_id=org.id, entity_type="organization", entity_id=org.id,
        new_values={"tier": data.tier.value, "org_code": org.org_code}, ip_address=ip,
    )
    await send_email(
        user.email, "Welcome to your gym",
        f"Your gym '{org.name}' is live. Org code: {org.org_code}. Log in to finish setup.",
    )

    access, refresh = await auth_service.create_session(
        session, user=user, org_id=org.id, role=Role.OWNER, ip=ip
    )
    return org, access, refresh


def build_checklist(org: Organization) -> SetupChecklist:
    saas_active = org.saas_status in {SaasStatus.ACTIVE, SaasStatus.TRIALING}
    return SetupChecklist(
        saas_active=saas_active,
        stripe_connected=org.checklist_stripe_connected,
        plan_published=org.checklist_plan_published,
        enrollment_configured=org.checklist_enrollment_configured,
        staff_invited=org.checklist_staff_invited,
        office_configured=org.checklist_office_configured,
        # Member signup is blocked until a plan is published (Section 6 constraint).
        member_signup_unblocked=org.checklist_plan_published and saas_active,
    )


async def start_connect_onboarding(session: AsyncSession, org: Organization, owner_email: str):
    link = await connect_stripe.create_account_link(email=owner_email)
    org.stripe_connect_account_id = link.account_id
    org.stripe_connect_status = ConnectStatus.PENDING
    session.add(org)
    await record_audit(session, action="org.connect_start", organization_id=org.id,
                       entity_type="organization", entity_id=org.id)
    return link


async def mark_connect_active(session: AsyncSession, org: Organization) -> None:
    """Called by webhook (account.updated) or dev shortcut."""

    org.stripe_connect_status = ConnectStatus.ACTIVE
    org.checklist_stripe_connected = True
    session.add(org)
    await record_audit(session, action="org.connect_active", organization_id=org.id,
                       entity_type="organization", entity_id=org.id)


async def update_enrollment_mode(session: AsyncSession, org: Organization, mode) -> None:
    org.enrollment_mode = mode
    org.checklist_enrollment_configured = True
    session.add(org)


async def update_gym_status(session: AsyncSession, org: Organization, gym_status) -> None:
    org.gym_status = gym_status
    session.add(org)
