"""Net Promoter surveys at day 7 / 30 / 90 (#37).

A member is asked once per touchpoint (7, 30, 90 days after joining) how
likely they are to recommend the gym, on a 0-10 scale, with an optional
free-text comment. Responses are buckets: 9-10 promoter, 7-8 passive, 0-6
detractor; the NPS is ``%promoters - %detractors``.

Complaint clustering: any comment left on a response is classified into a
theme by a deterministic keyword taxonomy (``_COMPLAINT_THEMES``). The verbatim
stays on the response; the theme lands in ``cluster_tag`` so owners can see
*what* is driving detractors. The taxonomy is code (like the onboarding
CATALOG) — versioned with the app, no seed rows.

Scheduling: the daily worker compares each active member's tenure to the
catalog. A survey due within ``SEND_WINDOW_DAYS`` of its day is delivered
(email + in-app notification); a survey whose day has long passed is recorded
as SKIPPED so a first deploy never spams existing members; a non-active member
(frozen/cancelled) has the survey skipped silently.
"""

from __future__ import annotations

import sqlalchemy as sa
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.constants import (
    MemberStatus,
    NotificationKind,
    NpsMilestone,
    NpsStatus,
    Role,
)
from app.core.security import now_utc
from app.integrations.email import send_email_safe as send_email
from app.models.membership import OrganizationMember
from app.models.nps import NpsSurvey
from app.models.user import User
from app.services.audit_service import record_audit

# Touchpoint catalog: which day, what we send.
MILESTONE_DAY: dict[NpsMilestone, int] = {
    NpsMilestone.DAY_7: 7,
    NpsMilestone.DAY_30: 30,
    NpsMilestone.DAY_90: 90,
}

MILESTONE_ORDER: tuple[NpsMilestone, ...] = (
    NpsMilestone.DAY_7,
    NpsMilestone.DAY_30,
    NpsMilestone.DAY_90,
)

# A survey this many days past its due day is still delivered (worker downtime /
# long weekend). Further out it is recorded silently as SKIPPED.
SEND_WINDOW_DAYS = 7

# Prompt copy per touchpoint, keyed by milestone.
_PROMPT: dict[NpsMilestone, tuple[str, str]] = {  # (title, body)
    NpsMilestone.DAY_7: (
        "How are your first 7 days going?",
        "Quick one: on a scale of 0-10, how likely are you to recommend us after your first week?",
    ),
    NpsMilestone.DAY_30: (
        "One month in — how are we doing?",
        "How likely are you to recommend us? It takes less than a minute and shapes what we improve.",
    ),
    NpsMilestone.DAY_90: (
        "90 days with us — how's it been?",
        "How likely are you to recommend us after three months? Tell us what to keep and what to fix.",
    ),
}

# Complaint theme taxonomy for free-text comments. First match wins. ``other``
# is the fallback. Keywords are lower-cased and matched as substrings.
_COMPLAINT_THEMES: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "billing",
        (
            "bill",
            "billing",
            "charge",
            "charged",
            "overcharge",
            "invoice",
            "price",
            "pricing",
            "cost",
            "expensive",
            "afford",
            "fee",
            "fees",
            "money",
            "pay",
            "payment",
            "refund",
            "renew",
            "renewal",
            "subscription",
        ),
    ),
    (
        "trainers",
        (
            "trainer",
            "trainers",
            "coach",
            "instructor",
            "pt",
            "personal training",
            "personal trainer",
            "uninterested",
            "unprepared",
        ),
    ),
    (
        "classes",
        (
            "class",
            "classes",
            "session",
            "booking",
            "booked",
            "schedule",
            "timetable",
            "timeslot",
            "time slot",
            "cancel",
            "cancelled",
            "cancellation",
            "reschedule",
            "waitlist",
            "full",
        ),
    ),
    (
        "facilities",
        (
            "equipment",
            "machine",
            "machines",
            "weights",
            "treadmill",
            "dumbbell",
            "bike",
            "locker",
            "lockers",
            "shower",
            "showers",
            "toilet",
            "washroom",
            "sauna",
            "broken",
            "dirty",
            "filthy",
            "clean",
            "cleanliness",
            "smell",
            "ventilation",
            "ac",
            "air conditioning",
            "crowded",
            "crowd",
            "space",
            "parking",
            "music",
            "music too loud",
            "hot",
            "cold",
        ),
    ),
    (
        "staff",
        (
            "staff",
            "front desk",
            "reception",
            "receptionist",
            "service",
            "customer service",
            "ignored",
            "unprofessional",
            "rude",
            "unhelpful",
            "unfriendly",
            "welcoming",
            "greeted",
        ),
    ),
    (
        "app",
        (
            "app",
            "website",
            "web",
            "portal",
            "login",
            "log in",
            "qr",
            "code",
            "online booking",
            "online payment",
            "notification",
            "mobile",
        ),
    ),
    ("other", ()),
)


def cluster_complaint(comment: str | None) -> str | None:
    """Classify a free-text comment into a complaint theme (or None)."""

    if not comment or not comment.strip():
        return None
    text = comment.lower()
    for theme, keywords in _COMPLAINT_THEMES:
        if theme == "other":
            continue
        if any(kw in text for kw in keywords):
            return theme
    return "other"


def _survey_dict(survey: NpsSurvey, *, member_active: bool) -> dict:
    status = survey.status.value if hasattr(survey.status, "value") else str(survey.status)
    return {
        "id": survey.id,
        "milestone": survey.milestone.value
        if hasattr(survey.milestone, "value")
        else str(survey.milestone),
        "status": status,
        "open": status == NpsStatus.SENT.value and member_active,
        "sent_at": survey.sent_at,
        "responded_at": survey.responded_at,
        "score": survey.score,
        "comment": survey.comment,
        "cluster_tag": survey.cluster_tag,
    }


# ------------------------------------------------------------------- helpers
async def _get_member(session: AsyncSession, org_id: str, member_id: str) -> OrganizationMember:
    member = await session.get(OrganizationMember, member_id)
    if member is None or member.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Member not found in this organization.")
    return member


async def _get_survey(session, *, org_id: str, member_id: str, survey_id: str) -> NpsSurvey:
    survey = await session.get(NpsSurvey, survey_id)
    if survey is None or survey.organization_id != org_id or survey.member_id != member_id:
        raise HTTPException(status_code=404, detail="Survey not found for this member.")
    return survey


async def _notify_member(
    session: AsyncSession,
    member: OrganizationMember,
    *,
    milestone: NpsMilestone,
    title: str,
    body: str,
) -> None:
    from app.services.notifications_service import create_notification

    user = await session.get(User, member.user_id)
    if user is not None:
        await send_email(user.email, title, body)
    await create_notification(
        session,
        org_id=member.organization_id,
        recipient_user_id=member.user_id,
        category=NotificationKind.NPS,
        title=title,
        body=body,
        data={"milestone": milestone.value, "member_id": member.id},
    )


# ------------------------------------------------------------- member facing
async def member_payload(session: AsyncSession, *, org_id: str, member_id: str) -> dict:
    member = await _get_member(session, org_id, member_id)
    active = member.member_status == MemberStatus.ACTIVE
    rows = (
        (
            await session.execute(
                select(NpsSurvey).where(
                    NpsSurvey.organization_id == org_id,
                    NpsSurvey.member_id == member_id,
                )
            )
        )
        .scalars()
        .all()
    )
    rows = sorted(rows, key=lambda s: s.sent_at)

    sent = {r.milestone for r in rows if r.status in (NpsStatus.SENT, NpsStatus.RESPONDED)}
    tenure = max(0, (now_utc() - (member.joined_at or now_utc())).days)
    next_milestone: str | None = None
    days_until_next: int | None = None
    if active:
        for m in MILESTONE_ORDER:
            if m in sent:
                continue
            due = MILESTONE_DAY[m] - tenure
            next_milestone = m.value
            days_until_next = max(0, due)
            break

    return {
        "eligible": active,
        "next_milestone": next_milestone,
        "days_until_next": days_until_next,
        "surveys": [_survey_dict(s, member_active=active) for s in rows],
    }


async def submit_response(
    session: AsyncSession,
    *,
    org_id: str,
    member_id: str,
    survey_id: str,
    score: int,
    comment: str | None = None,
    actor_user_id: str | None = None,
) -> NpsSurvey:
    """Record a member's NPS answer. Idempotent: a repeat submit returns the
    already-recorded response unchanged (Security rule: no double apply).
    """

    survey = await _get_survey(session, org_id=org_id, member_id=member_id, survey_id=survey_id)
    if survey.status == NpsStatus.RESPONDED:
        return survey
    if survey.status != NpsStatus.SENT:
        raise HTTPException(status_code=409, detail="This survey is no longer open.")

    if not 0 <= score <= 10:
        raise HTTPException(status_code=422, detail="Score must be between 0 and 10.")

    survey.score = score
    survey.comment = comment
    survey.cluster_tag = cluster_complaint(comment)
    survey.status = NpsStatus.RESPONDED
    survey.responded_at = now_utc()
    session.add(survey)

    await record_audit(
        session,
        action="nps.responded",
        organization_id=org_id,
        actor_user_id=actor_user_id,
        entity_type="nps_survey",
        entity_id=survey.id,
        metadata={
            "member_id": member_id,
            "milestone": survey.milestone.value
            if hasattr(survey.milestone, "value")
            else str(survey.milestone),
            "score": score,
            "cluster_tag": survey.cluster_tag,
        },
    )
    return survey


# ------------------------------------------------------------------- worker
async def _fire_survey(
    session: AsyncSession, *, member: OrganizationMember, milestone: NpsMilestone, send: bool
) -> NpsSurvey:
    survey = NpsSurvey(
        organization_id=member.organization_id,
        member_id=member.id,
        milestone=milestone,
        status=NpsStatus.SENT if send else NpsStatus.SKIPPED,
        sent_at=now_utc(),
    )
    session.add(survey)
    if send:
        title, body = _PROMPT[milestone]
        await _notify_member(session, member, milestone=milestone, title=title, body=body)
    return survey


async def sweep(session: AsyncSession, *, org_id: str) -> dict:
    """Daily per-org sweep: fire due surveys, skip off-window ones silently.

    Delivers each survey at most once per (member, milestone); re-running the
    sweep is safe because a delivered/recorded survey is never re-created.
    """

    members = (
        (
            await session.execute(
                select(OrganizationMember).where(
                    OrganizationMember.organization_id == org_id,
                    OrganizationMember.role == Role.MEMBER,
                    OrganizationMember.joined_at != None,  # noqa: E711
                )
            )
        )
        .scalars()
        .all()
    )

    existing: dict[tuple[str, NpsMilestone], NpsStatus] = {}
    for row in (
        (await session.execute(select(NpsSurvey).where(NpsSurvey.organization_id == org_id)))
        .scalars()
        .all()
    ):
        existing[(row.member_id, row.milestone)] = row.status

    now = now_utc()
    sent = skipped = 0
    for member in members:
        tenure = max(0, (now - (member.joined_at or now)).days)
        active = member.member_status == MemberStatus.ACTIVE
        for milestone in MILESTONE_ORDER:
            if (member.id, milestone) in existing or tenure < MILESTONE_DAY[milestone]:
                continue
            if not active or tenure - MILESTONE_DAY[milestone] > SEND_WINDOW_DAYS:
                await _fire_survey(session, member=member, milestone=milestone, send=False)
                skipped += 1
            else:
                await _fire_survey(session, member=member, milestone=milestone, send=True)
                sent += 1
    return {"members": len(members), "sent": sent, "skipped": skipped}


# -------------------------------------------------------------------- reads
def _nps(promoters: int, detractors: int, responded: int) -> float | None:
    if responded == 0:
        return None
    return round(100 * (promoters - detractors) / responded, 1)


def _bucket(score: int) -> str:
    if score >= 9:
        return "promoter"
    if score >= 7:
        return "passive"
    return "detractor"


async def summary(session: AsyncSession, *, org_id: str) -> dict:
    rows = (
        (await session.execute(select(NpsSurvey).where(NpsSurvey.organization_id == org_id)))
        .scalars()
        .all()
    )
    responded = [
        (s, s.score) for s in rows if s.status == NpsStatus.RESPONDED and s.score is not None
    ]
    delivered = [s for s in rows if s.status in (NpsStatus.SENT, NpsStatus.RESPONDED)]

    promoters = sum(1 for _, sc in responded if _bucket(sc) == "promoter")
    passives = sum(1 for _, sc in responded if _bucket(sc) == "passive")
    detractors = sum(1 for _, sc in responded if _bucket(sc) == "detractor")
    rate = round(len(responded) / len(delivered) * 100, 1) if delivered else None

    by_milestone: list[dict] = []
    for milestone in MILESTONE_ORDER:
        ms_rows = [s for s in rows if s.milestone == milestone]
        ms_resp = [(s, sc) for s, sc in responded if s.milestone == milestone]
        ms_delivered = [s for s in ms_rows if s.status in (NpsStatus.SENT, NpsStatus.RESPONDED)]
        mp = sum(1 for _, sc in ms_resp if _bucket(sc) == "promoter")
        md = sum(1 for _, sc in ms_resp if _bucket(sc) == "detractor")
        by_milestone.append(
            {
                "milestone": milestone.value if hasattr(milestone, "value") else str(milestone),
                "sent": len(ms_delivered),
                "responded": len(ms_resp),
                "response_rate": round(len(ms_resp) / len(ms_delivered) * 100, 1)
                if ms_delivered
                else None,
                "nps_score": _nps(mp, md, len(ms_resp)),
            }
        )

    return {
        "responded": len(responded),
        "response_rate": rate,
        "nps_score": _nps(promoters, detractors, len(responded)),
        "promoters": promoters,
        "passives": passives,
        "detractors": detractors,
        "by_milestone": by_milestone,
    }


def _member_name(member: OrganizationMember, user: User | None) -> str:
    return (
        member.display_name
        or (user.full_name if user else None)
        or (user.email if user else member.id)
    )


async def responses(
    session: AsyncSession, *, org_id: str, limit: int = 100, milestone: NpsMilestone | None = None
) -> list[dict]:
    stmt = (
        select(NpsSurvey, OrganizationMember, User)
        .select_from(NpsSurvey)
        .join(OrganizationMember)
        .outerjoin(User)
        .where(
            NpsSurvey.organization_id == org_id,
            NpsSurvey.status == NpsStatus.RESPONDED,
        )
    )
    if milestone is not None:
        stmt = stmt.where(NpsSurvey.milestone == milestone)
    rows = (
        await session.execute(
            stmt.order_by(sa.cast(NpsSurvey.responded_at, sa.DateTime).desc()).limit(
                max(1, min(limit, 500))
            )
        )
    ).all()

    out: list[dict] = []
    for survey, member, user in rows:
        name = _member_name(member, user)
        out.append(
            {
                "id": survey.id,
                "member_id": survey.member_id,
                "member_name": name,
                "member_email": user.email if user else None,
                "milestone": survey.milestone.value
                if hasattr(survey.milestone, "value")
                else str(survey.milestone),
                "score": survey.score,
                "comment": survey.comment,
                "cluster_tag": survey.cluster_tag,
                "sent_at": survey.sent_at,
                "responded_at": survey.responded_at,
            }
        )
    return out


async def clusters(session: AsyncSession, *, org_id: str) -> list[dict]:
    """Group responses that carry a free-text comment by complaint theme.

    Owners see what is driving detractors (and any passive feedback) at a
    glance; ``examples`` are the most recent verbatims per theme.
    """

    rows = await responses(session, org_id=org_id, limit=500)
    themes: dict[str, dict] = {}
    for r in rows:
        comment = r.get("comment")
        if not comment or not comment.strip():
            continue
        theme = r.get("cluster_tag") or "other"
        bucket = themes.setdefault(
            theme,
            {
                "theme": theme,
                "total": 0,
                "detractors": 0,
                "passives": 0,
                "promoters": 0,
                "examples": [],
            },
        )
        bucket["total"] += 1
        bucket[f"{_bucket(r['score'])}s"] += 1
        bucket["examples"].append(comment.strip())
    return sorted(themes.values(), key=lambda t: t["total"], reverse=True)


async def member_surveys(session: AsyncSession, *, org_id: str, member_id: str) -> dict:
    member = await _get_member(session, org_id, member_id)
    payload = await member_payload(session, org_id=org_id, member_id=member_id)
    user = await session.get(User, member.user_id)
    payload["member_name"] = _member_name(member, user)
    payload["member_email"] = user.email if user else None
    return payload
