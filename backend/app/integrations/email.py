"""Transactional email with a dev-stub fallback.

When no provider is configured (no Resend key / SMTP URL), emails are captured
in an in-memory outbox and logged. Tests and local flows can read the outbox to
assert what would have been sent (e.g. verification codes).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import httpx

from app.core.config import settings

logger = logging.getLogger("email")


@dataclass
class SentEmail:
    to: str
    subject: str
    body: str
    attachments: list[str] = field(default_factory=list)


# Dev outbox — inspectable in tests / local dev.
outbox: list[SentEmail] = []


async def send_email(
    to: str, subject: str, body: str, attachments: list[str] | None = None
) -> None:
    record = SentEmail(to=to, subject=subject, body=body, attachments=attachments or [])
    outbox.append(record)

    if settings.resend_api_key:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                    json={
                        "from": settings.email_from,
                        "to": [to],
                        "subject": subject,
                        "text": body,
                    },
                )
            return
        except Exception as exc:  # pragma: no cover
            logger.warning("Resend send failed, captured in outbox: %s", exc)
            return

    # Stub mode: just log.
    logger.info("[email-stub] to=%s subject=%s", to, subject)
