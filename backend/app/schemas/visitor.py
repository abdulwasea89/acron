"""Visitor & locker schemas (Section 1.3, #22)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class VisitorLogIn(BaseModel):
    name: str
    phone: str | None = None
    email: str | None = None
    kind: str = "walk_in"            # VisitorKind value
    host_member_id: str | None = None
    amount: float = 0.0
    method: str | None = None        # PaymentMethod value; defaults to cash for a day pass
    note: str | None = None
    locker_number: str | None = None


class VisitorOut(BaseModel):
    id: str
    name: str
    phone: str | None = None
    email: str | None = None
    kind: str
    host_member_id: str | None = None
    host_name: str | None = None
    amount: float
    method: str | None = None
    paid: bool
    locker_number: str | None = None
    note: str | None = None
    checked_in_at: datetime
    checked_out_at: datetime | None = None


class LockerIn(BaseModel):
    number: str
    note: str | None = None


class LockerAssignIn(BaseModel):
    holder_label: str
    note: str | None = None


class LockerOut(BaseModel):
    id: str
    number: str
    status: str
    holder_label: str | None = None
    assigned_at: datetime | None = None
    note: str | None = None
