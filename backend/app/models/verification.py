"""VerificationToken: 6-digit codes & opaque single-use links.

Covers email verification, password reset, magic links, member invites, and
CSV-import activation tokens (Sections 4.3, 5.4, 5.8, 8, 12). Stores a hash of
the secret; checks expiry, single-use, and resend rate limits at the service.
"""

from __future__ import annotations

from datetime import datetime

from sqlmodel import Field

from app.core.constants import VerificationPurpose
from app.models.base import TimestampModel, UUIDModel


class VerificationToken(UUIDModel, TimestampModel, table=True):
    __tablename__ = "verification_tokens"

    purpose: VerificationPurpose = Field(index=True)
    email: str = Field(index=True)
    organization_id: str | None = Field(default=None, index=True)
    user_id: str | None = None

    code_hash: str = Field(index=True)  # hash of 6-digit code or url token
    expires_at: datetime
    consumed: bool = Field(default=False, index=True)
    consumed_at: datetime | None = None
    attempts: int = 0
