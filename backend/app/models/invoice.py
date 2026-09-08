"""Invoice: a B2B invoice issued to a company (office vertical).

Invoices are the only money instrument in the office vertical (requires_connect
is false; no Stripe, no card path). They are drawn from a CompanyContract for a
billing term; settlement records a Payment(kind=SPACE, method=bank_transfer|cash,
invoice_id=...) against this row. Line items are snapshotted as a JSON string so
re-pricing a plan never rewrites an issued invoice.
"""

from __future__ import annotations

from datetime import date, datetime

from sqlmodel import Field, UniqueConstraint

from app.models.base import TimestampModel, UUIDModel


class Invoice(UUIDModel, TimestampModel, table=True):
    __tablename__ = "invoices"
    __table_args__ = (
        # Numbering is per-org monotonic (INV-2026-0001 …), so the number is only
        # unique within a tenant.
        UniqueConstraint("organization_id", "invoice_number", name="uq_invoices_org_number"),
    )

    organization_id: str = Field(index=True, foreign_key="organizations.id")
    company_id: str = Field(index=True, foreign_key="companies.id")
    contract_id: str | None = Field(default=None, foreign_key="company_contracts.id")

    invoice_number: str
    issue_date: date
    due_date: date

    # draft | sent | partial | paid | overdue | void
    # overdue is derived from sent + due_date in list queries; never stored.
    status: str = Field(default="draft", index=True)

    subtotal: float
    tax_amount: float = 0.0
    total: float
    currency: str = "USD"

    # Snapshot lines, e.g. [{description, quantity, unit_amount, amount}].
    line_items_json: str | None = None
    notes: str | None = None

    paid_at: datetime | None = None
