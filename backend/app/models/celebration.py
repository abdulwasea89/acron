"""Member celebrations: birthdays, membership anniversaries, visit milestones.

One row per acknowledged moment, keyed by ``(member, kind, key)`` so it fires
exactly once. ``key`` is the year for a birthday, the tenure years for an
anniversary, and the threshold count for a visit milestone.
"""

from __future__ import annotations

from datetime import datetime

from sqlmodel import Field, UniqueConstraint

from app.core.constants import CelebrationKind
from app.models.base import TimestampModel, UUIDModel


class MemberCelebration(UUIDModel, TimestampModel, table=True):
    __tablename__ = "member_celebrations"
    __table_args__ = (
        UniqueConstraint("member_id", "kind", "key", name="uq_member_celebration_kind_key"),
    )

    organization_id: str = Field(index=True, foreign_key="organizations.id")
    member_id: str = Field(index=True, foreign_key="organization_members.id")

    kind: CelebrationKind = Field(index=True)
    key: str = Field(index=True)         # year / tenure-years / visit threshold

    title: str
    body: str | None = None
    sent_at: datetime = Field(index=True)
