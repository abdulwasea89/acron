"""Retention worker (#33, #34).

Daily sweep that turns the churn-risk roster into staff work: for every
high-risk member with no open retention task, open one assigned to the desk so
someone actually reaches out. Deduped per member so a member who stays at-risk
does not spawn a task every day.

Mirrors the other workers: a plain async function callable inline in tests.
"""

from __future__ import annotations

import re

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.constants import NotificationKind
from app.models.staff import Task
from app.services.retention_service import HIGH_BAND, risk_roster

_MID = re.compile(r"\[mid:([0-9a-f]+)\]")


async def run_retention_sweep(session: AsyncSession, *, org_id: str) -> dict:
    """Open one outreach task per high-risk member lacking one. Returns counts."""

    risks = await risk_roster(session, org_id=org_id, min_score=HIGH_BAND, limit=300)

    open_tasks = (
        await session.execute(
            select(Task).where(
                Task.organization_id == org_id,
                Task.done.is_(False),
                Task.title.like("[Retention]%"),
            )
        )
    ).scalars().all()
    existing: set[str] = set()
    for t in open_tasks:
        m = _MID.search(t.description or "")
        if m:
            existing.add(m.group(1))

    created = 0
    for r in risks:
        if r.member_id in existing:
            continue
        top = r.reasons[0].label if r.reasons else "at risk of leaving"
        session.add(
            Task(
                organization_id=org_id,
                title=f"[Retention] Reach out to {r.name or 'member'}",
                description=(
                    f"Churn risk {r.score}/100 — {top}. "
                    f"Attendance {r.recent_weekly}/wk vs baseline {r.baseline_weekly}/wk. "
                    f"[mid:{r.member_id}]"
                ),
            )
        )
        created += 1

    if created:
        await session.flush()
        from app.services.notifications_service import notify_org_owners

        await notify_org_owners(
            session,
            org_id=org_id,
            category=NotificationKind.SYSTEM,
            title=f"{created} member(s) flagged at churn risk",
            body="Open the retention list to see who is drifting and assign outreach.",
            data={"created": created},
        )

    return {"high_risk": len(risks), "tasks_created": created}


async def run_inactivity_ladder(session: AsyncSession, *, org_id: str) -> dict:
    """Fire due inactivity-ladder rungs for one org (#35)."""

    from app.services.inactivity_ladder_service import run_sweep

    return await run_sweep(session, org_id=org_id)
