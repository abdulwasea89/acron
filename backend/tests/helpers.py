"""Test helpers."""

from __future__ import annotations

import re

from app.integrations.email import outbox


def latest_code_for(email: str) -> str:
    """Extract the 6-digit code from the most recent email to ``email``."""

    for mail in reversed(outbox):
        if mail.to == email.lower() or mail.to == email:
            m = re.search(r"\b(\d{6})\b", mail.body)
            if m:
                return m.group(1)
    raise AssertionError(f"No code email found for {email}")


def latest_token_for(email: str, marker: str = "reset: ") -> str:
    for mail in reversed(outbox):
        if mail.to in (email.lower(), email) and marker in mail.body:
            return mail.body.split(marker, 1)[1].strip()
    raise AssertionError(f"No token email found for {email}")
