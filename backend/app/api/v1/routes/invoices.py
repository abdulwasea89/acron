"""Office vertical: B2B invoice API (issue, send, settle, void).

Admin (owner/manager) endpoints require ``ISSUE_INVOICES``; seat-holders read
their own company's dues through ``/invoices/my-company`` (member self-service,
no payment actions — money stays web-only per Security Rule #7).
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.deps import get_session, get_tenant, require_capability, require_writable_org
from app.core.tenancy import IDEMPOTENCY_HEADER, TenantContext
from app.models.company import Company
from app.models.invoice import Invoice
from app.models.organization import Organization
from app.models.payment import Payment
from app.schemas.invoices import (
    InvoiceIssue,
    InvoiceOut,
    InvoicePaymentOut,
    InvoiceRecordPayment,
    effective_status,
)
from app.services import invoices_service as invoices
from app.core.permissions import Capability

router = APIRouter()


async def _invoice_out(session: AsyncSession, invoice: Invoice) -> InvoiceOut:
    company = await session.get(Company, invoice.company_id)
    line_items: list[dict] = []
    if invoice.line_items_json:
        try:
            parsed = json.loads(invoice.line_items_json)
            if isinstance(parsed, list):
                line_items = parsed
        except ValueError:
            line_items = []
    paid = await invoices._paid_amount(session, org_id=invoice.organization_id, invoice_id=invoice.id)
    from datetime import date as _date

    return InvoiceOut(
        id=invoice.id,
        invoice_number=invoice.invoice_number,
        company_id=invoice.company_id,
        company_name=company.name if company else None,
        contract_id=invoice.contract_id,
        issue_date=invoice.issue_date,
        due_date=invoice.due_date,
        status=effective_status(invoice.status, invoice.due_date, _date.today()),
        subtotal=invoice.subtotal,
        tax_amount=invoice.tax_amount,
        total=invoice.total,
        currency=invoice.currency,
        line_items=line_items,
        notes=invoice.notes,
        paid_amount=paid,
        paid_at=invoice.paid_at,
    )


@router.get("", response_model=list[InvoiceOut])
async def list_invoices(
    status: str | None = None,
    company_id: str | None = None,
    ctx: TenantContext = Depends(require_capability(Capability.ISSUE_INVOICES)),
    session: AsyncSession = Depends(get_session),
):
    rows = await invoices.list_invoices(session, org_id=ctx.org_id, status=status, company_id=company_id)
    return [await _invoice_out(session, i) for i in rows]


@router.get("/my-company", response_model=list[InvoiceOut])
async def my_company_invoices(
    ctx: TenantContext = Depends(get_tenant),
    session: AsyncSession = Depends(get_session),
):
    """A seat-holder's company dues (self-service; read-only, money stays on web)."""
    rows = await invoices.my_company_invoices(session, org_id=ctx.org_id, user_id=ctx.user_id)
    return [await _invoice_out(session, i) for i in rows]


@router.get("/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(
    invoice_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.ISSUE_INVOICES)),
    session: AsyncSession = Depends(get_session),
):
    invoice = await invoices.get_owned_invoice(session, org_id=ctx.org_id, invoice_id=invoice_id)
    return await _invoice_out(session, invoice)


@router.get("/{invoice_id}/payments", response_model=list[InvoicePaymentOut])
async def invoice_payments(
    invoice_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.ISSUE_INVOICES)),
    session: AsyncSession = Depends(get_session),
):
    invoice = await invoices.get_owned_invoice(session, org_id=ctx.org_id, invoice_id=invoice_id)
    payments = (
        await session.execute(
            select(Payment).where(
                Payment.organization_id == ctx.org_id,
                Payment.invoice_id == invoice.id,
            ).order_by(Payment.created_at)
        )
    ).scalars().all()
    return [
        InvoicePaymentOut(
            id=p.id, invoice_id=p.invoice_id or invoice.id, method=p.method.value,
            amount=p.amount, currency=p.currency, note=p.note, paid_at=p.paid_at,
        )
        for p in payments
    ]


@router.post("/issue", response_model=InvoiceOut, status_code=201)
async def issue_next(
    data: InvoiceIssue,
    ctx: TenantContext = Depends(require_capability(Capability.ISSUE_INVOICES)),
    org: Organization = Depends(require_writable_org),
    session: AsyncSession = Depends(get_session),
):
    """Draw the next term's invoice for a contract (renewal)."""
    invoice = await invoices.issue_next(session, org_id=ctx.org_id, contract_id=data.contract_id,
                                        actor_id=ctx.user_id)
    return await _invoice_out(session, invoice)


@router.post("/{invoice_id}/send", response_model=InvoiceOut)
async def send_invoice(
    invoice_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.ISSUE_INVOICES)),
    org: Organization = Depends(require_writable_org),
    session: AsyncSession = Depends(get_session),
):
    invoice = await invoices.send_invoice(session, org_id=ctx.org_id, invoice_id=invoice_id,
                                          actor_id=ctx.user_id)
    return await _invoice_out(session, invoice)


@router.post("/{invoice_id}/record-payment", response_model=InvoiceOut)
async def record_payment(
    invoice_id: str,
    data: InvoiceRecordPayment,
    idempotency_key: str = Header(default="", alias=IDEMPOTENCY_HEADER),
    ctx: TenantContext = Depends(require_capability(Capability.ISSUE_INVOICES)),
    org: Organization = Depends(require_writable_org),
    session: AsyncSession = Depends(get_session),
):
    """Settle an invoice offline (bank transfer / cash) — idempotent."""
    invoice = await invoices.record_payment(
        session, org_id=ctx.org_id, invoice_id=invoice_id, method=data.method,
        amount=data.amount, note=data.note, paid_on=data.paid_on,
        actor_id=ctx.user_id, idempotency_key=idempotency_key,
    )
    return await _invoice_out(session, invoice)


@router.post("/{invoice_id}/void", response_model=InvoiceOut)
async def void_invoice(
    invoice_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.ISSUE_INVOICES)),
    org: Organization = Depends(require_writable_org),
    session: AsyncSession = Depends(get_session),
):
    invoice = await invoices.void_invoice(session, org_id=ctx.org_id, invoice_id=invoice_id,
                                          actor_id=ctx.user_id, reason="voided by admin")
    return await _invoice_out(session, invoice)


@router.post("/{invoice_id}/reopen", response_model=InvoiceOut)
async def reopen_invoice(
    invoice_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.ISSUE_INVOICES)),
    org: Organization = Depends(require_writable_org),
    session: AsyncSession = Depends(get_session),
):
    invoice = await invoices.reopen_invoice(session, org_id=ctx.org_id, invoice_id=invoice_id,
                                            actor_id=ctx.user_id)
    return await _invoice_out(session, invoice)
