"""Request/response schemas for challenges, streaks, leaderboards (#38)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core.constants import ChallengeGoalType, ChallengeStatus


class ChallengeCreateIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    goal_type: ChallengeGoalType = Field(default=ChallengeGoalType.VISITS)
    goal_target: int = Field(ge=1, le=999)
    reward: str | None = Field(default=None, max_length=200)
    is_public: bool = True
    starts_at: datetime
    ends_at: datetime


class ChallengeStatusIn(BaseModel):
    status: ChallengeStatus


class ChallengeParticipantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    member_id: str
    member_name: str
    progress: int
    status: str
    completed_at: datetime | None = None


class ChallengeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str | None = None
    goal_type: str
    goal_target: int
    reward: str | None = None
    status: str
    is_public: bool
    starts_at: datetime
    ends_at: datetime
    published_at: datetime | None = None


class ChallengeCountOut(ChallengeOut):
    participants: int


class MemberChallengeOut(ChallengeOut):
    active: bool
    progress: int
    challenge_status: str
    completed: bool
    completed_at: datetime | None = None


class MemberGamificationOut(BaseModel):
    streak: dict
    challenges: list[MemberChallengeOut]


class LeaderboardEntryOut(BaseModel):
    rank: int
    member_id: str
    member_name: str
    check_ins: int


LeaderboardPeriod = Literal["week", "month", "all"]


class ChallengeDetailOut(ChallengeOut):
    participants: list[ChallengeParticipantOut]


class SweepOut(BaseModel):
    challenges: int
    members: int
    completed: int
    streaks_updated: int
    streak_celebrations: int
