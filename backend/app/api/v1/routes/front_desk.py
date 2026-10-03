"""Front-desk visitor & locker routes (Section 1.3, #22).

Walk-ins / day passes / guest log and the locker register. Mounted at
``/front-desk``.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_capability
from app.core.permissions import Capability
from app.core.tenancy import IDEMPOTENCY_HEADER, TenantContext
from app.schemas.visitor import (
    LockerAssignIn,
    LockerIn,
    LockerOut,
    VisitorLogIn,
    VisitorOut,
)
from app.services import visitor_service as visitors

router = APIRouter()


# ------------------------------------------------------------------ visitors
@router.get("/summary")
async def summary(
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_VISITORS)),
    session: AsyncSession = Depends(get_session),
):
    return await visitors.summary(session, org_id=ctx.org_id)


@router.get("/visitors", response_model=list[VisitorOut])
async def list_visitors(
    day: date | None = None,
    in_only: bool = False,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_VISITORS)),
    session: AsyncSession = Depends(get_session),
):
    return await visitors.list_visitors(session, org_id=ctx.org_id, day=day, in_only=in_only)


@router.post("/visitors", response_model=VisitorOut, status_code=201)
async def log_visitor(
    data: VisitorLogIn,
    idempotency_key: str = Header(default="", alias=IDEMPOTENCY_HEADER),
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_VISITORS)),
    session: AsyncSession = Depends(get_session),
):
    return await visitors.log_visitor(
        session, org_id=ctx.org_id, data=data, actor_user_id=ctx.user_id,
        idempotency_key=idempotency_key or None,
    )


@router.post("/visitors/{visitor_id}/check-out", response_model=VisitorOut)
async def check_out(
    visitor_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_VISITORS)),
    session: AsyncSession = Depends(get_session),
):
    return await visitors.check_out(
        session, org_id=ctx.org_id, visitor_id=visitor_id, actor_id=ctx.user_id
    )


# ------------------------------------------------------------------- lockers
@router.get("/lockers", response_model=list[LockerOut])
async def list_lockers(
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_VISITORS)),
    session: AsyncSession = Depends(get_session),
):
    return await visitors.list_lockers(session, org_id=ctx.org_id)


@router.post("/lockers", response_model=LockerOut, status_code=201)
async def create_locker(
    data: LockerIn,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_VISITORS)),
    session: AsyncSession = Depends(get_session),
):
    return await visitors.create_locker(
        session, org_id=ctx.org_id, data=data, actor_id=ctx.user_id
    )


@router.post("/lockers/{locker_id}/assign", response_model=LockerOut)
async def assign_locker(
    locker_id: str,
    data: LockerAssignIn,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_VISITORS)),
    session: AsyncSession = Depends(get_session),
):
    return await visitors.assign_locker(
        session, org_id=ctx.org_id, locker_id=locker_id, data=data, actor_id=ctx.user_id
    )


@router.post("/lockers/{locker_id}/release", response_model=LockerOut)
async def release_locker(
    locker_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.MANAGE_VISITORS)),
    session: AsyncSession = Depends(get_session),
):
    return await visitors.release_locker(
        session, org_id=ctx.org_id, locker_id=locker_id, actor_id=ctx.user_id
    )
