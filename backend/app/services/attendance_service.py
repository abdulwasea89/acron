"""Attendance service: record + read member gym visits (Section 1.3, #18).

The behaviour signal the retention model needs. Every check-in is a tenant-scoped
row; recording one also returns "status on check-in" (membership state, dues,
birthday, days since last visit, at-risk flag) so the front desk can act on the
spot without a second query.

Visits are never blocked on membership status — an expired member's arrival is
still a signal — so the caller records and lets the flags speak (plan decision).
"""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.constants import (
    AttendanceMethod,
    AttendanceSource,
    MemberStatus,
)
from app.core.security import now_utc
from app.models.attendance import Attendance
from app.models.membership import OrganizationMember
from app.models.organization import Organization
from app.models.user import User
from app.realtime import events
from app.services.audit_service import record_audit

# A repeat check-in for the same member within this window is treated as a
# double-tap and replayed rather than stored (only when no idempotency key was
# supplied — an explicit key is authoritative).
_DOUBLE_TAP_SECONDS = 20

# Active members with no visit in this many days are "dormant" / at risk.
_RISK_DAYS = 14

_DUE_STATES = {
    MemberStatus.GRACE,
    MemberStatus.EXPIRED,
    MemberStatus.PENDING_PAYMENT,
}


def _tz(tz_name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(tz_name or "UTC")
    except Exception:
        return ZoneInfo("UTC")


def day_bounds(tz_name: str | None, *, at: datetime | None = None) -> tuple[datetime, datetime]:
    """Naive-UTC [start, end) for the org's local calendar day."""

    tz = _tz(tz_name)
    now = (at or now_utc()).replace(tzinfo=timezone.utc).astimezone(tz)
    start_local = datetime.combine(now.date(), time.min, tzinfo=tz)
    end_local = start_local + timedelta(days=1)
    return (
        start_local.astimezone(timezone.utc).replace(tzinfo=None),
        end_local.astimezone(timezone.utc).replace(tzinfo=None),
    )


async def _get_member(session: AsyncSession, org_id: str, member_id: str) -> OrganizationMember:
    member = await session.get(OrganizationMember, member_id)
    if member is None or member.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Member not found in this organization.")
    return member


def _name(member: OrganizationMember, user: User | None) -> str | None:
    if member.display_name:
        return member.display_name
    if user is None:
        return None
    return user.full_name or user.email


async def _visits_today(
    session: AsyncSession, *, org_id: str, member_id: str, tz_name: str | None
) -> int:
    start, end = day_bounds(tz_name)
    return int(
        (
            await session.execute(
                select(func.count()).select_from(Attendance).where(
                    Attendance.organization_id == org_id,
                    Attendance.member_id == member_id,
                    Attendance.checked_in_at >= start,
                    Attendance.checked_in_at < end,
                )
            )
        ).scalar_one()
        or 0
    )


async def _status(
    session: AsyncSession,
    *,
    org_id: str,
    member: OrganizationMember,
    user: User | None,
    tz_name: str | None,
    before_at: datetime,
) -> dict:
    """Status-on-check-in flags, measured against visits *before* ``before_at``."""

    last = (
        await session.execute(
            select(func.max(Attendance.checked_in_at)).where(
                Attendance.organization_id == org_id,
                Attendance.member_id == member.id,
                Attendance.checked_in_at < before_at,
            )
        )
    ).scalar_one_or_none()

    days_since = (now_utc() - last).days if last is not None else None

    tz = _tz(tz_name)
    today = now_utc().replace(tzinfo=timezone.utc).astimezone(tz).date()
    birthday_today = False
    if user and user.date_of_birth:
        dob = user.date_of_birth
        try:
            birthday_today = dob.replace(year=today.year) == today
        except ValueError:
            # Feb 29 in a non-leap year: treat as a match on Feb 28/Mar 1 is
            # arguable; simplest correct answer is "not today" for this year.
            birthday_today = False

    # First-ever visit for a member who joined long ago is itself a warning.
    at_risk = days_since is not None and days_since >= _RISK_DAYS
    if days_since is None and member.joined_at is not None:
        joined_days = (now_utc() - member.joined_at).days
        at_risk = joined_days >= _RISK_DAYS

    return {
        "membership_status": member.member_status.value
        if hasattr(member.member_status, "value")
        else str(member.member_status),
        "payment_due": member.member_status in _DUE_STATES,
        "birthday_today": birthday_today,
        "days_since_last_visit": days_since,
        "at_risk": at_risk,
    }


async def record_checkin(
    session: AsyncSession,
    *,
    org_id: str,
    member_id: str,
    method: AttendanceMethod | str = AttendanceMethod.MANUAL,
    source: AttendanceSource | str = AttendanceSource.FRONT_DESK,
    actor_user_id: str | None = None,
    class_session_id: str | None = None,
    note: str | None = None,
    idempotency_key: str | None = None,
) -> dict:
    """Record a member visit and return it with status-on-check-in flags."""

    member = await _get_member(session, org_id, member_id)
    user = await session.get(User, member.user_id)
    org = await session.get(Organization, org_id)
    tz_name = org.timezone if org else "UTC"

    method_enum = method if isinstance(method, AttendanceMethod) else AttendanceMethod(str(method))
    source_enum = source if isinstance(source, AttendanceSource) else AttendanceSource(str(source))

    # Replay an explicit idempotency key.
    if idempotency_key:
        existing = (
            await session.execute(
                select(Attendance).where(
                    Attendance.organization_id == org_id,
                    Attendance.idempotency_key == idempotency_key,
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            status = await _status(
                session, org_id=org_id, member=member, user=user, tz_name=tz_name,
                before_at=existing.checked_in_at,
            )
            status["visits_today"] = await _visits_today(
                session, org_id=org_id, member_id=member.id, tz_name=tz_name
            )
            return _out(existing, member=member, user=user, status=status)

    # Swallow an accidental double-tap (same member, same method, seconds apart).
    # Only for front-desk logging; class/self events are never collapsed.
    if not idempotency_key and source_enum is AttendanceSource.FRONT_DESK:
        recent = (
            await session.execute(
                select(Attendance).where(
                    Attendance.organization_id == org_id,
                    Attendance.member_id == member.id,
                    Attendance.method == method_enum,
                    Attendance.checked_in_at >= now_utc() - timedelta(seconds=_DOUBLE_TAP_SECONDS),
                )
            )
        ).scalar_one_or_none()
        if recent is not None:
            status = await _status(
                session, org_id=org_id, member=member, user=user, tz_name=tz_name,
                before_at=recent.checked_in_at,
            )
            status["visits_today"] = await _visits_today(
                session, org_id=org_id, member_id=member.id, tz_name=tz_name
            )
            return _out(recent, member=member, user=user, status=status)

    at = now_utc()
    row = Attendance(
        organization_id=org_id,
        member_id=member.id,
        checked_in_at=at,
        method=method_enum,
        source=source_enum,
        checked_in_by=actor_user_id,
        class_session_id=class_session_id,
        note=note,
        idempotency_key=idempotency_key,
    )
    session.add(row)
    await session.flush()

    status = await _status(
        session, org_id=org_id, member=member, user=user, tz_name=tz_name, before_at=at
    )
    status["visits_today"] = await _visits_today(
        session, org_id=org_id, member_id=member.id, tz_name=tz_name
    )

    await record_audit(
        session,
        action="attendance.check_in",
        organization_id=org_id,
        actor_user_id=actor_user_id,
        entity_type="attendance",
        entity_id=row.id,
        metadata={"member_id": member.id, "method": method_enum.value, "source": source_enum.value},
    )
    await events.attendance_checked_in(org_id, member_id=member.id, attendance_id=row.id)
    return _out(row, member=member, user=user, status=status)


def _out(
    row: Attendance,
    *,
    member: OrganizationMember,
    user: User | None,
    status: dict,
) -> dict:
    return {
        "id": row.id,
        "member_id": row.member_id,
        "member_name": _name(member, user),
        "checked_in_at": row.checked_in_at,
        "method": row.method.value if hasattr(row.method, "value") else str(row.method),
        "source": row.source.value if hasattr(row.source, "value") else str(row.source),
        "class_session_id": row.class_session_id,
        "note": row.note,
        **status,
    }


async def list_today(
    session: AsyncSession, *, org_id: str, tz_name: str | None, limit: int = 200
) -> list[dict]:
    """Today's check-ins with member names, newest first."""

    start, end = day_bounds(tz_name)
    rows = (
        await session.execute(
            select(Attendance, OrganizationMember, User)
            .join(OrganizationMember, OrganizationMember.id == Attendance.member_id)
            .outerjoin(User, User.id == OrganizationMember.user_id)
            .where(
                Attendance.organization_id == org_id,
                Attendance.checked_in_at >= start,
                Attendance.checked_in_at < end,
            )
            .order_by(Attendance.checked_in_at.desc())
            .limit(limit)
        )
    ).all()
    return [_out(r, member=m, user=u, status={}) for r, m, u in rows]


async def list_for_member(
    session: AsyncSession, *, org_id: str, member_id: str, limit: int = 50
) -> list[dict]:
    """A member's visit history, newest first."""

    member = await _get_member(session, org_id, member_id)
    user = await session.get(User, member.user_id)
    rows = (
        await session.execute(
            select(Attendance)
            .where(
                Attendance.organization_id == org_id,
                Attendance.member_id == member_id,
            )
            .order_by(Attendance.checked_in_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    return [_out(r, member=member, user=user, status={}) for r in rows]


async def last_visit_at(
    session: AsyncSession, *, org_id: str, member_id: str
) -> datetime | None:
    return (
        await session.execute(
            select(func.max(Attendance.checked_in_at)).where(
                Attendance.organization_id == org_id,
                Attendance.member_id == member_id,
            )
        )
    ).scalar_one_or_none()


async def summary(
    session: AsyncSession, *, org_id: str, tz_name: str | None
) -> dict:
    """Front-desk headline numbers for today (org-local day)."""

    start, end = day_bounds(tz_name)
    today_count = int(
        (
            await session.execute(
                select(func.count()).select_from(Attendance).where(
                    Attendance.organization_id == org_id,
                    Attendance.checked_in_at >= start,
                    Attendance.checked_in_at < end,
                )
            )
        ).scalar_one()
        or 0
    )
    unique_today = int(
        (
            await session.execute(
                select(func.count(func.distinct(Attendance.member_id))).where(
                    Attendance.organization_id == org_id,
                    Attendance.checked_in_at >= start,
                    Attendance.checked_in_at < end,
                )
            )
        ).scalar_one()
        or 0
    )

    week_start = start - timedelta(days=6)
    week_count = int(
        (
            await session.execute(
                select(func.count()).select_from(Attendance).where(
                    Attendance.organization_id == org_id,
                    Attendance.checked_in_at >= week_start,
                    Attendance.checked_in_at < end,
                )
            )
        ).scalar_one()
        or 0
    )

    risk_start = now_utc() - timedelta(days=_RISK_DAYS)
    active_members = int(
        (
            await session.execute(
                select(func.count()).select_from(OrganizationMember).where(
                    OrganizationMember.organization_id == org_id,
                    OrganizationMember.role == "member",
                    OrganizationMember.member_status == MemberStatus.ACTIVE,
                )
            )
        ).scalar_one()
        or 0
    )
    recent_visitors = (
        await session.execute(
            select(func.count(func.distinct(Attendance.member_id))).where(
                Attendance.organization_id == org_id,
                Attendance.checked_in_at >= risk_start,
            )
        )
    ).scalar_one() or 0
    dormant = max(0, active_members - int(recent_visitors))

    return {
        "today_count": today_count,
        "unique_today": unique_today,
        "avg_last_7_days": round(week_count / 7, 1),
        "dormant_members": dormant,
    }


async def summary_for_org(session: AsyncSession, *, org_id: str) -> dict:
    """``summary`` with the org's timezone resolved internally."""

    org = await session.get(Organization, org_id)
    return await summary(session, org_id=org_id, tz_name=org.timezone if org else "UTC")


async def search_members(
    session: AsyncSession, *, org_id: str, q: str, limit: int = 8
) -> list[dict]:
    """Search everyone in the org by name/email/phone for the check-in box.

    Not limited to ``role == member``: owners, managers, trainers and front desk
    often hold their own membership at the venue, so a staff member arriving for
    a workout is checkable too (same rule as the cash-logging search). Gated by
    ``TAKE_ATTENDANCE`` at the route layer, which is why this does not reuse the
    admin member directory.
    """

    term = q.strip()
    if not term:
        return []
    pattern = f"%{term.lower()}%"
    rows = (
        await session.execute(
            select(OrganizationMember, User)
            .join(User, User.id == OrganizationMember.user_id)
            .where(
                OrganizationMember.organization_id == org_id,
                func.lower(func.coalesce(OrganizationMember.display_name, User.full_name, "")).like(pattern)
                | func.lower(User.email).like(pattern)
                | func.coalesce(OrganizationMember.phone, "").like(f"%{term}%"),
            )
            .order_by(User.full_name, User.email)
            .limit(max(1, min(limit, 25)))
        )
    ).all()
    return [
        {
            "member_id": m.id,
            "member_name": _name(m, u),
            "member_email": u.email,
            "member_status": m.member_status.value
            if hasattr(m.member_status, "value")
            else str(m.member_status),
            "phone": m.phone,
        }
        for m, u in rows
    ]
