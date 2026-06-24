"""Payment history & refund API routes (Sections 13, 16).

Refunds are admin-only and web-only (Security Rule #7) and require an
Idempotency-Key (Security Rule #2).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_capability
from app.core.permissions import Capability
from app.core.tenancy import IDEMPOTENCY_HEADER, TenantContext
from app.schemas.payments import PaymentOut, RefundOut, RefundRequest
from app.services import payments_service as payments

router = APIRouter()


def _to_out(p) -> PaymentOut:
    return PaymentOut(
        id=p.id, member_id=p.member_id, plan_id=p.plan_id, kind=p.kind.value, method=p.method.value,
        status=p.status.value, amount=p.amount, tax_amount=p.tax_amount, currency=p.currency,
        refunded_amount=p.refunded_amount, paid_at=p.paid_at, created_at=p.created_at,
    )


@router.get("", response_model=list[PaymentOut])
async def list_payments(
    member_id: str | None = None,
    ctx: TenantContext = Depends(require_capability(Capability.VIEW_REVENUE_ANALYTICS)),
    session: AsyncSession = Depends(get_session),
):
    return [_to_out(p) for p in await payments.list_payments(session, org_id=ctx.org_id, member_id=member_id)]


@router.post("/refund", response_model=RefundOut)
async def refund_payment(
    data: RefundRequest,
    idempotency_key: str = Header(default="", alias=IDEMPOTENCY_HEADER),
    ctx: TenantContext = Depends(require_capability(Capability.PROCESS_REFUNDS)),
    session: AsyncSession = Depends(get_session),
):
    payment = await payments.refund(
        session, org_id=ctx.org_id, payment_id=data.payment_id, amount=data.amount,
        reason=data.reason, idempotency_key=idempotency_key, actor_id=ctx.user_id,
    )
    return RefundOut(payment_id=payment.id, status=payment.status.value,
                     refunded_amount=payment.refunded_amount)
