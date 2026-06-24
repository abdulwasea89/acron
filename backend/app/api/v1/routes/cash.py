"""Cash payment logging & reconciliation API routes (Section 11)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_capability
from app.core.permissions import Capability
from app.core.tenancy import TenantContext
from app.schemas.cash import (
    CashPaymentLog,
    CashPaymentOut,
    ReconciliationOut,
    ReconciliationRequest,
)
from app.services import cash_service as cash

router = APIRouter()


@router.post("/log", response_model=CashPaymentOut, status_code=201)
async def log_cash_payment(
    data: CashPaymentLog,
    ctx: TenantContext = Depends(require_capability(Capability.LOG_CASH_PAYMENT)),
    session: AsyncSession = Depends(get_session),
):
    payment, member, pdf_url = await cash.log_cash_payment(
        session, org_id=ctx.org_id, data=data, staff_user_id=ctx.user_id
    )
    return CashPaymentOut(
        payment_id=payment.id, member_id=member.id, amount=payment.amount,
        method=payment.method.value, member_status=member.member_status.value,
        receipt_pdf_url=pdf_url,
    )


@router.post("/reconcile", response_model=ReconciliationOut, status_code=201)
async def reconcile(
    data: ReconciliationRequest,
    ctx: TenantContext = Depends(require_capability(Capability.LOG_CASH_PAYMENT)),
    session: AsyncSession = Depends(get_session),
):
    rec, alert = await cash.reconcile(
        session, org_id=ctx.org_id, business_date=data.business_date,
        counted_total=data.counted_total, performed_by=ctx.user_id, notes=data.notes,
    )
    return ReconciliationOut(
        id=rec.id, business_date=rec.business_date, system_total=rec.system_total,
        counted_total=rec.counted_total, discrepancy=rec.discrepancy,
        performed_by=rec.performed_by, alert_triggered=alert,
    )
