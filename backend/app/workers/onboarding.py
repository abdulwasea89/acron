"""Onboarding journey worker (#32).

Runs once a day per org. Delegates to ``onboarding_service.progress_journeys``
which backfills missing journeys, advances the clock, fires due milestones,
raises "going quiet" staff tasks, and closes journeys at day 90.

Mirrors the other workers (``notifications``, ``payroll_runner``): a plain async
function callable inline in tests, wrapped by a Celery task in ``celery_app``.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.onboarding_service import progress_journeys


async def run_onboarding_progression(session: AsyncSession, *, org_id: str) -> dict:
    """Advance every journey in one org. Returns a small counts summary."""

    return await progress_journeys(session, org_id=org_id)
