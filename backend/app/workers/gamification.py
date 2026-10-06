"""Daily worker: advance streaks and challenge progress (#38).

The beat task runs every morning per org; the sweep is idempotent — a member's
``completed_at`` fires exactly once, and streak milestones only celebrate on the
day they are first reached.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.services import gamification_service as gamification


async def run_gamification_sweep(session: AsyncSession, *, org_id: str) -> dict:
    return await gamification.sweep(session, org_id=org_id)
