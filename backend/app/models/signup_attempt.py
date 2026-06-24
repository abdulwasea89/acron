"""SignupAttempt: feeds the admin signup audit feed (Section 7.6).

Each member-signup attempt is logged with its outcome so admins can spot abuse
(disposable emails, many attempts from one IP) and block/ignore entries.
"""

from __future__ import annotations

from sqlmodel import Field

from app.models.base import TimestampModel, UUIDModel


class SignupAttempt(UUIDModel, TimestampModel, table=True):
    __tablename__ = "signup_attempts"

    organization_id: str | None = Field(default=None, index=True)
    org_code: str | None = Field(default=None, index=True)
    email: str | None = Field(default=None, index=True)
    ip_address: str | None = None
    status: str = Field(default="started", index=True)  # started/succeeded/payment_pending/abandoned/suspicious
    suspicious: bool = False
    reason: str | None = None
