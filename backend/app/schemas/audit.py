"""Audit log schemas: response + filters (Section 16.1)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: str
    action: str
    actor_user_id: str | None = None
    actor_email: str | None = None
    actor_name: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    old_values: dict | None = None
    new_values: dict | None = None
    metadata: dict | None = None
    ip_address: str | None = None
    created_at: datetime


class AuditLogPage(BaseModel):
    items: list[AuditLogOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class AuditActionGroup(BaseModel):
    domain: str
    actions: list[str]
