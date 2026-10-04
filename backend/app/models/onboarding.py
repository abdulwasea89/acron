"""90-day onboarding journey (#32).

The blueprint calls the first 90 days the make-or-break window for a new gym
member. A journey is a tenant-scoped clock per member: it starts when the member
becomes ACTIVE, advances one day per calendar day, and carries one progress row
per milestone. Non-attendance is the strongest churn predictor, so the journey
also tracks visits and lets the daily worker raise staff interventions when a
member goes quiet.

Two tables:

* ``OnboardingJourney`` — one row per member; the clock + status + counters.
* ``OnboardingMilestoneProgress`` — one row per (journey, milestone) once the
  milestone has fired; records whether the member/staff closed it.

The milestone *catalog* itself is code (``onboarding_service.CATALOG``) so it is
versioned with the app and needs no per-tenant seed rows.
"""

from __future__ import annotations

from datetime import datetime

from sqlmodel import Field, UniqueConstraint

from app.core.constants import MilestoneStatus, OnboardingStatus
from app.models.base import TimestampModel, UUIDModel


class OnboardingJourney(UUIDModel, TimestampModel, table=True):
    __tablename__ = "onboarding_journeys"
    __table_args__ = (
        UniqueConstraint("organization_id", "member_id", name="uq_onboarding_journey_org_member"),
    )

    organization_id: str = Field(index=True, foreign_key="organizations.id")
    member_id: str = Field(index=True, foreign_key="organization_members.id")

    status: OnboardingStatus = Field(default=OnboardingStatus.ACTIVE, index=True)

    started_at: datetime = Field(index=True)
    completed_at: datetime | None = Field(default=None)

    # 0..90; advanced by the daily worker from ``started_at``.
    current_day: int = Field(default=0)

    # Assigned coach/owner for the check-ins (optional).
    assigned_trainer_id: str | None = Field(
        default=None, foreign_key="organization_members.id"
    )

    # Counters maintained by the daily worker (denormalized for the UI).
    visits_total: int = Field(default=0)
    visits_last_7d: int = Field(default=0)
    classes_attended: int = Field(default=0)

    # Set once the "going quiet" intervention task has been raised, so the worker
    # does not open a new task every day.
    quiet_flag_at: datetime | None = Field(default=None)

    note: str | None = Field(default=None)


class OnboardingMilestoneProgress(UUIDModel, TimestampModel, table=True):
    __tablename__ = "onboarding_milestone_progress"
    __table_args__ = (
        UniqueConstraint("journey_id", "code", name="uq_onboarding_progress_journey_code"),
    )

    organization_id: str = Field(index=True, foreign_key="organizations.id")
    journey_id: str = Field(index=True, foreign_key="onboarding_journeys.id")
    member_id: str = Field(index=True, foreign_key="organization_members.id")

    day: int = Field(index=True)   # milestone day (0, 3, 7, 14, 30, 60, 90)
    code: str = Field(index=True)  # stable milestone key, e.g. "week_1"

    status: MilestoneStatus = Field(default=MilestoneStatus.PENDING, index=True)
    completed_at: datetime | None = Field(default=None)
    completed_by: str | None = Field(default=None, foreign_key="organization_members.id")
    notes: str | None = Field(default=None)
