"""In-app notifications schemas (per-user alert feed)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: str
    category: str
    title: str
    body: str
    data: dict[str, Any] | None = None
    read: bool
    created_at: datetime


class UnreadCountOut(BaseModel):
    count: int