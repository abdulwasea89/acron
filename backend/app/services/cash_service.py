"""Cash payment logging & reconciliation (Section 11).

Front-desk/manager/owner log offline payments, which activate the member and
generate a receipt PDF (Section 11.1). End-of-day reconciliation compares the
system's cash total against a counted total; discrepancies are logged with the
staff member's name, and 3 discrepancies in 30 days alerts the owner
(Security Rule #9, Section 11.2).
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.constants import (
    MemberStatus,
    PaymentKind,
    PaymentMethod,
    PaymentStatus,
    PlanBillingType,
    SubscriptionStatus,
)
from app.core.security import now_utc
from app.integrations.email import send_email_safe as send_email
from app.integrations.push import send_push
from app.models.cash import CashReconciliation
from app.models.membership import OrganizationMember
from app.models.organization import Organization
from app.models.payment import Payment
from app.models.plan import MembershipPlan
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.cash import CashPaymentLog
from app.services.audit_service import record_audit
from app.utils.pdf import render_receipt_pdf

# 3 discrepancies within 30 days triggers an owner alert (Section 11.2).
DISCREPANCY_ALERT_THRESHOLD = 3
DISCREPANCY_WINDOW_DAYS = 30
# Cents tolerance below which a reconciliation isn't counted as a discrepancy.
DISCREPANCY_TOLERANCE = 0.01


async def log_cash_payment(
    session: AsyncSession, *, org_id: str, data: CashPaymentLog, staff_user_id: str
) -> tuple[Payment, OrganizationMember, str]:
    """Record an offline payment and activate the member. Returns (payment, member, pdf_url)."""

    member = await session.get(OrganizationMember, data.member_id)
    if member is None or member.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Member not found.")
    plan = await session.get(MembershipPlan, data.plan_id)
    if plan is None or plan.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Plan not found.")
    if data.amount <= 0:
        raise HTTPException(status_code=422, detail="Amount must be positive.")

    payment = Payment(
        organization_id=org_id,
        member_id=member.id,
        plan_id=plan.id,
        kind=PaymentKind.MEMBER_FEE,
        method=data.method,
        status=PaymentStatus.SUCCEEDED,
        amount=data.amount,
        currency=plan.currency,
        logged_by=staff_user_id,
        note=data.note,
        paid_at=now_utc(),
    )
    session.add(payment)
    await session.flush()

    # Activate / extend membership.
    period_end = None
    classes_remaining = None
    if plan.billing_type == PlanBillingType.RECURRING:
        unit_days = {"day": 1, "week": 7, "month": 30}.get(plan.cycle_unit or "month", 30)
        period_end = now_utc() + timedelta(days=unit_days * (plan.cycle_length or 1))
    elif plan.billing_type == PlanBillingType.ONE_TIME_PACK:
        classes_remaining = plan.pack_size
        if plan.validity_days:
            period_end = now_utc() + timedelta(days=plan.validity_days)

    sub = Subscription(
        organization_id=org_id,
        member_id=member.id,
        plan_id=plan.id,
        status=SubscriptionStatus.ACTIVE,
        price_snapshot=plan.price,
        currency=plan.currency,
        current_period_end=period_end,
        classes_remaining=classes_remaining,
    )
    session.add(sub)
    await session.flush()
    payment.subscription_id = sub.id
    session.add(payment)

    member.member_status = MemberStatus.ACTIVE
    if member.joined_at is None:
        member.joined_at = now_utc()
    session.add(member)

    # Receipt PDF (Section 11.1 step "Receipt PDF auto-generated"). The document
    # is rendered on demand from the payment row rather than stored, so the
    # download link stays valid without an object store in the loop.
    user = await session.get(User, member.user_id)
    pdf_url = f"/cash/payments/{payment.id}/receipt"

    await record_audit(session, action="cash.payment_logged", organization_id=org_id,
                       actor_user_id=staff_user_id, entity_type="payment", entity_id=payment.id,
                       new_values={"amount": data.amount, "method": data.method.value,
                                   "member_id": member.id})

    end_str = period_end.date().isoformat() if period_end else "—"
    if user:
        await send_email(user.email, "Payment recorded",
                         f"Your payment of {plan.currency} {data.amount:.2f} was recorded. "
                         f"Membership active until {end_str}.")
    await send_push(None, "Payment recorded",
                    f"Your payment of {plan.currency} {data.amount:.2f} has been recorded. "
                    f"Membership active until {end_str}.")

    from app.realtime import events

    await events.payment_recorded(org_id, payment_id=payment.id, member_id=member.id)
    return payment, member, pdf_url


async def render_receipt(session: AsyncSession, *, org_id: str, payment_id: str) -> tuple[bytes, str]:
    """Build the receipt PDF for an offline payment. Returns (pdf_bytes, filename)."""

    payment = await session.get(Payment, payment_id)
    if payment is None or payment.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Payment not found.")

    member = await session.get(OrganizationMember, payment.member_id) if payment.member_id else None
    user = await session.get(User, member.user_id) if member else None
    plan = await session.get(MembershipPlan, payment.plan_id) if payment.plan_id else None
    org = await session.get(Organization, org_id)

    valid_until = None
    if payment.subscription_id:
        sub = await session.get(Subscription, payment.subscription_id)
        if sub and sub.current_period_end:
            valid_until = sub.current_period_end.date().isoformat()

    logged_by = payment.logged_by or "—"
    if payment.logged_by:
        staff = await session.get(User, payment.logged_by)
        if staff:
            logged_by = staff.full_name or staff.email

    paid_at = (payment.paid_at or payment.created_at)
    pdf = render_receipt_pdf(
        gym_name=org.name if org else "Gym",
        gym_address=org.address if org else None,
        receipt_no=payment.id[:12].upper(),
        paid_at=paid_at.strftime("%d %b %Y") if paid_at else "—",
        member_name=(user.full_name or user.email) if user else "Member",
        member_email=user.email if user else "—",
        plan_name=plan.name if plan else "Membership payment",
        amount=payment.amount,
        currency=payment.currency,
        method=payment.method.value.replace("_", " ").title(),
        logged_by=logged_by,
        valid_until=valid_until,
        note=payment.note,
    )
    return pdf, f"receipt-{payment.id[:12]}.pdf"


async def search_members(
    session: AsyncSession, *, org_id: str, q: str | None = None, limit: int = 50,
) -> list[tuple[OrganizationMember, User]]:
    """Search everyone in the org by name/email for the cash-logging box.

    Staff (trainers, front desk, managers) commonly hold their own membership at
    the gym, so every tenant row is searchable — matching what the Members
    directory shows. Gated by LOG_CASH_PAYMENT at the route layer.
    """

    stmt = (
        select(OrganizationMember, User)
        .join(User, User.id == OrganizationMember.user_id)
        .where(OrganizationMember.organization_id == org_id)
    )
    if q:
        pattern = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            User.full_name.ilike(pattern) | User.email.ilike(pattern)
        )
    stmt = stmt.order_by(User.full_name, User.email).limit(max(1, min(limit, 200)))
    rows = (await session.execute(stmt)).all()
    return [(m, u) for m, u in rows]


async def _system_cash_total(session: AsyncSession, *, org_id: str, business_date: date) -> float:
    """Sum of successful cash-method payments logged on ``business_date``."""

    start = datetime.combine(business_date, time.min)
    end = datetime.combine(business_date, time.max)
    total = (
        await session.execute(
            select(func.coalesce(func.sum(Payment.amount), 0.0)).where(
                Payment.organization_id == org_id,
                Payment.method == PaymentMethod.CASH,
                Payment.status == PaymentStatus.SUCCEEDED,
                Payment.paid_at >= start,
                Payment.paid_at <= end,
            )
        )
    ).scalar_one()
    return float(total or 0.0)


async def reconcile(
    session: AsyncSession, *, org_id: str, business_date: date, counted_total: float,
    performed_by: str, notes: str | None,
) -> tuple[CashReconciliation, bool]:
    """Record end-of-day count. Returns (reconciliation, alert_triggered)."""

    system_total = await _system_cash_total(session, org_id=org_id, business_date=business_date)
    discrepancy = round(counted_total - system_total, 2)

    rec = CashReconciliation(
        organization_id=org_id,
        business_date=business_date,
        system_total=system_total,
        counted_total=counted_total,
        discrepancy=discrepancy,
        performed_by=performed_by,
        notes=notes,
    )
    session.add(rec)
    await session.flush()

    alert = False
    if abs(discrepancy) > DISCREPANCY_TOLERANCE:
        await record_audit(session, action="cash.reconciliation_discrepancy", organization_id=org_id,
                           actor_user_id=performed_by, entity_type="cash_reconciliation",
                           entity_id=rec.id, new_values={"discrepancy": discrepancy})
        alert = await _maybe_alert_owner(session, org_id=org_id, staff_user_id=performed_by)
    else:
        await record_audit(session, action="cash.reconciliation", organization_id=org_id,
                           actor_user_id=performed_by, entity_type="cash_reconciliation",
                           entity_id=rec.id)
    return rec, alert


async def _maybe_alert_owner(session: AsyncSession, *, org_id: str, staff_user_id: str) -> bool:
    """3 discrepancies by this staff member in 30 days -> alert owner (Section 11.2)."""

    cutoff = now_utc() - timedelta(days=DISCREPANCY_WINDOW_DAYS)
    count = (
        await session.execute(
            select(func.count()).select_from(CashReconciliation).where(
                CashReconciliation.organization_id == org_id,
                CashReconciliation.performed_by == staff_user_id,
                CashReconciliation.created_at >= cutoff,
                func.abs(CashReconciliation.discrepancy) > DISCREPANCY_TOLERANCE,
            )
        )
    ).scalar_one()
    if count < DISCREPANCY_ALERT_THRESHOLD:
        return False

    org = await session.get(Organization, org_id)
    owner = (
        await session.execute(
            select(User).join(OrganizationMember, OrganizationMember.user_id == User.id).where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.role == "owner",
            )
        )
    ).scalars().first()
    if owner is not None:
        await send_email(
            owner.email, "Cash discrepancy alert",
            f"Staff member {staff_user_id} has logged {count} cash discrepancies in the last "
            f"{DISCREPANCY_WINDOW_DAYS} days at {org.name if org else org_id}. Please review.",
        )
    await record_audit(session, action="cash.discrepancy_owner_alert", organization_id=org_id,
                       entity_type="user", entity_id=staff_user_id,
                       metadata={"count": count, "window_days": DISCREPANCY_WINDOW_DAYS})
    return True
