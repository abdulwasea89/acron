"""Inactivity ladder config + firing log (#35).

The rung table holds a gym's editable escalation (day → action). The progress
table records each time a rung fired for a member, so outreach is deduplicated
per inactivity episode and the history survives a re-engagement.
"""

from __future__ import annotations

from datetime import datetime

from sqlmodel import Field, UniqueConstraint

from app.core.constants import LadderStatus
from app.models.base import TimestampModel, UUIDModel


class InactivityLadderRung(UUIDModel, TimestampModel, table=True):
    __tablename__ = "inactivity_ladder_rungs"
    __table_args__ = (
        UniqueConstraint("organization_id", "day", name="uq_inactivity_rung_org_day"),
    )

    organization_id: str = Field(index=True, foreign_key="organizations.id")

    day: int = Field(index=True)        # days of inactivity that trigger the rung
    code: str                            # stable key, e.g. "nudge"
    name: str                            # human label, e.g. "Gentle nudge"

    member_action: str | None = None     # what the member receives (push/email)
    staff_action: str | None = None      # what staff must do (task)
    email_subject: str | None = None
    email_body: str | None = None

    is_active: bool = Field(default=True)


class InactivityLadderProgress(UUIDModel, TimestampModel, table=True):
    __tablename__ = "inactivity_ladder_progress"

    organization_id: str = Field(index=True, foreign_key="organizations.id")
    member_id: str = Field(index=True, foreign_key="organization_members.id")

    rung_day: int = Field(index=True)
    status: LadderStatus = Field(default=LadderStatus.FIRED, index=True)

    fired_at: datetime = Field(index=True)
    completed_at: datetime | None = None
    completed_by: str | None = Field(default=None, foreign_key="organization_members.id")
    channel: str | None = None           # e.g. "email+push+task"
