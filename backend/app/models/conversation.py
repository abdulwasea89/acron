"""Conversation: one assistant chat thread, scoped to a tenant and a user.

A thread belongs to the user who opened it *within* one organization — the same
person chatting in a different gym gets a separate thread, because the grounding
context (metrics, plans) is per-tenant. ``title`` is derived from the opening
prompt and may be revised by the model once it knows what the thread is about.
"""

from __future__ import annotations

from datetime import datetime

from sqlmodel import Field

from app.models.base import TimestampModel, UUIDModel


class Conversation(UUIDModel, TimestampModel, table=True):
    __tablename__ = "conversations"

    organization_id: str = Field(index=True, foreign_key="organizations.id")
    user_id: str = Field(index=True, foreign_key="users.id")

    title: str = Field(default="New chat")

    # Drives the history rail's ordering without a join onto messages.
    last_message_at: datetime = Field(index=True)
