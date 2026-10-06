"""Net Promoter surveys at day 7 / 30 / 90 (#37).

The blueprint wants the signal a member would not give an owner face-to-face:
"How likely are you to recommend us?" at three touchpoints of the first 90
days. One row per (member, milestone) so each survey fires exactly once per
membership. The *milestone catalog* (which days, what copy) is code in
``nps_service``, matching the onboarding CATALOG pattern.

A response is a 0-10 score plus an optional free-text comment. Comments on
non-promoter responses are classified into a complaint theme
(``cluster_tag``) by a deterministic keyword taxonomy so owners can see what
is actually driving detractors without reading fifty verbatims.
"""

from __future__ import annotations

from datetime import datetime

from sqlmodel import Field, UniqueConstraint

from app.core.constants import NpsMilestone, NpsStatus
from app.models.base import TimestampModel, UUIDModel


class NpsSurvey(UUIDModel, TimestampModel, table=True):
    __tablename__ = "nps_surveys"
    __table_args__ = (
        UniqueConstraint("member_id", "milestone", name="uq_nps_survey_member_milestone"),
    )

    organization_id: str = Field(index=True, foreign_key="organizations.id")
    member_id: str = Field(index=True, foreign_key="organization_members.id")

    milestone: NpsMilestone = Field(index=True)  # day_7 | day_30 | day_90
    status: NpsStatus = Field(default=NpsStatus.SENT, index=True)

    sent_at: datetime = Field(index=True)  # when delivered (or silently skipped)
    responded_at: datetime | None = None

    score: int | None = Field(default=None)  # 0..10
    comment: str | None = Field(default=None)
    cluster_tag: str | None = Field(default=None)  # complaint theme, if a comment was left
