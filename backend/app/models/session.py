"""AuthSession: centrally-tracked auth sessions, revocable by owner (Section 5.9).

Stores only a hash of the refresh token. Revoking a session invalidates its
refresh token immediately. Org-code rotation revokes sessions authenticated via
the old code (Section 7.5).
"""

from __future__ import annotations

from datetime import datetime

from sqlmodel import Field

from app.models.base import TimestampModel, UUIDModel


class AuthSession(UUIDModel, TimestampModel, table=True):
    __tablename__ = "auth_sessions"

    user_id: str = Field(index=True, foreign_key="users.id")
    organization_id: str | None = Field(default=None, index=True)
    refresh_token_hash: str = Field(index=True)

    device_type: str | None = None
    os: str | None = None
    ip_address: str | None = None  # anonymized
    user_agent: str | None = None

    last_activity_at: datetime | None = None
    expires_at: datetime | None = None
    revoked: bool = Field(default=False, index=True)
    revoked_at: datetime | None = None
    remember_device: bool = False
