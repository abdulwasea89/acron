"""Onboarding journey schemas (#32)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class MilestoneOut(BaseModel):
    day: int
    code: str
    title: str
    member_action: str | None = None
    staff_action: str | None = None
    status: str                       # pending | completed | skipped | locked
    completed_at: datetime | None = None
    notes: str | None = None


class JourneyOut(BaseModel):
    """A member's 90-day journey with its milestones."""

    id: str
    member_id: str
    member_name: str | None = None
    status: str
    started_at: datetime
    completed_at: datetime | None = None
    current_day: int
    total_days: int
    assigned_trainer_id: str | None = None
    visits_total: int = 0
    visits_last_7d: int = 0
    classes_attended: int = 0
    at_risk: bool = False
    note: str | None = None
    milestones: list[MilestoneOut] = Field(default_factory=list)


class JourneySummaryOut(BaseModel):
    total: int
    active: int
    completed: int
    paused: int
    at_risk: int


class CompleteMilestoneIn(BaseModel):
    code: str
    notes: str | None = None


class SetJourneyStatusIn(BaseModel):
    pause: bool
