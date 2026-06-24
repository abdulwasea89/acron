"""Shared SQLModel base helpers: UUID primary keys and timestamps.

Every table uses a string UUID primary key (portable across SQLite and
Postgres) and carries created/updated timestamps. Tenant-scoped tables also
carry ``organization_id`` for row-level isolation.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def gen_uuid() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    # Naive UTC — see app.core.security.now_utc for rationale.
    return datetime.now(timezone.utc).replace(tzinfo=None)


class UUIDModel(SQLModel):
    id: str = Field(default_factory=gen_uuid, primary_key=True, index=True)


class TimestampModel(SQLModel):
    created_at: datetime = Field(default_factory=utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=utcnow, nullable=False)
