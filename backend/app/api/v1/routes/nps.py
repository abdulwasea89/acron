"""Net Promoter survey API routes (#37).

Members answer their own day-7/30/90 NPS surveys and read their history.
Owners/managers (``VIEW_RETENTION``) get the NPS dashboard: score, response
rate, per-milestone stats, the response list, and the complaint clusters.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.deps import get_session, get_tenant, require_capability
from app.core.constants import NpsMilestone
from app.core.permissions import Capability
from app.core.tenancy import TenantContext
from app.models.membership import OrganizationMember
from app.schemas.nps import (
    NpsClusterOut,
    NpsMemberPayloadOut,
    NpsRespondIn,
    NpsResponseAdminOut,
    NpsSummaryOut,
)
from app.services import nps_service as nps

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
@router.get("/me", response_model=NpsMemberPayloadOut)
async def my_surveys(
    ctx: TenantContext = Depends(get_tenant),
    session: AsyncSession = Depends(get_session),
):
    """The current user's NPS surveys, open ones first."""

    member = await _member_row(session, ctx)
    return NpsMemberPayloadOut(
        **await nps.member_payload(session, org_id=ctx.org_id, member_id=member.id)
    )


@router.post("/me/{survey_id}/respond", response_model=NpsMemberPayloadOut)
async def respond(
    survey_id: str,
    data: NpsRespondIn,
    ctx: TenantContext = Depends(get_tenant),
    session: AsyncSession = Depends(get_session),
):
    """Submit a score (0-10) and optional comment for one of my surveys."""

    member = await _member_row(session, ctx)
    await nps.submit_response(
        session,
        org_id=ctx.org_id,
        member_id=member.id,
        survey_id=survey_id,
        score=data.score,
        comment=data.comment,
        actor_user_id=ctx.user_id,
    )
    return NpsMemberPayloadOut(
        **await nps.member_payload(session, org_id=ctx.org_id, member_id=member.id)
    )


# --------------------------------------------------------------------- admin
@router.get("/summary", response_model=NpsSummaryOut)
async def summary(
    ctx: TenantContext = Depends(require_capability(Capability.VIEW_RETENTION)),
    session: AsyncSession = Depends(get_session),
):
    return NpsSummaryOut(**await nps.summary(session, org_id=ctx.org_id))


@router.get("/responses", response_model=list[NpsResponseAdminOut])
async def responses(
    milestone: NpsMilestone | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    ctx: TenantContext = Depends(require_capability(Capability.VIEW_RETENTION)),
    session: AsyncSession = Depends(get_session),
):
    rows = await nps.responses(session, org_id=ctx.org_id, limit=limit, milestone=milestone)
    return [NpsResponseAdminOut(**r) for r in rows]


@router.get("/clusters", response_model=list[NpsClusterOut])
async def clusters(
    ctx: TenantContext = Depends(require_capability(Capability.VIEW_RETENTION)),
    session: AsyncSession = Depends(get_session),
):
    rows = await nps.clusters(session, org_id=ctx.org_id)
    return [NpsClusterOut(**r) for r in rows]


@router.get("/members/{member_id}", response_model=NpsMemberPayloadOut)
async def member_surveys(
    member_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.VIEW_RETENTION)),
    session: AsyncSession = Depends(get_session),
):
    return NpsMemberPayloadOut(
        **await nps.member_surveys(session, org_id=ctx.org_id, member_id=member_id)
    )
