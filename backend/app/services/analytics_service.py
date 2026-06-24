"""Analytics aggregations (Section 16).

Headline metrics power the mobile dashboard (today's check-ins, revenue, pending
counts). Full revenue analytics power the web portal (revenue by method, member
status breakdown, churn). All queries are org-scoped (Security Rule #1).
"""

from __future__ import annotations

from datetime import datetime, time

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.constants import MemberStatus, PaymentStatus, ReceiptStatus
from app.core.security import now_utc
from app.models.membership import OrganizationMember
from app.models.organization import Organization
from app.models.payment import Payment
from app.models.receipt import ReceiptUpload
from app.models.staff import Shift


async def headline_metrics(session: AsyncSession, *, org_id: str) -> dict:
    today = now_utc().date()
    start = datetime.combine(today, time.min)
    end = datetime.combine(today, time.max)

    check_ins = (
        await session.execute(
            select(func.count()).select_from(Shift).where(
                Shift.organization_id == org_id,
                Shift.checked_in_at >= start,
                Shift.checked_in_at <= end,
            )
        )
    ).scalar_one()

    revenue = (
        await session.execute(
            select(func.coalesce(func.sum(Payment.amount), 0.0)).where(
                Payment.organization_id == org_id,
                Payment.status == PaymentStatus.SUCCEEDED,
                Payment.paid_at >= start,
                Payment.paid_at <= end,
            )
        )
    ).scalar_one()

    pending_receipts = (
        await session.execute(
            select(func.count()).select_from(ReceiptUpload).where(
                ReceiptUpload.organization_id == org_id,
                ReceiptUpload.status == ReceiptStatus.PENDING_REVIEW,
            )
        )
    ).scalar_one()

    pending_approvals = (
        await session.execute(
            select(func.count()).select_from(OrganizationMember).where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.member_status == MemberStatus.PENDING_APPROVAL,
            )
        )
    ).scalar_one()

    active_members = (
        await session.execute(
            select(func.count()).select_from(OrganizationMember).where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.role == "member",
                OrganizationMember.member_status == MemberStatus.ACTIVE,
            )
        )
    ).scalar_one()

    return {
        "today_check_ins": int(check_ins or 0),
        "today_revenue": float(revenue or 0.0),
        "pending_receipts": int(pending_receipts or 0),
        "pending_approvals": int(pending_approvals or 0),
        "active_members": int(active_members or 0),
    }


async def revenue_analytics(session: AsyncSession, *, org_id: str) -> dict:
    org = await session.get(Organization, org_id)

    payments = (
        await session.execute(
            select(Payment).where(
                Payment.organization_id == org_id,
                Payment.status.in_([PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED]),
            )
        )
    ).scalars()
    total = 0.0
    by_method: dict[str, float] = {}
    for p in payments:
        net = p.amount - p.refunded_amount
        total += net
        by_method[p.method.value] = round(by_method.get(p.method.value, 0.0) + net, 2)

    members = (
        await session.execute(
            select(OrganizationMember.member_status, func.count())
            .where(OrganizationMember.organization_id == org_id,
                   OrganizationMember.role == "member")
            .group_by(OrganizationMember.member_status)
        )
    ).all()
    by_status: dict[str, int] = {}
    active = 0
    churn = 0
    for status, count in members:
        key = status.value if hasattr(status, "value") else str(status)
        by_status[key] = int(count)
        if status == MemberStatus.ACTIVE:
            active = int(count)
        if status in {MemberStatus.CANCELLED, MemberStatus.EXPIRED}:
            churn += int(count)

    return {
        "total_revenue": round(total, 2),
        "revenue_by_method": by_method,
        "member_count_by_status": by_status,
        "active_members": active,
        "churn_count": churn,
        "currency": org.default_currency if org else "USD",
    }
