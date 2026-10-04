"""Win-back API routes (#36)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_capability
from app.core.permissions import Capability
from app.core.tenancy import TenantContext
from app.schemas.winback import (
    CampaignIn,
    CampaignResult,
    LapsedMemberOut,
    WinBackSummaryOut,
)
from app.services import winback_service as winback

router = APIRouter()


@router.get("/lapsed", response_model=list[LapsedMemberOut])
async def lapsed(
    ctx: TenantContext = Depends(require_capability(Capability.VIEW_RETENTION)),
    session: AsyncSession = Depends(get_session),
):
    return [LapsedMemberOut(**r) for r in await winback.lapsed_members(session, org_id=ctx.org_id)]


@router.get("/summary", response_model=WinBackSummaryOut)
async def summary(
    ctx: TenantContext = Depends(require_capability(Capability.VIEW_RETENTION)),
    session: AsyncSession = Depends(get_session),
):
    return WinBackSummaryOut(**await winback.summary(session, org_id=ctx.org_id))


@router.post("/campaign", response_model=CampaignResult)
async def campaign(
    data: CampaignIn,
    ctx: TenantContext = Depends(require_capability(Capability.VIEW_RETENTION)),
    session: AsyncSession = Depends(get_session),
):
    result = await winback.run_campaign(
        session,
        org_id=ctx.org_id,
        actor_user_id=ctx.user_id,
        offer_text=data.offer_text,
        cooldown_days=data.cooldown_days,
        limit=data.limit,
    )
    return CampaignResult(**result)


@router.post("/members/{member_id}/recovered", response_model=dict)
async def mark_recovered(
    member_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.VIEW_RETENTION)),
    session: AsyncSession = Depends(get_session),
):
    return {"recovered": await winback.mark_recovered(session, org_id=ctx.org_id, member_id=member_id)}


@router.post("/members/{member_id}/lost", response_model=dict)
async def mark_lost(
    member_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.VIEW_RETENTION)),
    session: AsyncSession = Depends(get_session),
):
    return {"closed": await winback.close_attempt(
        session, org_id=ctx.org_id, member_id=member_id, actor_user_id=ctx.user_id)}
