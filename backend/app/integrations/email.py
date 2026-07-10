"""Transactional email with a dev-stub fallback.

When no provider is configured (no Resend key / SMTP URL), emails are captured
in an in-memory outbox and logged. Tests and local flows can read the outbox to
assert what would have been sent (e.g. verification codes).
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field

import resend

from app.core.config import settings

logger = logging.getLogger("email")

if settings.resend_api_key:
    resend.api_key = settings.resend_api_key


@dataclass
class SentEmail:
    to: str
    subject: str
    body: str
    attachments: list[str] = field(default_factory=list)


# Dev outbox — inspectable in tests / local dev.
outbox: list[SentEmail] = []


def _send_sync(params: resend.Emails.SendParams) -> dict:
    return resend.Emails.send(params)


class EmailDeliveryError(Exception):
    """Raised when a configured provider rejects/fails to deliver an email.

    Carries the provider's message so user-facing flows (invites, verification)
    can surface *why* delivery failed instead of falsely reporting success.
    """


async def send_email(
    to: str, subject: str, body: str, attachments: list[str] | None = None
) -> bool:
    """Send an email. Returns True if delivered (or captured in stub mode).

    Raises ``EmailDeliveryError`` when a real provider is configured but rejects
    the message (e.g. Resend's unverified-domain 403). Callers that must not fail
    on a delivery error (background fan-out) can catch it; user-facing flows let
    it propagate so the UI shows the real reason.
    """

    record = SentEmail(to=to, subject=subject, body=body, attachments=attachments or [])
    outbox.append(record)

    if settings.resend_api_key:
        try:
            params: resend.Emails.SendParams = {
                "from": settings.email_from,
                "to": [to],
                "subject": subject,
                "html": f"<p>{body}</p>",
            }
            result = await asyncio.to_thread(_send_sync, params)
            logger.info("Email sent to=%s subject=%s id=%s", to, subject, result.get("id", "?"))
            return True
        except Exception as exc:
            # Do NOT swallow silently — that made failed invites look successful.
            logger.warning("Resend send failed: to=%s error=%s", to, exc)
            raise EmailDeliveryError(str(exc)) from exc

    # Stub mode (no provider configured): capture in the outbox + log.
    logger.info("[email-stub] to=%s subject=%s body=%s", to, subject, body)
    return True


async def send_email_safe(
    to: str, subject: str, body: str, attachments: list[str] | None = None
) -> bool:
    """Best-effort send for side-effect notifications (receipts, pay stubs,
    welcome notes). Never raises: a delivery failure must not roll back the
    primary action that triggered it. Returns True only if delivered."""

    try:
        return await send_email(to, subject, body, attachments)
    except EmailDeliveryError:
        return False
