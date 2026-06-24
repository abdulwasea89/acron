"""User: cross-tenant identity (Section: Database Core Schema).

One user (one email) can belong to multiple organizations via
OrganizationMember rows. Password and MFA config live here; role/status live on
the membership.
"""

from __future__ import annotations

from datetime import datetime

from sqlmodel import Field

from app.models.base import TimestampModel, UUIDModel


class User(UUIDModel, TimestampModel, table=True):
    __tablename__ = "users"

    email: str = Field(index=True, unique=True)
    full_name: str | None = None
    hashed_password: str
    email_verified: bool = False

    # MFA (Section 5.5)
    mfa_enabled: bool = False
    mfa_secret: str | None = None

    # Auth hardening (Section 5.7)
    failed_login_count: int = 0
    locked_until: datetime | None = None
    last_login_at: datetime | None = None

    is_active: bool = True
