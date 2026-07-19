"""Typed helpers for publishing realtime events (Section 16).

Each helper wraps ``manager.broadcast`` with a stable ``{type, ...}`` envelope so
web and mobile clients can switch on ``event["type"]``. Call these *after* the
state change is committed-safe (the request's session will commit on success).
Broadcasts are best-effort and never raise into the caller.
"""

from __future__ import annotations

from app.realtime.manager import manager


async def publish(org_id: str, event_type: str, payload: dict | None = None) -> None:
    await manager.broadcast(org_id, {"type": event_type, **(payload or {})})


async def plan_changed(org_id: str, *, plan_id: str, action: str) -> None:
    await publish(org_id, "plan.changed", {"plan_id": plan_id, "action": action})


async def class_changed(org_id: str, *, class_session_id: str, action: str) -> None:
    await publish(org_id, "class.changed", {"class_session_id": class_session_id, "action": action})


async def gym_status_changed(org_id: str, *, gym_status: str) -> None:
    await publish(org_id, "gym_status.changed", {"gym_status": gym_status})


async def receipt_processed(org_id: str, *, receipt_id: str, status: str) -> None:
    await publish(org_id, "receipt.processed", {"receipt_id": receipt_id, "status": status})


async def payment_recorded(org_id: str, *, payment_id: str, member_id: str | None) -> None:
    await publish(org_id, "payment.recorded", {"payment_id": payment_id, "member_id": member_id})


async def check_in(org_id: str, *, member_id: str) -> None:
    await publish(org_id, "shift.check_in", {"member_id": member_id})


async def sessions_changed(org_id: str) -> None:
    await publish(org_id, "sessions.changed")
