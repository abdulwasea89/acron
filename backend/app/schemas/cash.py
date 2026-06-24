"""Cash payment logging & end-of-day reconciliation schemas (Section 11)."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel

from app.core.constants import PaymentMethod


class CashPaymentLog(BaseModel):
    """Front-desk logs an offline payment for a member (Section 11.1)."""

    member_id: str
    plan_id: str
    amount: float
    method: PaymentMethod = PaymentMethod.CASH
    note: str | None = None


class CashPaymentOut(BaseModel):
    payment_id: str
    member_id: str
    amount: float
    method: str
    member_status: str
    receipt_pdf_url: str | None = None


class ReconciliationRequest(BaseModel):
    business_date: date
    counted_total: float
    notes: str | None = None


class ReconciliationOut(BaseModel):
    id: str
    business_date: date
    system_total: float
    counted_total: float
    discrepancy: float
    performed_by: str
    alert_triggered: bool = False
