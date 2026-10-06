"""Gamification: challenges, visit streaks, leaderboards (#38).

Retention is prevented, not rescued: a streak gives a member a reason to show
up before the churn-score even flags them. This module owns three pieces:

* ``GymChallenge`` — an org-defined goal (N visits, N classes, or a streak
  length) with a reward, published for a date window. Gym-defined, like plans;
  no seed rows.
* ``MemberChallengeProgress`` — one row per (challenge, member), counting how
  far each member has come. ``completed_at`` is set exactly once; a completion
  notification/celebration fires only on that transition, so the daily worker
  is idempotent.
* ``MemberStreak`` — the consecutive active-day visit streak per member and its
  personal best, maintained by the daily worker from the existing
  ``Attendance`` stream (no new data capture).

The member is the grit of the whole retention mesh: a broken streak is itself
an early churn signal the inactivity ladder (#35) can pick up.
"""

from __future__ import annotations

from datetime import datetime, date

from sqlmodel import Field, UniqueConstraint

from app.core.constants import (
    ChallengeGoalType,
    ChallengeProgressStatus,
    ChallengeStatus,
)
from app.models.base import TimestampModel, UUIDModel, utcnow


class GymChallenge(UUIDModel, TimestampModel, table=True):
    __tablename__ = "gym_challenges"

    organization_id: str = Field(index=True, foreign_key="organizations.id")

    title: str
    description: str | None = None

    goal_type: ChallengeGoalType = Field(index=True)
    goal_target: int = Field(default=1)  # visits/classes/streak-days
    reward: str | None = None  # e.g. "20% off next month"

    status: ChallengeStatus = Field(default=ChallengeStatus.DRAFT, index=True)
    is_public: bool = Field(default=True)  # shown to all members

    starts_at: datetime = Field(index=True)
    ends_at: datetime = Field(index=True)

    created_by_member_id: str | None = Field(default=None, foreign_key="organization_members.id")
    published_at: datetime | None = None


class MemberChallengeProgress(UUIDModel, TimestampModel, table=True):
    __tablename__ = "member_challenge_progress"
    __table_args__ = (
        UniqueConstraint("challenge_id", "member_id", name="uq_member_challenge_progress"),
    )

    organization_id: str = Field(index=True, foreign_key="organizations.id")
    challenge_id: str = Field(index=True, foreign_key="gym_challenges.id")
    member_id: str = Field(index=True, foreign_key="organization_members.id")

    status: ChallengeProgressStatus = Field(default=ChallengeProgressStatus.ACTIVE, index=True)
    progress: int = Field(default=0)  # units already counted
    started_at: datetime = Field(default_factory=utcnow)
    completed_at: datetime | None = None


class MemberStreak(UUIDModel, TimestampModel, table=True):
    __tablename__ = "member_streaks"
    __table_args__ = (
        UniqueConstraint("organization_id", "member_id", name="uq_member_streak_org_member"),
    )

    organization_id: str = Field(index=True, foreign_key="organizations.id")
    member_id: str = Field(index=True, foreign_key="organization_members.id")

    current_streak: int = Field(default=0)
    best_streak: int = Field(default=0)
    last_active_date: date | None = Field(default=None)
