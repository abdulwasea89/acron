"""Inactivity-ladder schemas (#35)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class LadderRungOut(BaseModel):
    day: int
    code: str
    name: str
    member_action: str | None = None
    staff_action: str | None = None
    email_subject: str | None = None
    email_body: str | None = None
    is_active: bool = True


class LadderRungUpdateIn(BaseModel):
    member_action: str | None = None
    staff_action: str | None = None
    email_subject: str | None = None
    email_body: str | None = None
    is_active: bool | None = None


class MemberLadderRungOut(BaseModel):
    day: int
    code: str
    name: str
    member_action: str | None = None
    staff_action: str | None = None
    is_active: bool = True
    due: bool = False
    fired_at: datetime | None = None
    status: str | None = None
    channel: str | None = None


class MemberLadderOut(BaseModel):
    member_id: str
    name: str | None = None
    status: str
    days_inactive: int | None = None
    rungs: list[MemberLadderRungOut]
