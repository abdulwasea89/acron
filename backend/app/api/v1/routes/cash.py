"""Cash payment logging & reconciliation API routes (Section 11)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_capability, require_writable_org
from app.core.permissions import Capability
from app.core.tenancy import TenantContext
from app.schemas.cash import (
    CashMemberOut,
    CashPaymentLog,
    CashPaymentOut,
    ReconciliationOut,
    ReconciliationRequest,
)
from app.services import cash_service as cash

router = APIRouter()


def _cash_member(m, u) -> CashMemberOut:
    return CashMemberOut(
        member_id=m.id, full_name=u.full_name, email=u.email,
        member_status=m.member_status.value, role=m.role.value,
    )


@router.get("/members", response_model=list[CashMemberOut])
async def search_cash_members(
    q: str | None = None,
    ctx: TenantContext = Depends(require_capability(Capability.LOG_CASH_PAYMENT)),
    session: AsyncSession = Depends(get_session),
):
    rows = await cash.search_members(session, org_id=ctx.org_id, q=q)
    return [_cash_member(m, u) for m, u in rows]


@router.post("/log", response_model=CashPaymentOut, status_code=201, dependencies=[Depends(require_writable_org)])
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


@router.get("/payments/{payment_id}/receipt")
async def cash_payment_receipt(
    payment_id: str,
    ctx: TenantContext = Depends(require_capability(Capability.LOG_CASH_PAYMENT)),
    session: AsyncSession = Depends(get_session),
):
    """Download the proof-of-payment receipt for an offline payment."""
    pdf_bytes, filename = await cash.render_receipt(
        session, org_id=ctx.org_id, payment_id=payment_id
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/reconcile", response_model=ReconciliationOut, status_code=201, dependencies=[Depends(require_writable_org)])
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
