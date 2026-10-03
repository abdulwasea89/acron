"""Attendance API routes (Section 1.3, #18).

Front-desk check-in, the live "today" feed, per-member visit history and the
console summary. Check-in is idempotent (Security Rule #2): the client sends an
``Idempotency-Key`` and a double-tap replays the first result.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_org, get_session, get_tenant, require_capability
from app.core.permissions import Capability
from app.core.tenancy import IDEMPOTENCY_HEADER, TenantContext
from app.models.organization import Organization
from app.schemas.attendance import (
    AttendanceMember,
    AttendanceOut,
    AttendanceSummary,
    CheckInCreate,
    CheckInOut,
    SyncIn,
    SyncOut,
    SyncResult,
)
from app.services import attendance_service as attendance

router = APIRouter()


@router.get("/members", response_model=list[AttendanceMember])
async def search_members(
    q: str = "",
    ctx: TenantContext = Depends(require_capability(Capability.TAKE_ATTENDANCE)),
    org: Organization = Depends(get_org),
    session: AsyncSession = Depends(get_session),
):
    """Search members by name/email/phone for the check-in box.

    Uses ``TAKE_ATTENDANCE`` (front desk included) rather than the admin member
    directory, which front desk cannot read. Each hit carries its status card.
    """

    rows = await attendance.search_members(
        session, org_id=ctx.org_id, q=q, tz_name=org.timezone
    )
    return [AttendanceMember(**r) for r in rows]


@router.get("/roster", response_model=list[AttendanceMember])
async def roster(
    ctx: TenantContext = Depends(require_capability(Capability.TAKE_ATTENDANCE)),
    session: AsyncSession = Depends(get_session),
):
    """Everyone in the org (id/name/email/status) for offline check-in search."""

    rows = await attendance.list_roster(session, org_id=ctx.org_id)
    return [AttendanceMember(**r) for r in rows]


@router.post("/sync", response_model=SyncOut)
async def sync(
    data: SyncIn,
    ctx: TenantContext = Depends(require_capability(Capability.TAKE_ATTENDANCE)),
    session: AsyncSession = Depends(get_session),
):
    """Flush offline-queued check-ins (idempotent per item)."""

    results: list[SyncResult] = []
    for item in data.items:
        try:
            res = await attendance.record_checkin(
                session,
                org_id=ctx.org_id,
                member_id=item.member_id,
                method=item.method,
                actor_user_id=ctx.user_id,
                idempotency_key=item.idempotency_key,
                checked_in_at=item.checked_in_at,
            )
            results.append(SyncResult(id=item.id, status="synced", attendance_id=res["id"]))
        except HTTPException as e:
            results.append(SyncResult(id=item.id, status="error", detail=str(e.detail)))
    return SyncOut(results=results)


@router.post("/check-in", response_model=CheckInOut, status_code=201)
async def check_in(
    data: CheckInCreate,
    idempotency_key: str = Header(default="", alias=IDEMPOTENCY_HEADER),
    ctx: TenantContext = Depends(require_capability(Capability.TAKE_ATTENDANCE)),
    session: AsyncSession = Depends(get_session),
):
    """Log a member visit (manual or QR) and return status-on-check-in."""

    result = await attendance.record_checkin(
        session,
        org_id=ctx.org_id,
        member_id=data.member_id,
        method=data.method,
        actor_user_id=ctx.user_id,
        note=data.note,
        idempotency_key=idempotency_key or None,
    )
    return CheckInOut(**result)


@router.get("/today", response_model=list[AttendanceOut])
async def today(
    ctx: TenantContext = Depends(get_tenant),
    org: Organization = Depends(get_org),
    session: AsyncSession = Depends(get_session),
):
    if not ctx.is_staff:
        raise HTTPException(status_code=403, detail="Staff only.")
    rows = await attendance.list_today(session, org_id=ctx.org_id, tz_name=org.timezone)
    return [AttendanceOut(**r) for r in rows]


@router.get("/members/{member_id}/visits", response_model=list[AttendanceOut])
async def member_visits(
    member_id: str,
    ctx: TenantContext = Depends(get_tenant),
    session: AsyncSession = Depends(get_session),
):
    if not ctx.is_staff:
        raise HTTPException(status_code=403, detail="Staff only.")
    rows = await attendance.list_for_member(session, org_id=ctx.org_id, member_id=member_id)
    return [AttendanceOut(**r) for r in rows]


@router.get("/summary", response_model=AttendanceSummary)
async def summary(
    ctx: TenantContext = Depends(get_tenant),
    org: Organization = Depends(get_org),
    session: AsyncSession = Depends(get_session),
):
    if not ctx.is_staff:
        raise HTTPException(status_code=403, detail="Staff only.")
    data = await attendance.summary(session, org_id=ctx.org_id, tz_name=org.timezone)
    return AttendanceSummary(**data)
