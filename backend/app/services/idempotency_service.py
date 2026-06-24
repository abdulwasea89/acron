"""Server-side idempotency (Section 13).

Implements the claim/replay protocol for state-changing requests:

  * ``claim`` — first time a key is seen, insert an ``in_progress`` row and
    return CLAIMED. If the key exists: completed -> return cached response;
    in_progress -> 409 Conflict; failed -> return cached failure. A matching key
    with a *different* request body is rejected as tampered (Section 13.4).
  * ``complete`` / ``fail`` — record the outcome + cached response body.

This is the single mechanism behind "zero double-charge". Stripe is also passed
the same key (Section 13.5) as a second layer.
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.constants import IdempotencyStatus
from app.core.security import now_utc
from app.models.idempotency_key import IdempotencyKey
from app.utils.idempotency import hash_request_body


@dataclass
class ClaimResult:
    claimed: bool                 # True -> caller should do the work
    record: IdempotencyKey
    cached_response: str | None = None
    cached_code: int | None = None


async def claim(
    session: AsyncSession,
    *,
    key: str,
    endpoint: str,
    body,
    organization_id: str | None = None,
    user_id: str | None = None,
) -> ClaimResult:
    if not key:
        raise HTTPException(status_code=400, detail="Idempotency-Key header is required.")

    request_hash = hash_request_body(body)
    existing = (
        await session.execute(
            select(IdempotencyKey).where(
                IdempotencyKey.key == key,
                IdempotencyKey.endpoint == endpoint,
            )
        )
    ).scalar_one_or_none()

    if existing is not None:
        # Same key, different body -> replay attack with modified params.
        if existing.request_hash != request_hash:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Idempotency key reused with a different request body.",
            )
        if existing.status == IdempotencyStatus.COMPLETED:
            return ClaimResult(False, existing, existing.response_body, existing.response_code)
        if existing.status == IdempotencyStatus.IN_PROGRESS:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Request already in progress. Retry shortly.",
            )
        if existing.status == IdempotencyStatus.FAILED:
            return ClaimResult(False, existing, existing.response_body, existing.response_code)

    record = IdempotencyKey(
        key=key,
        endpoint=endpoint,
        request_hash=request_hash,
        organization_id=organization_id,
        user_id=user_id,
        status=IdempotencyStatus.IN_PROGRESS,
    )
    session.add(record)
    await session.flush()
    return ClaimResult(True, record)


async def complete(
    session: AsyncSession, record: IdempotencyKey, *, code: int, body: str
) -> None:
    record.status = IdempotencyStatus.COMPLETED
    record.response_code = code
    record.response_body = body
    record.completed_at = now_utc()
    session.add(record)


async def fail(
    session: AsyncSession, record: IdempotencyKey, *, code: int, body: str
) -> None:
    record.status = IdempotencyStatus.FAILED
    record.response_code = code
    record.response_body = body
    record.completed_at = now_utc()
    session.add(record)
