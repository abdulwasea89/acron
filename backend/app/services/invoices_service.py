"""Office B2B invoice service: draw, send, settle, void.

The office vertical invoices companies for seat contracts. Settlement is offline
(bank transfer / cash) and creates a ``Payment(kind=SPACE, invoice_id=...)`` —
money never touches Stripe (requires_connect is false). All mutations are
org-scoped and audited; settlement is idempotent (Security Rule #2).
"""

from __future__ import annotations

import json
from calendar import monthrange
from datetime import date, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.constants import (
    PaymentKind,
    PaymentMethod,
    PaymentStatus,
    PlanStatus,
    TaxMode,
)
from app.core.industry import OfferKind
from app.core.security import now_utc
from app.integrations.email import send_email_safe
from app.models.company import Company
from app.models.company_contract import CompanyContract
from app.models.invoice import Invoice
from app.models.membership import OrganizationMember
from app.models.organization import Organization
from app.models.payment import Payment
from app.models.plan import MembershipPlan
from app.schemas.invoices import effective_status
from app.services import idempotency_service
from app.services.audit_service import record_audit


def _add_months(d: date, n: int) -> date:
    """Advance ``d`` by ``n`` calendar months, clamping the day to month length."""
    month = d.month - 1 + n
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, monthrange(year, month)[1])
    return date(year, month, day)


def term_months(term: str) -> int:
    return {"monthly": 1, "quarterly": 3, "annual": 12}.get(term, 1)


async def _next_invoice_number(session: AsyncSession, org_id: str) -> str:
    count = (
        await session.execute(
            select(Invoice).where(Invoice.organization_id == org_id)
        )
    ).scalars()
    n = 0
    for _ in count:
        n += 1
    return f"INV-{now_utc().year}-{n + 1:04d}"


async def _line_items(contract: CompanyContract, plan: MembershipPlan) -> list[dict]:
    amount = round(contract.seats * contract.price_per_seat, 2)
    period = f"{contract.start_date} → {contract.next_billing_at}"
    description = (
        f"{plan.name} — {contract.seats} seat(s), {contract.term} "
        f"({period}) at {contract.price_per_seat:.2f}/seat"
    )
    return [
        {
            "description": description,
            "quantity": contract.seats,
            "unit_amount": contract.price_per_seat,
            "amount": amount,
        }
    ]


def _totals(subtotal: float, plan: MembershipPlan) -> tuple[float, float]:
    if plan.tax_mode == TaxMode.ADDED and plan.tax_rate:
        tax = round(subtotal * plan.tax_rate, 2)
        return round(subtotal + tax, 2), tax
    return round(subtotal, 2), 0.0


async def _period_overlap(session: AsyncSession, *, contract_id: str) -> bool:
    """Is there already an open invoice for this contract (unpaid or not voided)?"""

    open_row = (
        await session.execute(
            select(Invoice).where(
                Invoice.contract_id == contract_id,
                Invoice.status.in_(["draft", "sent", "partial"]),
            )
        )
    ).scalars().first()
    return open_row is not None


async def create_for_contract(
    session: AsyncSession,
    *,
    org: Organization,
    contract: CompanyContract,
    plan: MembershipPlan,
    actor_id: str,
) -> Invoice:
    """Auto-draft the first invoice when a seat contract is signed."""

    subtotal = round(contract.seats * contract.price_per_seat, 2)
    total, tax = _totals(subtotal, plan)
    issue_date = now_utc().date()
    terms_days = org.invoice_payment_terms_days or 7
    invoice = Invoice(
        organization_id=org.id,
        company_id=contract.company_id,
        contract_id=contract.id,
        invoice_number=await _next_invoice_number(session, org.id),
        issue_date=issue_date,
        due_date=issue_date + timedelta(days=terms_days),
        status="draft",
        subtotal=subtotal,
        tax_amount=tax,
        total=total,
        currency=contract.currency,
        line_items_json=json.dumps(await _line_items(contract, plan)),
    )
    session.add(invoice)
    await session.flush()
    await record_audit(
        session, action="invoice.drafted", organization_id=org.id, actor_user_id=actor_id,
        entity_type="invoice", entity_id=invoice.id,
        new_values={"invoice_number": invoice.invoice_number, "contract_id": contract.id,
                    "total": total, "currency": contract.currency},
    )
    return invoice


async def issue_next(
    session: AsyncSession, *, org_id: str, contract_id: str, actor_id: str,
) -> Invoice:
    """Draw the next term's invoice for a contract and roll the cycle forward.

    Refuses while an open invoice already exists on the contract so double-taps
    never produce two invoices for the same period."""

    contract = await session.get(CompanyContract, contract_id)
    if contract is None or contract.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Contract not found.")
    if contract.status != "active":
        raise HTTPException(status_code=409, detail="Contract is not active.")
    if await _period_overlap(session, contract_id=contract_id):
        raise HTTPException(status_code=409, detail="An invoice for this contract is still open.")

    plan = await session.get(MembershipPlan, contract.plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Space plan not found.")

    # New term: start where the previous term ended.
    contract.start_date = contract.next_billing_at
    months = term_months(contract.term)
    contract.next_billing_at = _add_months(contract.start_date, months)
    session.add(contract)

    org = await session.get(Organization, org_id)
    invoice = await create_for_contract(session, org=org, contract=contract, plan=plan, actor_id=actor_id)
    return invoice


async def get_owned_invoice(session: AsyncSession, *, org_id: str, invoice_id: str) -> Invoice:
    invoice = await session.get(Invoice, invoice_id)
    if invoice is None or invoice.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    return invoice


async def _paid_amount(session: AsyncSession, *, org_id: str, invoice_id: str) -> float:
    total = (
        await session.execute(
            select(Payment.amount).where(
                Payment.organization_id == org_id,
                Payment.invoice_id == invoice_id,
                Payment.status == PaymentStatus.SUCCEEDED,
            )
        )
    ).scalars().all()
    return round(sum(total or []), 2)


async def list_invoices(
    session: AsyncSession, *, org_id: str, status: str | None = None, company_id: str | None = None,
) -> list[Invoice]:
    stmt = select(Invoice).where(Invoice.organization_id == org_id)
    if status is not None and status != "overdue":
        stmt = stmt.where(Invoice.status == status)
    if company_id is not None:
        stmt = stmt.where(Invoice.company_id == company_id)
    invoices = list((await session.execute(stmt.order_by(Invoice.issue_date.desc()))).scalars())
    if status == "overdue":
        today = now_utc().date()
        invoices = [i for i in invoices if effective_status(i.status, i.due_date, today) == "overdue"]
    return invoices


async def my_company_invoices(session: AsyncSession, *, org_id: str, user_id: str) -> list[Invoice]:
    """A seat-holder's own company dues (member self-service, mobile)."""

    member = (
        await session.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if member is None or member.company_id is None:
        return []
    stmt = (
        select(Invoice)
        .where(
            Invoice.organization_id == org_id,
            Invoice.company_id == member.company_id,
            Invoice.status.in_(["sent", "partial"]),
        )
        .order_by(Invoice.due_date)
    )
    return list((await session.execute(stmt)).scalars())


async def send_invoice(
    session: AsyncSession, *, org_id: str, invoice_id: str, actor_id: str,
) -> Invoice:
    invoice = await get_owned_invoice(session, org_id=org_id, invoice_id=invoice_id)
    if invoice.status != "draft":
        raise HTTPException(status_code=409, detail="Only draft invoices can be sent.")

    company = await session.get(Company, invoice.company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found.")
    email = company.billing_email or company.contact_email
    if not email:
        raise HTTPException(
            status_code=422,
            detail="Company has no billing email on file. Set one before sending.",
        )

    invoice.status = "sent"
    session.add(invoice)
    org = await session.get(Organization, org_id)
    due_label = invoice.due_date.isoformat()
    sent = await send_email_safe(
        email,
        f"Invoice {invoice.invoice_number} from {org.name if org else ''}",
        f"Invoice {invoice.invoice_number} for {company.name}: "
        f"{invoice.total:.2f} {invoice.currency}, due {due_label}. "
        f"Please arrange payment by bank transfer or in person.",
    )
    await record_audit(
        session, action="invoice.sent", organization_id=org_id, actor_user_id=actor_id,
        entity_type="invoice", entity_id=invoice.id,
        metadata={"email": email, "delivered": sent, "due_date": due_label},
    )
    return invoice


async def record_payment(
    session: AsyncSession,
    *,
    org_id: str,
    invoice_id: str,
    method: str,
    amount: float | None,
    note: str | None,
    paid_on: date | None,
    actor_id: str,
    idempotency_key: str,
) -> Invoice:
    """Idempotently settle an invoice offline (bank transfer / cash)."""

    invoice = await get_owned_invoice(session, org_id=org_id, invoice_id=invoice_id)

    # Claim BEFORE any state guard so a replay returns the current (already
    # settled) state instead of failing the "already paid" check (Section 13.4).
    claim = await idempotency_service.claim(
        session, key=idempotency_key, endpoint="POST /invoices/{id}/record-payment",
        body={"invoice_id": invoice_id, "method": method, "amount": amount},
        organization_id=org_id, user_id=actor_id,
    )
    if not claim.claimed:
        return invoice  # replay -> current state (same key/body already applied)

    # Guard failures below must fail the claim so the reconciliation worker
    # doesn't find it stuck in_progress forever.
    async def reject(code: int, detail: str):
        await idempotency_service.fail(session, claim.record, code=code,
                                       body=json.dumps({"detail": detail}))
        raise HTTPException(status_code=code, detail=detail)

    if invoice.status in {"draft", "void"}:
        await reject(409, "Invoice is not payable yet.")
    if invoice.status == "paid":
        await reject(409, "Invoice is already paid.")

    try:
        parsed_method = PaymentMethod(method)
    except ValueError:
        await reject(422, "Payment method must be bank_transfer or cash.")
    if parsed_method not in {PaymentMethod.BANK_TRANSFER, PaymentMethod.CASH}:
        await reject(422, "Office invoices settle by bank_transfer or cash.")

    paid_so_far = await _paid_amount(session, org_id=org_id, invoice_id=invoice_id)
    balance = round(invoice.total - paid_so_far, 2)
    if amount is None:
        amount = balance
    amount = round(float(amount), 2)
    if amount <= 0:
        await reject(422, "Payment amount must be positive.")
    if amount > balance + 0.001:
        await reject(422, "Payment exceeds the invoice balance.")

    paid_at = now_utc()
    payment = Payment(
        organization_id=org_id,
        invoice_id=invoice.id,
        kind=PaymentKind.SPACE,
        method=parsed_method,
        status=PaymentStatus.SUCCEEDED,
        amount=amount,
        currency=invoice.currency,
        logged_by=actor_id,
        note=note or f"Settlement of {invoice.invoice_number}",
        idempotency_key=idempotency_key,
        paid_at=paid_at,
    )
    session.add(payment)
    await session.flush()

    paid_now = round(paid_so_far + amount, 2)
    if paid_now >= invoice.total - 0.001:
        invoice.status = "paid"
        invoice.paid_at = paid_at
    else:
        invoice.status = "partial"
    session.add(invoice)

    await record_audit(
        session, action="invoice.payment_recorded", organization_id=org_id, actor_user_id=actor_id,
        entity_type="invoice", entity_id=invoice.id,
        metadata={"payment_id": payment.id, "amount": amount, "method": parsed_method.value,
                  "paid_on": (paid_on or paid_at.date()).isoformat()},
    )
    await idempotency_service.complete(session, claim.record, code=200, body=invoice.id)
    return invoice


async def void_invoice(
    session: AsyncSession, *, org_id: str, invoice_id: str, actor_id: str, reason: str | None,
) -> Invoice:
    invoice = await get_owned_invoice(session, org_id=org_id, invoice_id=invoice_id)
    if invoice.status in {"paid", "void"}:
        raise HTTPException(status_code=409, detail="Only open invoices can be voided.")
    paid = await _paid_amount(session, org_id=org_id, invoice_id=invoice_id)
    if paid > 0:
        raise HTTPException(status_code=409, detail="Invoice has payments. Record a refund instead.")
    invoice.status = "void"
    session.add(invoice)
    await record_audit(session, action="invoice.voided", organization_id=org_id, actor_user_id=actor_id,
                       entity_type="invoice", entity_id=invoice.id, metadata={"reason": reason})
    return invoice


async def reopen_invoice(
    session: AsyncSession, *, org_id: str, invoice_id: str, actor_id: str,
) -> Invoice:
    invoice = await get_owned_invoice(session, org_id=org_id, invoice_id=invoice_id)
    if invoice.status != "void":
        raise HTTPException(status_code=409, detail="Only voided invoices can be reopened.")
    invoice.status = "draft"
    invoice.paid_at = None
    session.add(invoice)
    await record_audit(session, action="invoice.reopened", organization_id=org_id, actor_user_id=actor_id,
                       entity_type="invoice", entity_id=invoice.id)
    return invoice


async def company_name(session: AsyncSession, company_id: str) -> str | None:
    company = await session.get(Company, company_id)
    return company.name if company else None
