"""Organization API routes (Sections 3, 4, 7, 16)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_org, get_session, require_capability
from app.core.permissions import Capability
from app.core.tenancy import TenantContext
from app.models.organization import Organization
from app.schemas.common import Message
from app.schemas.organizations import (
    ConnectOnboardingOut,
    EnrollmentModeUpdate,
    GymStatusUpdate,
    OrgCodeRotateOut,
    OrganizationOut,
    RegisterGymRequest,
    RegisterGymResponse,
    SetupChecklist,
)
from app.services import organizations_service as orgs

router = APIRouter()


def _to_out(org: Organization) -> OrganizationOut:
    return OrganizationOut(
        id=org.id,
        name=org.name,
        org_code=org.org_code,
        saas_tier=org.saas_tier.value,
        saas_status=org.saas_status.value,
        enrollment_mode=org.enrollment_mode.value,
        gym_status=org.gym_status.value,
        member_cap=org.member_cap,
        stripe_connect_status=org.stripe_connect_status.value,
        accent_color=org.accent_color,
        logo_url=org.logo_url,
    )


@router.post("/register", response_model=RegisterGymResponse)
async def register_gym(
    data: RegisterGymRequest, request: Request, session: AsyncSession = Depends(get_session)
):
    """Step 2-4 — complete owner registration & provision the org."""

    org, access, refresh = await orgs.register_gym(session, data, ip=get_client_ip(request))
    return RegisterGymResponse(organization=_to_out(org), access_token=access, refresh_token=refresh)


@router.get("/me", response_model=OrganizationOut)
async def get_my_org(org: Organization = Depends(get_org)):
    return _to_out(org)


@router.get("/me/checklist", response_model=SetupChecklist)
async def get_checklist(org: Organization = Depends(get_org)):
    return orgs.build_checklist(org)


@router.post("/me/connect", response_model=ConnectOnboardingOut)
async def connect_stripe(
    request: Request,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_SETTINGS)),
    org: Organization = Depends(get_org),
    session: AsyncSession = Depends(get_session),
):
    from app.models.user import User

    user = await session.get(User, ctx.user_id)
    link = await orgs.start_connect_onboarding(session, org, user.email)
    return ConnectOnboardingOut(account_id=link.account_id, onboarding_url=link.onboarding_url)


@router.post("/me/connect/complete", response_model=Message)
async def connect_complete(
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_SETTINGS)),
    org: Organization = Depends(get_org),
    session: AsyncSession = Depends(get_session),
):
    """Dev shortcut to mark Connect active (production: Stripe webhook)."""

    await orgs.mark_connect_active(session, org)
    return Message(message="Stripe Connect active.")


@router.patch("/me/enrollment", response_model=Message)
async def set_enrollment(
    data: EnrollmentModeUpdate,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_SETTINGS)),
    org: Organization = Depends(get_org),
    session: AsyncSession = Depends(get_session),
):
    await orgs.update_enrollment_mode(session, org, data.enrollment_mode)
    return Message(message="Enrollment mode updated.")


@router.patch("/me/gym-status", response_model=Message)
async def set_gym_status(
    data: GymStatusUpdate,
    ctx: TenantContext = Depends(require_capability(Capability.TOGGLE_GYM_STATUS)),
    org: Organization = Depends(get_org),
    session: AsyncSession = Depends(get_session),
):
    await orgs.update_gym_status(session, org, data.gym_status)
    return Message(message="Gym status updated.")


@router.post("/me/rotate-code", response_model=OrgCodeRotateOut)
async def rotate_org_code(
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_SETTINGS)),
    org: Organization = Depends(get_org),
    session: AsyncSession = Depends(get_session),
):
    """Rotate the org code (web-only, owner). Revokes member sessions (Section 7.5)."""

    new_code = await orgs.rotate_org_code(session, org, actor_id=ctx.user_id)
    return OrgCodeRotateOut(org_code=new_code)
