"""Worker: fire due scheduled campaigns (#39).

Every few minutes per org, campaigns whose ``scheduled_at`` has arrived are
sent. Sending is resume-safe: the unique (campaign, member) delivery pair means
a re-run never double-sends a member already marked done.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.services import campaign_service as campaigns


async def run_due_campaigns(session: AsyncSession, *, org_id: str) -> dict:
    return await campaigns.run_due_campaigns(session, org_id=org_id)
