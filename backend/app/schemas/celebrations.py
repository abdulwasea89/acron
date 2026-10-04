"""Celebration schemas (#36)."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class CelebrationOut(BaseModel):
    member_id: str
    name: str | None = None
    kind: str
    key: str
    title: str
    sent_at: datetime


class UpcomingCelebrationOut(BaseModel):
    member_id: str
    name: str | None = None
    kind: str
    on: date
    days_away: int
    detail: str | None = None
