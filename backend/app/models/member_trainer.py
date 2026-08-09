"""MemberTrainer: links a trainer (staff) to a member they coach.

One member can have several trainers (e.g. a strength coach plus a conditioning
coach). Only one *active* row exists per (member, trainer) pair — assigning the
same trainer again is idempotent. Unassigning flips ``active`` off so the full
assignment history is preserved for audit (Security Rule #10).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field

from app.models.base import TimestampModel, UUIDModel, utcnow


class MemberTrainer(UUIDModel, TimestampModel, table=True):
    __tablename__ = "member_trainers"
    __table_args__ = (
        UniqueConstraint(
            "organization_id", "member_id", "trainer_member_id", "active",
            name="uq_member_trainer_active",
        ),
    )

    organization_id: str = Field(index=True, foreign_key="organizations.id")
    member_id: str = Field(index=True, foreign_key="organization_members.id")
    trainer_member_id: str = Field(index=True, foreign_key="organization_members.id")

    assigned_by: str | None = Field(default=None, foreign_key="users.id")
    assigned_at: datetime = Field(default_factory=utcnow)
    active: bool = Field(default=True, index=True)
