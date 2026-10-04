"""Celebrations + win-back worker (#36).

Two scheduled jobs:

* ``run_celebrations`` — daily: acknowledge birthdays, anniversaries and visit
  milestones (idempotent, deduped per member/moment).
* ``run_win_back`` — weekly: send the win-back offer to lapsed members who have
  not been contacted recently.

Mirrors the other workers: plain async functions callable inline in tests.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.celebrations_service import run_sweep as _celebrations_sweep
from app.services.winback_service import run_campaign


async def run_celebrations(session: AsyncSession, *, org_id: str) -> dict:
    return await _celebrations_sweep(session, org_id=org_id)


async def run_win_back(session: AsyncSession, *, org_id: str) -> dict:
    return await run_campaign(session, org_id=org_id)
