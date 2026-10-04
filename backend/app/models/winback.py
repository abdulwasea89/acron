"""Win-back outreach to lapsed members (#36).

One row each time we reach out to a member who has lapsed (expired/cancelled),
and the recovery outcome when they come back. Multiple rows per member are
allowed, so a member who lapses again later can be won back again; the latest
``contacted`` row is the one a reactivation resolves.
"""

from __future__ import annotations

from datetime import datetime

from sqlmodel import Field

from app.core.constants import WinBackStatus
from app.models.base import TimestampModel, UUIDModel


class WinBackAttempt(UUIDModel, TimestampModel, table=True):
    __tablename__ = "win_back_attempts"

    organization_id: str = Field(index=True, foreign_key="organizations.id")
    member_id: str = Field(index=True, foreign_key="organization_members.id")

    status: WinBackStatus = Field(default=WinBackStatus.CONTACTED, index=True)
    offer_text: str | None = None
    channel: str = Field(default="email")

    contacted_at: datetime = Field(index=True)
    recovered_at: datetime | None = None
    recovered_amount: float | None = None
