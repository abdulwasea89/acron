"""Have I Been Pwned password check (Security Rule #5, Section 4.2).

Uses the k-anonymity range API: only the first 5 chars of the SHA-1 hash are
sent. If HIBP is disabled or unreachable, we fail OPEN (allow the password) so a
network outage never blocks all registrations — complexity rules still apply.
"""

from __future__ import annotations

import hashlib

import httpx

from app.core.config import settings


async def password_is_pwned(password: str) -> bool:
    """Return True if the password appears in a known breach corpus."""

    if not settings.hibp_enabled:
        return False

    sha1 = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    prefix, suffix = sha1[:5], sha1[5:]
    url = f"{settings.hibp_api_url}/range/{prefix}"
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url, headers={"Add-Padding": "true"})
            resp.raise_for_status()
    except Exception:
        # Fail open: don't block signups if HIBP is down.
        return False

    for line in resp.text.splitlines():
        hash_suffix, _, _count = line.partition(":")
        if hash_suffix.strip().upper() == suffix:
            return True
    return False
