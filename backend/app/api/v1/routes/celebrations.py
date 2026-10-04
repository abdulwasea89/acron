"""Celebration API routes (#36)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_capability
from app.core.permissions import Capability
from app.core.tenancy import TenantContext
from app.schemas.celebrations import CelebrationOut, UpcomingCelebrationOut
from app.services import celebrations_service as celebrations

router = APIRouter()


@router.get("/upcoming", response_model=list[UpcomingCelebrationOut])
async def upcoming(
    days: int = Query(default=30, ge=1, le=365),
    ctx: TenantContext = Depends(require_capability(Capability.VIEW_RETENTION)),
    session: AsyncSession = Depends(get_session),
):
    return [UpcomingCelebrationOut(**r) for r in
            await celebrations.upcoming(session, org_id=ctx.org_id, days=days)]


@router.get("/recent", response_model=list[CelebrationOut])
async def recent(
    limit: int = Query(default=50, ge=1, le=200),
    ctx: TenantContext = Depends(require_capability(Capability.VIEW_RETENTION)),
    session: AsyncSession = Depends(get_session),
):
    return [CelebrationOut(**r) for r in
            await celebrations.recent(session, org_id=ctx.org_id, limit=limit)]


@router.post("/run", response_model=dict)
async def run_now(
    ctx: TenantContext = Depends(require_capability(Capability.VIEW_RETENTION)),
    session: AsyncSession = Depends(get_session),
):
    """Run today's celebrations on demand (idempotent)."""

    return await celebrations.run_sweep(session, org_id=ctx.org_id)
