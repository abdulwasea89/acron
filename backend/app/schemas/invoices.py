"""Office vertical: B2B invoice schemas."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel

# Stored invoice statuses. "overdue" is never stored — it is derived from a
# sent/partial invoice whose due date has passed.
OPEN_STATUSES = {"draft", "sent", "partial"}
UNPAID_STATUSES = {"sent", "partial"}  # counts toward outstanding balance


def effective_status(status: str, due_date: date, today: date | None = None) -> str:
    """Return the status to display, deriving ``overdue`` for late open invoices."""
    if status in UNPAID_STATUSES and due_date < (today or date.today()):
        return "overdue"
    return status


class InvoiceIssue(BaseModel):
    """Draw the next term's invoice for a contract (renewal)."""

    contract_id: str


class InvoiceOut(BaseModel):
    id: str
    invoice_number: str
    company_id: str
    company_name: str | None = None
    contract_id: str | None
    issue_date: date
    due_date: date
    status: str
    subtotal: float
    tax_amount: float
    total: float
    currency: str
    line_items: list[dict] = []
    notes: str | None
    paid_amount: float = 0.0
    paid_at: datetime | None


class InvoiceRecordPayment(BaseModel):
    """Settle an invoice offline (bank transfer / cash) — office B2B money."""

    method: str  # bank_transfer | cash
    amount: float | None = None  # None = pay the remaining balance
    note: str | None = None
    paid_on: date | None = None  # when the company actually paid


class InvoicePaymentOut(BaseModel):
    id: str
    invoice_id: str
    method: str
    amount: float
    currency: str
    note: str | None
    paid_at: datetime
