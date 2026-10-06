"""Challenges, streaks, and leaderboards API routes (#38).

Members see their live challenges, visit streak, and the gym leaderboard.
Owners/managers (``VIEW_RETENTION``) create and manage the org's challenges
and drill into per-member progress.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.deps import get_session, get_tenant, require_capability
from app.core.permissions import Capability
from app.core.tenancy import TenantContext
from app.models.membership import OrganizationMember
from app.schemas.gamification import (
    ChallengeCountOut,
    ChallengeCreateIn,
    ChallengeDetailOut,
    ChallengeOut,
    ChallengeParticipantOut,
    ChallengeStatusIn,
    LeaderboardEntryOut,
    LeaderboardPeriod,
    MemberGamificationOut,
)
from app.services import gamification_service as gamification

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
@router.get("/me", response_model=MemberGamificationOut)
async def my_gamification(
    ctx: TenantContext = Depends(get_tenant),
    session: AsyncSession = Depends(get_session),
):
    """My streaks and the challenges relevant to me."""

    member = await _member_row(session, ctx)
    return MemberGamificationOut(
        **await gamification.member_self(session, org_id=ctx.org_id, member_id=member.id)
    )


@router.get("/leaderboard", response_model=list[LeaderboardEntryOut])
async def leaderboard(
    period: LeaderboardPeriod = Query(default="week"),
    limit: int = Query(default=20, ge=1, le=100),
    ctx: TenantContext = Depends(get_tenant),
    session: AsyncSession = Depends(get_session),
):
    """Top members by check-ins in a period. Visible to any member."""

    rows = await gamification.leaderboard(session, org_id=ctx.org_id, period=period, limit=limit)
    return [LeaderboardEntryOut(**r) for r in rows]


# --------------------------------------------------------------------- admin
@router.post("", response_model=ChallengeOut, status_code=201)
async def create_challenge(
    data: ChallengeCreateIn,
    ctx: TenantContext = Depends(require_capability(Capability.VIEW_RETENTION)),
    session: AsyncSession = Depends(get_session),
):
    challenge = await gamification.create_challenge(
        session,
        org_id=ctx.org_id,
        title=data.title,
        description=data.description,
        goal_type=data.goal_type,
        goal_target=data.goal_target,
        reward=data.reward,
        is_public=data.is_public,
        starts_at=data.starts_at,
        ends_at=data.ends_at,
        actor_user_id=ctx.user_id,
    )
    return ChallengeOut.model_validate(challenge)


@router.post("/{challenge_id}/status", response_model=ChallengeOut)
async def set_status(
    challenge_id: str,
    data: ChallengeStatusIn,
    ctx: TenantContext = Depends(require_capability(Capability.VIEW_RETENTION)),
    session: AsyncSession = Depends(get_session),
):
    challenge = await gamification.set_challenge_status(
        session,
        org_id=ctx.org_id,
        challenge_id=challenge_id,
        status=data.status,
        actor_user_id=ctx.user_id,
    )
    return ChallengeOut.model_validate(challenge)


@router.get("/admin", response_model=list[ChallengeCountOut])
async def list_challenges(
    limit: int = Query(default=200, ge=1, le=500),
    ctx: TenantContext = Depends(require_capability(Capability.VIEW_RETENTION)),
    session: AsyncSession = Depends(get_session),
):
    rows = await gamification.list_challenges(session, org_id=ctx.org_id, limit=limit)
    return [ChallengeCountOut(**r) for r in rows]


@router.get("/admin/{challenge_id}", response_model=ChallengeDetailOut)
async def challenge_detail(
    challenge_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    ctx: TenantContext = Depends(require_capability(Capability.VIEW_RETENTION)),
    session: AsyncSession = Depends(get_session),
):
    detail = await gamification.challenge_detail(
        session, org_id=ctx.org_id, challenge_id=challenge_id, limit=limit
    )
    participants = [ChallengeParticipantOut(**p) for p in detail.pop("participants")]
    return ChallengeDetailOut(**detail, participants=participants)
