"""Payroll schemas (Section 15)."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel

from app.core.constants import PayoutMethod


class PayrollRunCreate(BaseModel):
    period_start: date
    period_end: date


class PayrollEntryOut(BaseModel):
    id: str
    staff_member_id: str
    fixed: float
    hourly_amount: float
    hours_worked: float
    class_amount: float
    classes_taught: int
    commission_amount: float
    bonus: float
    deductions: float
    advance_repayment: float
    net: float
    payout_method: str
    pay_stub_url: str | None
    notes: str | None


class PayrollRunOut(BaseModel):
    id: str
    period_start: date
    period_end: date
    status: str
    total_gross: float
    total_deductions: float
    total_net: float
    entries: list[PayrollEntryOut] = []


class EntryAdjust(BaseModel):
    """Each manual change requires a note (audit trail, Section 15.2)."""

    bonus: float | None = None
    deductions: float | None = None
    payout_method: PayoutMethod | None = None
    note: str


class AdvanceRequest(BaseModel):
    amount: float
    repayment_per_period: float


class AdvanceDecision(BaseModel):
    approve: bool
    repayment_per_period: float | None = None


class AdvanceOut(BaseModel):
    id: str
    staff_member_id: str
    amount: float
    status: str
    repayment_per_period: float
    repaid_amount: float
