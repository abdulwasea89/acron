"""Expo push notifications with dev-stub fallback (Section 11.1 step 6)."""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from app.core.config import settings

logger = logging.getLogger("push")


@dataclass
class SentPush:
    to: str
    title: str
    body: str


outbox: list[SentPush] = []


async def send_push(token: str | None, title: str, body: str) -> None:
    outbox.append(SentPush(to=token or "", title=title, body=body))
    if not token:
        logger.info("[push-stub] (no token) title=%s", title)
        return
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            await client.post(
                settings.expo_push_url,
                json={"to": token, "title": title, "body": body},
            )
    except Exception as exc:  # pragma: no cover
        logger.warning("[push] send failed: %s", exc)
