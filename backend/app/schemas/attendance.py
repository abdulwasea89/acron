"""Attendance schemas (Section 1.3, #18).

A check-in returns the visit row plus the "status on check-in" flags the front
desk needs: membership state, dues, birthday, and how long since the member was
last seen (the at-risk hint). Listing and summary shapes power the console.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class CheckInCreate(BaseModel):
    """Front-desk / QR check-in for a member (staff-initiated)."""

    member_id: str
    method: str = "manual"      # AttendanceMethod value
    note: str | None = None


class CheckInOut(BaseModel):
    """The created (or replayed) visit plus status-on-check-in flags."""

    id: str
    member_id: str
    member_name: str | None
    checked_in_at: datetime
    method: str
    source: str
    class_session_id: str | None = None
    note: str | None = None

    # ---- status on check-in ----
    membership_status: str
    payment_due: bool
    birthday_today: bool
    days_since_last_visit: int | None
    at_risk: bool
    visits_today: int


class AttendanceOut(BaseModel):
    """A single visit as shown in lists and member history."""

    id: str
    member_id: str
    member_name: str | None
    checked_in_at: datetime
    method: str
    source: str
    class_session_id: str | None = None
    note: str | None = None


class AttendanceSummary(BaseModel):
    """Front-desk console headline numbers for today."""

    today_count: int
    unique_today: int
    avg_last_7_days: float
    dormant_members: int = Field(
        description="Active members with no visit in the last 14 days."
    )


class AttendanceMember(BaseModel):
    """A member search hit for the check-in box (name/email/phone)."""

    member_id: str
    member_name: str | None
    member_email: str
    member_status: str
    phone: str | None = None

