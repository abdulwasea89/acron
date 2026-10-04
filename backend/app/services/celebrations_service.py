"""Celebrations: birthdays, membership anniversaries, visit milestones (#36).

Retention is not only about stopping churn — it is also about being the place a
member feels seen. This service acknowledges three moments:

* **Birthday** — once a year, plus a staff task to say it in person.
* **Membership anniversary** — every year joined, with a thank-you.
* **Visit milestone** — 10 / 50 / 100 / 250 / 500 / 1000 total visits.

Each moment is fired once (deduped on ``member + kind + key``). On the first run
against an existing base, only the *highest* crossed visit milestone is emailed;
the lower ones are recorded silently so nobody is spammed.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.constants import CelebrationKind, MemberStatus, NotificationKind
from app.core.security import now_utc
from app.integrations.email import send_email_safe as send_email
from app.models.attendance import Attendance
from app.models.celebration import MemberCelebration
from app.models.membership import OrganizationMember
from app.models.organization import Organization
from app.models.staff import Task
from app.models.user import User
from app.services.audit_service import record_audit

VISIT_MILESTONES: tuple[int, ...] = (10, 50, 100, 250, 500, 1000)

# Members worth celebrating — active and in grace; frozen/pending are skipped.
_CELEBRATE_STATUSES = {MemberStatus.ACTIVE, MemberStatus.GRACE}


def _tz(tz_name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(tz_name or "UTC")
    except Exception:
        return ZoneInfo("UTC")


def local_today(tz_name: str | None) -> date:
    return now_utc().replace(tzinfo=timezone.utc).astimezone(_tz(tz_name)).date()


def _name(member: OrganizationMember, user: User | None) -> str:
    return member.display_name or (user.full_name if user else None) or (user.email if user else None) or "there"


def _next_occurrence(month: int, day: int, today: date) -> date:
    """The next calendar occurrence of month/day on or after today."""

    def _safe(year: int) -> date:
        try:
            return date(year, month, day)
        except ValueError:
            return date(year, month, 28)  # Feb 29 in a non-leap year

    this_year = _safe(today.year)
    return this_year if this_year >= today else _safe(today.year + 1)


async def _celebrate(
    session: AsyncSession,
    *,
    org: Organization,
    member: OrganizationMember,
    user: User | None,
    kind: CelebrationKind,
    key: str,
    title: str,
    body: str,
    task_title: str | None,
    notify: bool,
    now: datetime,
) -> bool:
    existing = (
        await session.execute(
            select(MemberCelebration).where(
                MemberCelebration.member_id == member.id,
                MemberCelebration.kind == kind,
                MemberCelebration.key == key,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return False

    session.add(
        MemberCelebration(
            organization_id=org.id,
            member_id=member.id,
            kind=kind,
            key=key,
            title=title,
            body=body,
            sent_at=now,
        )
    )
    await session.flush()

    if notify:
        if user is not None:
            await send_email(user.email, title, body)
        from app.services.notifications_service import create_notification

        await create_notification(
            session,
            org_id=org.id,
            recipient_user_id=member.user_id,
            category=NotificationKind.CELEBRATION,
            title=title,
            body=body,
            data={"kind": kind.value, "key": key},
        )
        if task_title:
            session.add(
                Task(
                    organization_id=org.id,
                    title=task_title,
                    description=f"{body} [mid:{member.id}]",
                )
            )
            await session.flush()

    await record_audit(
        session,
        action="celebration.sent" if notify else "celebration.recorded",
        organization_id=org.id,
        actor_user_id=None,
        entity_type="member",
        entity_id=member.id,
        metadata={"kind": kind.value, "key": key},
    )
    return True


async def run_sweep(session: AsyncSession, *, org_id: str, now: datetime | None = None) -> dict:
    """Acknowledge today's birthdays, anniversaries and visit milestones."""

    now = now or now_utc()
    org = await session.get(Organization, org_id)
    if org is None:
        return {"birthdays": 0, "anniversaries": 0, "milestones": 0}

    today = local_today(org.timezone)
    rows = (
        await session.execute(
            select(OrganizationMember, User)
            .join(User, User.id == OrganizationMember.user_id)
            .where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.role == "member",
                OrganizationMember.member_status.in_(list(_CELEBRATE_STATUSES)),
            )
        )
    ).all()
    if not rows:
        return {"birthdays": 0, "anniversaries": 0, "milestones": 0}

    ids = [m.id for m, _u in rows]
    visit_counts = dict(
        (
            await session.execute(
                select(Attendance.member_id, func.count())
                .where(
                    Attendance.organization_id == org_id,
                    Attendance.member_id.in_(ids),
                )
                .group_by(Attendance.member_id)
            )
        ).all()
    )

    birthdays = anniversaries = milestones = 0
    for member, user in rows:
        name = _name(member, user)

        if user is not None and user.date_of_birth is not None:
            dob = user.date_of_birth
            if (dob.month, dob.day) == (today.month, today.day):
                if await _celebrate(
                    session, org=org, member=member, user=user,
                    kind=CelebrationKind.BIRTHDAY, key=str(today.year),
                    title=f"Happy birthday, {name}!",
                    body=f"Everyone at {org.name} wishes you a fantastic year ahead. 🎉",
                    task_title=f"Wish {name} a happy birthday",
                    notify=True, now=now,
                ):
                    birthdays += 1

        if member.joined_at is not None:
            joined = member.joined_at.date() if isinstance(member.joined_at, datetime) else member.joined_at
            years = today.year - joined.year
            if (joined.month, joined.day) == (today.month, today.day) and years >= 1:
                if await _celebrate(
                    session, org=org, member=member, user=user,
                    kind=CelebrationKind.ANNIVERSARY, key=str(years),
                    title=f"{years} year{'s' if years != 1 else ''} with {org.name}!",
                    body=f"Thanks for showing up for {years} year{'s' if years != 1 else ''}, {name}. Here's to the next one.",
                    task_title=f"Congratulate {name} on {years} year(s)",
                    notify=True, now=now,
                ):
                    anniversaries += 1

        total = int(visit_counts.get(member.id, 0) or 0)
        crossed = [t for t in VISIT_MILESTONES if total >= t]
        if crossed:
            top = max(crossed)
            for threshold in crossed:
                fired = await _celebrate(
                    session, org=org, member=member, user=user,
                    kind=CelebrationKind.VISITS, key=str(threshold),
                    title=f"{threshold} visits, {name}!",
                    body=f"You've hit {threshold} check-ins at {org.name}. Consistency like that is rare — keep going!",
                    task_title=None,
                    notify=(threshold == top), now=now,
                )
                if fired and threshold == top:
                    milestones += 1

    return {"birthdays": birthdays, "anniversaries": anniversaries, "milestones": milestones}


async def upcoming(session: AsyncSession, *, org_id: str, days: int = 30) -> list[dict]:
    """Birthdays and anniversaries in the next ``days`` days, soonest first."""

    org = await session.get(Organization, org_id)
    today = local_today(org.timezone if org else "UTC")
    rows = (
        await session.execute(
            select(OrganizationMember, User)
            .join(User, User.id == OrganizationMember.user_id)
            .where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.role == "member",
                OrganizationMember.member_status.in_(list(_CELEBRATE_STATUSES)),
            )
        )
    ).all()

    out: list[dict] = []
    for member, user in rows:
        name = _name(member, user)
        if user is not None and user.date_of_birth is not None:
            occ = _next_occurrence(user.date_of_birth.month, user.date_of_birth.day, today)
            away = (occ - today).days
            if 0 <= away <= days:
                out.append({
                    "member_id": member.id, "name": name, "kind": "birthday",
                    "on": occ, "days_away": away,
                    "detail": f"turning {(occ.year - user.date_of_birth.year)}",
                })
        if member.joined_at is not None:
            joined = member.joined_at.date() if isinstance(member.joined_at, datetime) else member.joined_at
            occ = _next_occurrence(joined.month, joined.day, today)
            away = (occ - today).days
            years = occ.year - joined.year
            if 0 <= away <= days and years >= 1:
                out.append({
                    "member_id": member.id, "name": name, "kind": "anniversary",
                    "on": occ, "days_away": away, "detail": f"{years} year(s)",
                })
    out.sort(key=lambda r: (r["days_away"], r["name"]))
    return out


async def recent(session: AsyncSession, *, org_id: str, limit: int = 50) -> list[dict]:
    """Recently acknowledged celebrations, newest first."""

    rows = (
        await session.execute(
            select(MemberCelebration, OrganizationMember, User)
            .join(OrganizationMember, OrganizationMember.id == MemberCelebration.member_id)
            .outerjoin(User, User.id == OrganizationMember.user_id)
            .where(MemberCelebration.organization_id == org_id)
            .order_by(MemberCelebration.sent_at.desc())
            .limit(max(1, min(limit, 200)))
        )
    ).all()
    return [
        {
            "member_id": c.member_id,
            "name": member.display_name or (u.full_name if u else None) or (u.email if u else None),
            "kind": c.kind.value if hasattr(c.kind, "value") else str(c.kind),
            "key": c.key,
            "title": c.title,
            "sent_at": c.sent_at,
        }
        for c, member, u in rows
    ]
