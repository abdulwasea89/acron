"""NPS survey schemas (#37)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class NpsSurveyOut(BaseModel):
    id: str
    milestone: str  # day_7 | day_30 | day_90
    status: str  # sent | responded | skipped
    open: bool = False  # awaiting this member's response
    sent_at: datetime
    responded_at: datetime | None = None
    score: int | None = None  # 0..10
    comment: str | None = None
    cluster_tag: str | None = None  # complaint theme, if a comment was left


class NpsMemberPayloadOut(BaseModel):
    """A member's surveys. ``member_name``/``member_email`` are filled for the
    admin view (`GET /nps/members/{id}`); the member self view omits them."""

    eligible: bool = True
    member_name: str | None = None
    member_email: str | None = None
    surveys: list[NpsSurveyOut] = Field(default_factory=list)
    next_milestone: str | None = None
    days_until_next: int | None = None


class NpsRespondIn(BaseModel):
    score: int = Field(ge=0, le=10)
    comment: str | None = Field(default=None, max_length=2000)


class NpsMilestoneStatsOut(BaseModel):
    milestone: str
    sent: int
    responded: int
    response_rate: float | None = None
    nps_score: float | None = None


class NpsSummaryOut(BaseModel):
    responded: int = 0
    response_rate: float | None = None
    nps_score: float | None = None
    promoters: int = 0
    passives: int = 0
    detractors: int = 0
    by_milestone: list[NpsMilestoneStatsOut] = Field(default_factory=list)


class NpsResponseAdminOut(BaseModel):
    id: str
    member_id: str
    member_name: str | None = None
    member_email: str | None = None
    milestone: str
    score: int
    comment: str | None = None
    cluster_tag: str | None = None
    sent_at: datetime
    responded_at: datetime | None = None


class NpsClusterOut(BaseModel):
    theme: str
    total: int
    detractors: int
    passives: int
    promoters: int
    examples: list[str] = Field(default_factory=list)
