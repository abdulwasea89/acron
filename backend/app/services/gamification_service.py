"""Challenges, streaks, and leaderboards service (#38).

Gamification is the *preventive* arm of the retention stack: it gives a member
a reason to show up before the churn score ever flags them (and a broken
streak is itself a signal the inactivity ladder picks up).

Three responsibilities:

* **Admin CRUD** — create org-defined challenges (N visits / N classes / streak
  length), publish/pause/archive them, and see per-member progress.
* **Member self** — the member's live challenges with personal progress, their
  visit streak + best, and the gym leaderboard.
* **Daily sweep** — maintain ``MemberStreak`` from the existing ``Attendance``
  stream and advance every published challenge's progress; a ``completed_at``
  is set exactly once per member, so re-running the sweep never double-notifies
  (idempotency, Security rule 2 applies to money, and to attention).

Challenges are gym-defined (like plans), not platform templates: no seed rows.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timedelta

import sqlalchemy as sa
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.constants import (
    ChallengeGoalType,
    ChallengeProgressStatus,
    ChallengeStatus,
    MemberStatus,
    NotificationKind,
    Role,
)
from app.core.security import now_utc
from app.integrations.email import send_email_safe as send_email
from app.models.attendance import Attendance
from app.models.gamification import GymChallenge, MemberChallengeProgress, MemberStreak
from app.models.membership import OrganizationMember
from app.models.user import User
from app.services.audit_service import record_audit

# Streak lengths that earn a shout-out (mirrors the day-7/30/90 cadence).
_STREAK_MILESTONES = (7, 30, 90)

_ALLOWED_TRANSITIONS: dict[ChallengeStatus, set[ChallengeStatus]] = {
    ChallengeStatus.DRAFT: {ChallengeStatus.PUBLISHED, ChallengeStatus.ARCHIVED},
    ChallengeStatus.PUBLISHED: {
        ChallengeStatus.PAUSED,
        ChallengeStatus.COMPLETED,
        ChallengeStatus.ARCHIVED,
    },
    ChallengeStatus.PAUSED: {ChallengeStatus.PUBLISHED, ChallengeStatus.ARCHIVED},
    ChallengeStatus.COMPLETED: {ChallengeStatus.ARCHIVED},
    ChallengeStatus.ARCHIVED: set(),
}


# ------------------------------------------------------------------- helpers
async def _get_member(session: AsyncSession, org_id: str, member_id: str) -> OrganizationMember:
    member = await session.get(OrganizationMember, member_id)
    if member is None or member.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Member not found in this organization.")
    return member


async def _get_challenge(session: AsyncSession, org_id: str, challenge_id: str) -> GymChallenge:
    challenge = await session.get(GymChallenge, challenge_id)
    if challenge is None or challenge.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Challenge not found in this organization.")
    return challenge


async def _notify_member(
    session: AsyncSession,
    member: OrganizationMember,
    *,
    category: NotificationKind,
    title: str,
    body: str,
    data: dict | None = None,
) -> None:
    from app.services.notifications_service import create_notification

    user = await session.get(User, member.user_id)
    if user is not None:
        await send_email(user.email, title, body)
    await create_notification(
        session,
        org_id=member.organization_id,
        recipient_user_id=member.user_id,
        category=category,
        title=title,
        body=body,
        data=data,
    )


def _streak_from_dates(dates: list) -> int:
    """Consecutive active-day streak ending at the most recent visit date.

    A streak is broken when the most recent active day is before yesterday
    (the member skipped a full day).
    """

    if not dates:
        return 0
    ordered = sorted({d for d in dates})
    run = 1
    prev = ordered[0]
    for d in ordered[1:]:
        if (d - prev).days == 1:
            run += 1
        else:
            run = 1
        prev = d
    today = now_utc().date()
    if ordered[-1] < today - timedelta(days=1):
        run = 0
    return run


async def _member_name(member: OrganizationMember, user: User | None) -> str:
    return (
        member.display_name
        or (user.full_name if user else None)
        or (user.email if user else None)
        or member.id
    ) or member.id


# --------------------------------------------------------------- admin CRUD
async def create_challenge(
    session: AsyncSession,
    *,
    org_id: str,
    title: str,
    goal_type: ChallengeGoalType,
    goal_target: int,
    starts_at: datetime,
    ends_at: datetime,
    reward: str | None = None,
    description: str | None = None,
    is_public: bool = True,
    actor_user_id: str | None = None,
) -> GymChallenge:
    if goal_target < 1:
        raise HTTPException(status_code=422, detail="goal_target must be at least 1.")
    if ends_at <= starts_at:
        raise HTTPException(status_code=422, detail="ends_at must be after starts_at.")

    challenge = GymChallenge(
        organization_id=org_id,
        title=title,
        description=description,
        goal_type=goal_type,
        goal_target=goal_target,
        reward=reward,
        is_public=is_public,
        starts_at=starts_at,
        ends_at=ends_at,
    )
    session.add(challenge)
    await session.flush()
    await record_audit(
        session,
        action="challenges.created",
        organization_id=org_id,
        actor_user_id=actor_user_id,
        entity_type="gym_challenge",
        entity_id=challenge.id,
        metadata={"goal_type": goal_type.value, "goal_target": goal_target},
    )
    return challenge


async def set_challenge_status(
    session: AsyncSession,
    *,
    org_id: str,
    challenge_id: str,
    status: ChallengeStatus,
    actor_user_id: str | None = None,
) -> GymChallenge:
    challenge = await _get_challenge(session, org_id, challenge_id)
    if status not in _ALLOWED_TRANSITIONS[challenge.status]:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot move '{challenge.status.value}' to '{status.value}'.",
        )
    if status == ChallengeStatus.PUBLISHED:
        challenge.published_at = now_utc()
    challenge.status = status
    session.add(challenge)
    await record_audit(
        session,
        action="challenges.status_changed",
        organization_id=org_id,
        actor_user_id=actor_user_id,
        entity_type="gym_challenge",
        entity_id=challenge.id,
        metadata={"from": challenge.status, "to": status.value},
    )
    return challenge


async def _challenge_progress_rows(
    session: AsyncSession, org_id: str, challenge_id: str, limit: int
) -> list[dict]:
    rows = (
        await session.execute(
            select(MemberChallengeProgress, OrganizationMember, User)
            .select_from(MemberChallengeProgress)
            .join(OrganizationMember)
            .outerjoin(User)
            .where(
                MemberChallengeProgress.organization_id == org_id,
                MemberChallengeProgress.challenge_id == challenge_id,
            )
            .order_by(sa.cast(MemberChallengeProgress.progress, sa.Integer).desc())
            .limit(max(1, min(limit, 500)))
        )
    ).all()
    out: list[dict] = []
    for progress, member, user in rows:
        out.append(
            {
                "member_id": member.id,
                "member_name": await _member_name(member, user),
                "progress": progress.progress,
                "status": progress.status.value
                if hasattr(progress.status, "value")
                else str(progress.status),
                "completed_at": progress.completed_at,
            }
        )
    return out


async def challenge_detail(
    session: AsyncSession, *, org_id: str, challenge_id: str, limit: int = 100
) -> dict:
    challenge = await _get_challenge(session, org_id, challenge_id)
    data = _challenge_dict(challenge)
    data["participants"] = await _challenge_progress_rows(
        session, org_id, challenge_id, limit=limit
    )
    return data


def _challenge_dict(challenge: GymChallenge, *, participants: int | None = None) -> dict:
    return {
        "id": challenge.id,
        "title": challenge.title,
        "description": challenge.description,
        "goal_type": challenge.goal_type.value
        if hasattr(challenge.goal_type, "value")
        else str(challenge.goal_type),
        "goal_target": challenge.goal_target,
        "reward": challenge.reward,
        "status": challenge.status.value
        if hasattr(challenge.status, "value")
        else str(challenge.status),
        "is_public": challenge.is_public,
        "starts_at": challenge.starts_at,
        "ends_at": challenge.ends_at,
        "published_at": challenge.published_at,
        "participants": participants,
    }


async def list_challenges(session: AsyncSession, *, org_id: str, limit: int = 200) -> list[dict]:
    challenges = (
        (
            await session.execute(
                select(GymChallenge)
                .where(GymChallenge.organization_id == org_id)
                .order_by(sa.cast(GymChallenge.created_at, sa.DateTime).desc())
                .limit(max(1, min(limit, 500)))
            )
        )
        .scalars()
        .all()
    )
    counts: dict[str, int] = {}
    if challenges:
        rows = (
            await session.execute(
                select(MemberChallengeProgress.challenge_id, func.count())
                .select_from(MemberChallengeProgress)
                .where(MemberChallengeProgress.organization_id == org_id)
                .group_by(MemberChallengeProgress.challenge_id)
            )
        ).all()
        counts = {cid: int(n) for cid, n in rows}
    return [_challenge_dict(c, participants=counts.get(c.id, 0)) for c in challenges]


# ------------------------------------------------------------- member self
async def member_self(session: AsyncSession, *, org_id: str, member_id: str) -> dict:
    _ = await _get_member(session, org_id, member_id)
    now = now_utc()

    challenges = (
        (
            await session.execute(
                select(GymChallenge).where(
                    GymChallenge.organization_id == org_id,
                    GymChallenge.status == ChallengeStatus.PUBLISHED,
                    GymChallenge.is_public == sa.true(),
                )
            )
        )
        .scalars()
        .all()
    )

    progress_rows = {
        p.challenge_id: p
        for p in (
            await session.execute(
                select(MemberChallengeProgress).where(
                    MemberChallengeProgress.organization_id == org_id,
                    MemberChallengeProgress.member_id == member_id,
                )
            )
        )
        .scalars()
        .all()
    }

    streak = (
        await session.execute(
            select(MemberStreak).where(
                MemberStreak.organization_id == org_id,
                MemberStreak.member_id == member_id,
            )
        )
    ).scalar_one_or_none()

    out: list[dict] = []
    for c in challenges:
        progress = progress_rows.get(c.id)
        out.append(
            {
                **_challenge_dict(c),
                "active": c.starts_at <= now < c.ends_at,
                "progress": progress.progress if progress else 0,
                "challenge_status": (
                    progress.status.value
                    if progress and hasattr(progress.status, "value")
                    else "locked"
                    if c.starts_at > now
                    else ChallengeProgressStatus.ACTIVE.value
                ),
                "completed": progress.status == ChallengeProgressStatus.COMPLETED
                if progress
                else False,
                "completed_at": progress.completed_at if progress else None,
            }
        )

    return {
        "streak": {
            "current": streak.current_streak if streak else 0,
            "best": streak.best_streak if streak else 0,
            "last_active_date": streak.last_active_date if streak else None,
        },
        "challenges": out,
    }


async def leaderboard(
    session: AsyncSession, *, org_id: str, period: str = "week", limit: int = 20
) -> list[dict]:
    now = now_utc()
    since = {
        "week": now - timedelta(days=7),
        "month": now - timedelta(days=30),
        "all": now - timedelta(days=3650),
    }.get(period)
    if since is None:
        raise HTTPException(status_code=422, detail="period must be 'week', 'month' or 'all'.")

    rows = (
        await session.execute(
            select(Attendance.member_id, func.count().label("check_ins"))
            .select_from(Attendance)
            .where(Attendance.organization_id == org_id, Attendance.checked_in_at >= since)
            .group_by(Attendance.member_id)
            .order_by(func.count().desc())
            .limit(max(1, min(limit, 100)))
        )
    ).all()

    out: list[dict] = []
    for rank, (member_id, check_ins) in enumerate(rows, start=1):
        member = await session.get(OrganizationMember, member_id)
        if member is None:
            continue
        user = await session.get(User, member.user_id)
        out.append(
            {
                "rank": rank,
                "member_id": member_id,
                "member_name": await _member_name(member, user),
                "check_ins": int(check_ins),
            }
        )
    return out


# ------------------------------------------------------------------- sweep
async def _visits_in(
    session: AsyncSession,
    *,
    org_id: str,
    member_id: str,
    since: datetime,
    classes_only: bool = False,
) -> int:
    stmt = (
        select(func.count())
        .select_from(Attendance)
        .where(
            Attendance.organization_id == org_id,
            Attendance.member_id == member_id,
            Attendance.checked_in_at >= since,
        )
    )
    if classes_only:
        stmt = stmt.where(Attendance.class_session_id != None)  # noqa: E711
    return int((await session.execute(stmt)).scalar_one() or 0)


async def _update_streaks(
    session: AsyncSession, *, org_id: str, members: Sequence[OrganizationMember]
) -> dict:
    """Rebuild each active member's streak from their attendance dates."""

    rows = (
        await session.execute(
            select(Attendance.member_id, Attendance.checked_in_at).where(
                Attendance.organization_id == org_id,
                Attendance.checked_in_at >= now_utc() - timedelta(days=369),
            )
        )
    ).all()
    by_member: dict[str, list] = {}
    for member_id, checked_in_at in rows:
        by_member.setdefault(member_id, []).append(checked_in_at.date())

    existing = {
        s.member_id: s
        for s in (
            await session.execute(
                select(MemberStreak).where(MemberStreak.organization_id == org_id)
            )
        )
        .scalars()
        .all()
    }

    updated = celebrated = 0
    for member in members:
        dates = by_member.get(member.id, [])
        streak = _streak_from_dates(dates)
        row = existing.get(member.id)
        if row is None:
            row = MemberStreak(
                organization_id=org_id,
                member_id=member.id,
                current_streak=streak,
                best_streak=streak,
                last_active_date=max(dates) if dates else None,
            )
            session.add(row)
            updated += 1
            if streak in _STREAK_MILESTONES and streak > 0:
                await _notify_member(
                    session,
                    member,
                    category=NotificationKind.STREAK,
                    title=f"{streak}-day visit streak!",
                    body=f"You've visited {streak} days in a row. Keep the momentum going.",
                    data={"streak": streak, "member_id": member.id},
                )
                celebrated += 1
        else:
            old = row.current_streak
            row.current_streak = streak
            row.best_streak = max(row.best_streak, streak)
            row.last_active_date = max(dates) if dates else row.last_active_date
            session.add(row)
            if streak in _STREAK_MILESTONES and old < streak:
                await _notify_member(
                    session,
                    member,
                    category=NotificationKind.STREAK,
                    title=f"{streak}-day visit streak!",
                    body=f"You've visited {streak} days in a row. Keep the momentum going.",
                    data={"streak": streak, "member_id": member.id},
                )
                celebrated += 1
            updated += 1
    await session.flush()
    return {"updated": updated, "celebrated": celebrated}


async def _update_challenge(
    session: AsyncSession,
    *,
    org_id: str,
    challenge: GymChallenge,
    members: Sequence[OrganizationMember],
    streaks: dict[str, MemberStreak],
) -> int:
    """Advance one published challenge for all members in the window."""

    now = now_utc()
    if now >= challenge.ends_at:
        challenge.status = ChallengeStatus.COMPLETED
        session.add(challenge)
        return 0

    since = max(challenge.starts_at, now - timedelta(days=400))
    classes_only = challenge.goal_type == ChallengeGoalType.CLASSES
    completed = 0
    existing = {
        m.member_id: m
        for m in (
            await session.execute(
                select(MemberChallengeProgress).where(
                    MemberChallengeProgress.organization_id == org_id,
                    MemberChallengeProgress.challenge_id == challenge.id,
                )
            )
        )
        .scalars()
        .all()
    }

    for member in members:
        if challenge.starts_at > now:
            break
        progress_row = existing.get(member.id)
        if progress_row is not None and progress_row.status == ChallengeProgressStatus.COMPLETED:
            continue
        if challenge.goal_type == ChallengeGoalType.STREAK:
            streak_row = streaks.get(member.id)
            value = streak_row.current_streak if streak_row else 0
        else:
            value = await _visits_in(
                session,
                org_id=org_id,
                member_id=member.id,
                since=since,
                classes_only=classes_only,
            )
        if progress_row is None:
            progress_row = MemberChallengeProgress(
                organization_id=org_id,
                challenge_id=challenge.id,
                member_id=member.id,
                progress=value,
            )
            session.add(progress_row)
        else:
            progress_row.progress = value
            session.add(progress_row)

        if (
            progress_row.status != ChallengeProgressStatus.COMPLETED
            and value >= challenge.goal_target
        ):
            progress_row.status = ChallengeProgressStatus.COMPLETED
            progress_row.completed_at = now
            session.add(progress_row)
            await _notify_member(
                session,
                member,
                category=NotificationKind.CHALLENGE,
                title=f"Challenge complete: {challenge.title}",
                body=(
                    f"You hit {value} of {challenge.goal_target} "
                    f"({challenge.goal_type.value}).{(' Reward: ' + challenge.reward) if challenge.reward else ''}"
                ),
                data={"challenge_id": challenge.id, "member_id": member.id},
            )
            completed += 1
    return completed


async def sweep(session: AsyncSession, *, org_id: str) -> dict:
    """Daily per-org sweep: streaks + challenge progress. Idempotent."""

    members = (
        (
            await session.execute(
                select(OrganizationMember).where(
                    OrganizationMember.organization_id == org_id,
                    OrganizationMember.role == Role.MEMBER,
                    OrganizationMember.member_status == MemberStatus.ACTIVE,
                )
            )
        )
        .scalars()
        .all()
    )

    streak_out = await _update_streaks(session, org_id=org_id, members=members)
    streak_rows = {
        s.member_id: s
        for s in (
            await session.execute(
                select(MemberStreak).where(MemberStreak.organization_id == org_id)
            )
        )
        .scalars()
        .all()
    }

    challenges = (
        (
            await session.execute(
                select(GymChallenge).where(
                    GymChallenge.organization_id == org_id,
                    GymChallenge.status == ChallengeStatus.PUBLISHED,
                )
            )
        )
        .scalars()
        .all()
    )

    completed = 0
    for challenge in challenges:
        completed += await _update_challenge(
            session, org_id=org_id, challenge=challenge, members=members, streaks=streak_rows
        )
    return {
        "challenges": len(challenges),
        "members": len(members),
        "completed": completed,
        "streaks_updated": streak_out["updated"],
        "streak_celebrations": streak_out["celebrated"],
    }
