"""Per-user in-app notifications: create, list, read state.

Alerts are always scoped to (organization_id, recipient_user_id) so one user can
never read another's — the same double-filter used across the payments/members
routes (Security Rule #1). ``create_notification`` also pushes a per-recipient
WebSocket event so the mobile bell badge updates live.
"""

from __future__ import annotations

import json

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.constants import NotificationKind, Role
from app.core.security import now_utc
from app.models.membership import OrganizationMember
from app.models.notification import Notification
from app.realtime import events

DEFAULT_LIMIT = 50


def _dump(data: dict | None) -> str | None:
    return json.dumps(data) if data else None


async def create_notification(
    session: AsyncSession,
    *,
    org_id: str,
    recipient_user_id: str,
    category: NotificationKind,
    title: str,
    body: str,
    data: dict | None = None,
) -> Notification:
    """Insert one in-app alert for ``recipient_user_id`` and push it live.

    Does not commit (callers own the transaction). The WS push is best-effort
    and never raises into the caller.
    """

    notification = Notification(
        organization_id=org_id,
        recipient_user_id=recipient_user_id,
        category=category,
        title=title,
        body=body,
        data=_dump(data),
    )
    session.add(notification)
    await session.flush()
    await events.notification_created(org_id, user_id=recipient_user_id, notification_id=notification.id)
    return notification


async def notify_org_owners(
    session: AsyncSession,
    *,
    org_id: str,
    category: NotificationKind,
    title: str,
    body: str,
    data: dict | None = None,
) -> list[Notification]:
    """Fan an alert out to every owner (or manager if no owners) in the org."""

    stmt = select(OrganizationMember).where(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.role.in_([Role.OWNER.value, Role.MANAGER.value]),
        OrganizationMember.banned.is_(False),
    )
    admins = (await session.execute(stmt)).scalars().all()
    if not admins:
        return []
    created: list[Notification] = []
    for admin in admins:
        created.append(
            await create_notification(
                session,
                org_id=org_id,
                recipient_user_id=admin.user_id,
                category=category,
                title=title,
                body=body,
                data=data,
            )
        )
    return created


async def list_notifications(
    session: AsyncSession, *, org_id: str, user_id: str, limit: int = DEFAULT_LIMIT
) -> list[Notification]:
    """The user's alerts, newest first. Unread first keeps fresh items visible."""

    stmt = (
        select(Notification)
        .where(
            Notification.organization_id == org_id,
            Notification.recipient_user_id == user_id,
        )
        .order_by(Notification.read_at.is_(None).desc(), Notification.created_at.desc())
        .limit(max(1, min(limit, 200)))
    )
    return list((await session.execute(stmt)).scalars().all())


async def unread_count(session: AsyncSession, *, org_id: str, user_id: str) -> int:
    count = (
        await session.execute(
            select(func.count()).select_from(Notification).where(
                Notification.organization_id == org_id,
                Notification.recipient_user_id == user_id,
                Notification.read_at.is_(None),
            )
        )
    ).scalar_one()
    return int(count or 0)


async def mark_read(session: AsyncSession, *, org_id: str, user_id: str, notification_id: str) -> Notification | None:
    """Mark one alert read. Returns None if it isn't the user's alert."""

    notification = await session.get(Notification, notification_id)
    if notification is None or notification.organization_id != org_id:
        return None
    if notification.recipient_user_id != user_id:
        return None
    if notification.read_at is None:
        notification.read_at = now_utc()
        session.add(notification)
    return notification


async def mark_all_read(session: AsyncSession, *, org_id: str, user_id: str) -> int:
    """Mark every unread alert read. Returns the number marked."""

    stmt = (
        select(Notification)
        .where(
            Notification.organization_id == org_id,
            Notification.recipient_user_id == user_id,
            Notification.read_at.is_(None),
        )
    )
    unread = list((await session.execute(stmt)).scalars().all())
    now = now_utc()
    for n in unread:
        n.read_at = now
        session.add(n)
    return len(unread)