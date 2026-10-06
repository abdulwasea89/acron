"""NPS survey worker (#37).

Runs once a day per org. Delegates to ``nps_service.sweep`` which compares each
active member's tenure against the day-7/30/90 catalog, fires due surveys
(email + in-app notification), and silently records off-window ones as SKIPPED
so a first deploy never spams existing members. Dedup is by
``(member_id, milestone)`` — re-running the sweep sends nothing twice.

Mirrors the other retention workers: a plain async function callable inline in
tests, wrapped by a Celery task in ``celery_app``.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.nps_service import sweep


async def run_nps_sweep(session: AsyncSession, *, org_id: str) -> dict:
    """Fire due NPS surveys in one org. Returns a small counts summary."""

    return await sweep(session, org_id=org_id)
