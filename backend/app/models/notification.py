"""Notification: one in-app alert for a specific user within a tenant.

The notifications feed is per-recipient (Security Rule #1: tenant isolation) but
keyed by ``organization_id`` like every other table. ``data`` is a JSON string
carrying entity references (receipt_id, payment_id, task_id, …) so a client can
deep-link from an alert to the thing it describes.
"""

from __future__ import annotations

from datetime import datetime

from sqlmodel import Field

from app.core.constants import NotificationKind
from app.models.base import TimestampModel, UUIDModel


class Notification(UUIDModel, TimestampModel, table=True):
    __tablename__ = "notifications"

    organization_id: str = Field(index=True, foreign_key="organizations.id")
    recipient_user_id: str = Field(index=True, foreign_key="users.id")
    category: NotificationKind = Field(default=NotificationKind.SYSTEM, index=True)

    title: str
    body: str

    # JSON string payload (e.g. {"receipt_id": "…", "amount": 149.0}).
    data: str | None = Field(default=None)

    read_at: datetime | None = Field(default=None, index=True)