"""Staff schemas: invites, shifts, tasks (Sections 15.2, 16.2, 17.1)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.core.constants import Role


class StaffInviteCreate(BaseModel):
    role: Role = Role.TRAINER
    email: str | None = None


class StaffInviteOut(BaseModel):
    id: str
    code: str
    role: str
    email: str | None
    used: bool


class StaffInviteRedeem(BaseModel):
    code: str
    full_name: str
    password: str


class ShiftOut(BaseModel):
    id: str
    staff_member_id: str
    checked_in_at: datetime
    checked_out_at: datetime | None
    status: str
    hours: float


class CompensationUpdate(BaseModel):
    fixed_monthly_salary: float | None = None
    hourly_rate: float | None = None
    per_class_rate: float | None = None
    commission_rate: float | None = None


class TaskCreateIn(BaseModel):
    title: str
    description: str | None = None
    assignee_member_id: str | None = None
    deadline: datetime | None = None


class TaskUpdateIn(BaseModel):
    title: str | None = None
    description: str | None = None
    assignee_member_id: str | None = None
    deadline: datetime | None = None


class TaskOut(BaseModel):
    id: str
    title: str
    description: str | None
    assignee_member_id: str | None
    deadline: datetime | None
    done: bool
