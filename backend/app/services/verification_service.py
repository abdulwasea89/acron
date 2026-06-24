"""Verification codes & links: issue, verify, consume (Sections 4.3, 5.4, 5.8, 12).

Handles 6-digit email codes and opaque single-use URL tokens with expiry,
single-use, and resend rate limiting. Only hashes are stored.
"""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.config import settings
from app.core.constants import VerificationPurpose
from app.core.rate_limit import rate_limiter
from app.core.security import (
    generate_numeric_code,
    generate_url_token,
    hash_token,
    now_utc,
)
from app.models.verification import VerificationToken


class VerificationError(Exception):
    """Raised when a code/link is invalid, expired, or already used."""


async def issue_code(
    session: AsyncSession,
    *,
    email: str,
    purpose: VerificationPurpose,
    organization_id: str | None = None,
    user_id: str | None = None,
    expire_minutes: int | None = None,
) -> str:
    """Create a 6-digit code, store its hash, return the plaintext code."""

    # Resend rate limit (Section 4.3): max N per hour per email+purpose.
    allowed, _ = await rate_limiter.hit(
        f"verif:{purpose.value}:{email}", settings.email_resend_max_per_hour, 3600
    )
    if not allowed:
        raise VerificationError("Too many requests. Try again later.")

    code = generate_numeric_code(6)
    minutes = expire_minutes or settings.email_code_expire_minutes
    token = VerificationToken(
        purpose=purpose,
        email=email.lower(),
        organization_id=organization_id,
        user_id=user_id,
        code_hash=hash_token(code),
        expires_at=now_utc() + timedelta(minutes=minutes),
    )
    session.add(token)
    return code


async def issue_link_token(
    session: AsyncSession,
    *,
    email: str,
    purpose: VerificationPurpose,
    organization_id: str | None = None,
    user_id: str | None = None,
    expire_minutes: int | None = None,
) -> str:
    """Create an opaque single-use URL token; return the plaintext token."""

    raw = generate_url_token()
    minutes = expire_minutes or settings.magic_link_expire_minutes
    token = VerificationToken(
        purpose=purpose,
        email=email.lower(),
        organization_id=organization_id,
        user_id=user_id,
        code_hash=hash_token(raw),
        expires_at=now_utc() + timedelta(minutes=minutes),
    )
    session.add(token)
    return raw


async def verify_and_consume(
    session: AsyncSession,
    *,
    email: str,
    secret: str,
    purpose: VerificationPurpose,
    organization_id: str | None = None,
) -> VerificationToken:
    """Validate a code/token and mark it consumed. Raises on failure."""

    secret_hash = hash_token(secret)
    stmt = select(VerificationToken).where(
        VerificationToken.email == email.lower(),
        VerificationToken.purpose == purpose,
        VerificationToken.code_hash == secret_hash,
        VerificationToken.consumed == False,  # noqa: E712
    )
    if organization_id is not None:
        stmt = stmt.where(VerificationToken.organization_id == organization_id)

    token = (await session.execute(stmt.order_by(VerificationToken.created_at.desc()))).scalars().first()
    if token is None:
        raise VerificationError("Invalid or expired code.")
    if token.expires_at < now_utc():
        raise VerificationError("Code has expired.")

    token.consumed = True
    token.consumed_at = now_utc()
    session.add(token)
    return token
