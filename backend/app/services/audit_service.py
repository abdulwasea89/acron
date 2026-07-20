"""Audit logging helper + query service (Section 16.1).

Every state-changing service calls ``record_audit`` to persist an immutable
trail entry. ``list_audit_logs`` and ``distinct_actions`` serve the audit log
viewer page.
"""

from __future__ import annotations

import json
import re
from typing import Any

from sqlalchemy import Select, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import col

from app.models.audit_log import AuditLog
from app.models.user import User


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


async def list_audit_logs(
    session: AsyncSession,
    *,
    organization_id: str,
    action: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    actor_user_id: str | None = None,
    search: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[dict], int]:
    base = (
        select(AuditLog, User.email, User.full_name)
        .where(AuditLog.organization_id == organization_id)
        .outerjoin(User, AuditLog.actor_user_id == User.id)
    )

    if action:
        base = base.where(AuditLog.action == action)
    if entity_type:
        base = base.where(AuditLog.entity_type == entity_type)
    if entity_id:
        base = base.where(AuditLog.entity_id == entity_id)
    if actor_user_id:
        base = base.where(AuditLog.actor_user_id == actor_user_id)
    if search:
        base = base.where(
            AuditLog.action.ilike(f"%{search}%")
            | AuditLog.entity_type.ilike(f"%{search}%")
            | AuditLog.entity_id.ilike(f"%{search}%")
        )
    if date_from:
        base = base.where(AuditLog.created_at >= date_from)
    if date_to:
        base = base.where(AuditLog.created_at <= date_to)

    count_q = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_q)).scalar() or 0

    offset = (page - 1) * page_size
    rows = (
        await session.execute(
            base.order_by(AuditLog.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
    ).all()

    items: list[dict] = []
    for audit_log, actor_email, actor_name in rows:
        items.append({
            "id": audit_log.id,
            "action": audit_log.action,
            "actor_user_id": audit_log.actor_user_id,
            "actor_email": actor_email,
            "actor_name": actor_name,
            "entity_type": audit_log.entity_type,
            "entity_id": audit_log.entity_id,
            "old_values": json.loads(audit_log.old_values_json) if audit_log.old_values_json else None,
            "new_values": json.loads(audit_log.new_values_json) if audit_log.new_values_json else None,
            "metadata": json.loads(audit_log.metadata_json) if audit_log.metadata_json else None,
            "ip_address": audit_log.ip_address,
            "created_at": audit_log.created_at,
        })

    return items, total


async def distinct_actions(session: AsyncSession, *, organization_id: str) -> list[dict[str, Any]]:
    rows = (
        await session.execute(
            select(AuditLog.action)
            .where(AuditLog.organization_id == organization_id)
            .distinct()
            .order_by(AuditLog.action)
        )
    ).scalars().all()

    groups: dict[str, set[str]] = {}
    for action in rows:
        domain = action.split(".")[0] if "." in action else "other"
        groups.setdefault(domain, set()).add(action)

    return [
        {"domain": domain, "actions": sorted(actions)}
        for domain, actions in sorted(groups.items())
    ]
