"""Stuck-payment reconciliation worker (Section 13.6).

Runs every ~2 minutes in production (Celery beat). Finds idempotency keys stuck
``in_progress`` past the configured threshold (default 30s), queries Stripe with
the same key, and resolves them:

  * Stripe shows succeeded -> mark the idempotency record completed (the payment
    record + activation would be created/repaired here).
  * Stripe shows failed / no record -> mark failed.

In stub mode the Connect client returns None (no remote state), so stuck keys
are conservatively marked failed. Runnable inline for local dev/tests.
"""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.config import settings
from app.core.constants import IdempotencyStatus
from app.core.security import now_utc
from app.integrations.stripe_connect import connect_stripe
from app.models.idempotency_key import IdempotencyKey
from app.services.audit_service import record_audit


async def reconcile_stuck(session: AsyncSession, *, org_id: str | None = None) -> dict:
    """Resolve idempotency keys stuck in_progress past the threshold."""

    cutoff = now_utc() - timedelta(seconds=settings.idempotency_stuck_seconds)
    stmt = select(IdempotencyKey).where(
        IdempotencyKey.status == IdempotencyStatus.IN_PROGRESS,
        IdempotencyKey.created_at < cutoff,
    )
    if org_id is not None:
        stmt = stmt.where(IdempotencyKey.organization_id == org_id)

    stuck = list((await session.execute(stmt)).scalars())
    resolved_ok = 0
    resolved_failed = 0
    for record in stuck:
        result = await connect_stripe.retrieve_payment_intent(
            connected_account_id="", idempotency_key=record.key
        )
        if result is not None and result.status == "succeeded":
            record.status = IdempotencyStatus.COMPLETED
            record.response_code = 200
            record.completed_at = now_utc()
            resolved_ok += 1
        else:
            record.status = IdempotencyStatus.FAILED
            record.response_code = 402
            record.response_body = '{"detail":"Reconciled: no successful charge found."}'
            record.completed_at = now_utc()
            resolved_failed += 1
        session.add(record)

    if stuck:
        await record_audit(session, action="payment.reconciliation_run", organization_id=org_id,
                           metadata={"checked": len(stuck), "ok": resolved_ok, "failed": resolved_failed})
    return {"checked": len(stuck), "resolved_succeeded": resolved_ok, "resolved_failed": resolved_failed}
