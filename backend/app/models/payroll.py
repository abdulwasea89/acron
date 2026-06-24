"""Payroll models: runs, per-staff entries, and advance requests (Section 15)."""

from __future__ import annotations

from datetime import date, datetime

from sqlmodel import Field

from app.core.constants import AdvanceStatus, PayoutMethod, PayrollStatus
from app.models.base import TimestampModel, UUIDModel


class PayrollRun(UUIDModel, TimestampModel, table=True):
    __tablename__ = "payroll_runs"

    organization_id: str = Field(index=True, foreign_key="organizations.id")
    period_start: date
    period_end: date
    status: PayrollStatus = Field(default=PayrollStatus.DRAFT, index=True)
    total_gross: float = 0.0
    total_deductions: float = 0.0
    total_net: float = 0.0
    locked_at: datetime | None = None
    finalized_at: datetime | None = None
    paid_at: datetime | None = None
    created_by: str | None = Field(default=None, foreign_key="users.id")


class PayrollEntry(UUIDModel, TimestampModel, table=True):
    __tablename__ = "payroll_entries"

    organization_id: str = Field(index=True, foreign_key="organizations.id")
    payroll_run_id: str = Field(index=True, foreign_key="payroll_runs.id")
    staff_member_id: str = Field(index=True, foreign_key="organization_members.id")

    # Components (Section 15.1 / 15.3)
    fixed: float = 0.0
    hourly_amount: float = 0.0
    hours_worked: float = 0.0
    class_amount: float = 0.0
    classes_taught: int = 0
    commission_amount: float = 0.0
    bonus: float = 0.0
    deductions: float = 0.0
    advance_repayment: float = 0.0
    net: float = 0.0

    payout_method: PayoutMethod = Field(default=PayoutMethod.BANK_TRANSFER)
    pay_stub_url: str | None = None
    notes: str | None = None
    trainer_confirmed: bool = False  # for cash payouts (Section 15.6)


class PayAdvance(UUIDModel, TimestampModel, table=True):
    __tablename__ = "pay_advances"

    organization_id: str = Field(index=True, foreign_key="organizations.id")
    staff_member_id: str = Field(index=True, foreign_key="organization_members.id")
    amount: float = 0.0
    status: AdvanceStatus = Field(default=AdvanceStatus.REQUESTED, index=True)
    repayment_per_period: float = 0.0
    repaid_amount: float = 0.0
    approved_by: str | None = Field(default=None, foreign_key="users.id")
    note: str | None = None
