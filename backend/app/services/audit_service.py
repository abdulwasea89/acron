"""Audit logging helper (Security Rule #10).

Every state-changing service calls ``record_audit`` to persist an immutable
trail entry. The session is flushed by the caller's transaction.
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


async def record_audit(
    session: AsyncSession,
    *,
    action: str,
    organization_id: str | None = None,
    actor_user_id: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    old_values: Any = None,
    new_values: Any = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    metadata: dict | None = None,
) -> AuditLog:
    entry = AuditLog(
        action=action,
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values_json=json.dumps(old_values, default=str) if old_values is not None else None,
        new_values_json=json.dumps(new_values, default=str) if new_values is not None else None,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata_json=json.dumps(metadata, default=str) if metadata else None,
    )
    session.add(entry)
    return entry
