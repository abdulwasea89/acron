"""AI receipt verification API routes (Section 10).

Members upload receipts (multipart); the pipeline runs inline and returns the
verdict + member-facing message. Admins work the review queue.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, require_capability
from app.core.permissions import Capability
from app.core.tenancy import TenantContext
from app.schemas.receipts import ReceiptOut, ReceiptReviewAction, ReceiptReviewItem
from app.services import receipts_service as receipts
from app.workers import receipt_pipeline, spot_audit

router = APIRouter()


def _to_out(r) -> ReceiptOut:
    return ReceiptOut(
        id=r.id, member_id=r.member_id, plan_id=r.plan_id, status=r.status.value,
        confidence_score=r.confidence_score, auto_approved=r.auto_approved,
        is_duplicate=r.is_duplicate, extracted_amount=r.extracted_amount,
        extracted_date=r.extracted_date, extracted_payee=r.extracted_payee,
        flags=receipts.flags_of(r), member_message=receipt_pipeline.member_message(r),
    )


@router.post("/upload", response_model=ReceiptOut, status_code=201)
async def upload_receipt(
    file: UploadFile = File(...),
    plan_id: str | None = Form(default=None),
    ctx: TenantContext = Depends(require_capability(Capability.UPLOAD_RECEIPT)),
    session: AsyncSession = Depends(get_session),
):
    image_bytes = await file.read()
    receipt = await receipts.upload_receipt(
        session, org_id=ctx.org_id, user_id=ctx.user_id, image_bytes=image_bytes,
        plan_id=plan_id, filename=file.filename,
    )
    return _to_out(receipt)


@router.get("/review-queue", response_model=list[ReceiptReviewItem])
async def review_queue(
    ctx: TenantContext = Depends(require_capability(Capability.APPROVE_CASH_RECEIPTS)),
    session: AsyncSession = Depends(get_session),
):
    items = await receipts.review_queue(session, org_id=ctx.org_id)
    return [
        ReceiptReviewItem(
            id=r.id, member_id=r.member_id, plan_id=r.plan_id, status=r.status.value,
            confidence_score=r.confidence_score, extracted_amount=r.extracted_amount,
            extracted_date=r.extracted_date, extracted_payer=r.extracted_payer,
            extracted_payee=r.extracted_payee, is_duplicate=r.is_duplicate,
            flags=receipts.flags_of(r), original_image_url=r.original_image_url,
        )
        for r in items
    ]


@router.post("/{receipt_id}/review", response_model=ReceiptOut)
async def review_receipt(
    receipt_id: str,
    data: ReceiptReviewAction,
    ctx: TenantContext = Depends(require_capability(Capability.APPROVE_CASH_RECEIPTS)),
    session: AsyncSession = Depends(get_session),
):
    receipt = await receipts.review(
        session, org_id=ctx.org_id, receipt_id=receipt_id, action=data.action,
        reason=data.reason, reviewer_user_id=ctx.user_id,
    )
    return _to_out(receipt)


@router.post("/{receipt_id}/reverse", response_model=ReceiptOut)
async def reverse_receipt(
    receipt_id: str,
    data: ReceiptReviewAction,
    ctx: TenantContext = Depends(require_capability(Capability.APPROVE_CASH_RECEIPTS)),
    session: AsyncSession = Depends(get_session),
):
    receipt = await receipts.reverse_auto_approval(
        session, org_id=ctx.org_id, receipt_id=receipt_id,
        reviewer_user_id=ctx.user_id, reason=data.reason,
    )
    return _to_out(receipt)


@router.post("/spot-audit/run", response_model=dict)
async def run_spot_audit(
    ctx: TenantContext = Depends(require_capability(Capability.VIEW_REVENUE_ANALYTICS)),
    session: AsyncSession = Depends(get_session),
):
    return await spot_audit.run_spot_audit(session, org_id=ctx.org_id)
