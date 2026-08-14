"""In-app notifications routes (per-user alert feed).

Any authenticated member/staff/owner can read and manage their own alerts. Every
query is scoped to (org, recipient user) so alerts never cross tenants or users.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session, get_tenant
from app.core.tenancy import TenantContext
from app.schemas.notifications import NotificationOut, UnreadCountOut
from app.services import notifications_service as notifications

router = APIRouter()


def _to_out(n) -> NotificationOut:
    data = None
    if n.data:
        try:
            data = json.loads(n.data)
        except (ValueError, TypeError):
            data = {}
    return NotificationOut(
        id=n.id,
        category=n.category.value,
        title=n.title,
        body=n.body,
        data=data,
        read=n.read_at is not None,
        created_at=n.created_at,
    )


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    ctx: TenantContext = Depends(get_tenant),
    session: AsyncSession = Depends(get_session),
):
    return [_to_out(n) for n in await notifications.list_notifications(session, org_id=ctx.org_id, user_id=ctx.user_id)]


@router.get("/unread-count", response_model=UnreadCountOut)
async def unread_count(
    ctx: TenantContext = Depends(get_tenant),
    session: AsyncSession = Depends(get_session),
):
    return UnreadCountOut(count=await notifications.unread_count(session, org_id=ctx.org_id, user_id=ctx.user_id))


@router.post("/read-all", response_model=UnreadCountOut)
async def read_all(
    ctx: TenantContext = Depends(get_tenant),
    session: AsyncSession = Depends(get_session),
):
    count = await notifications.mark_all_read(session, org_id=ctx.org_id, user_id=ctx.user_id)
    return UnreadCountOut(count=count)


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def read_one(
    notification_id: str,
    ctx: TenantContext = Depends(get_tenant),
    session: AsyncSession = Depends(get_session),
):
    n = await notifications.mark_read(session, org_id=ctx.org_id, user_id=ctx.user_id, notification_id=notification_id)
    if n is None:
        raise HTTPException(status_code=404, detail="Notification not found.")
    return _to_out(n)