"""RFC 6238 TOTP for MFA (Section 5.5), implemented with the stdlib only.

No third-party dependency: the secret is a base32 string compatible with
authenticator apps (Google Authenticator, Authy, 1Password). ``provisioning_uri``
produces the ``otpauth://`` URI a client renders as a QR code. ``verify`` checks
the current 30-second window plus one step on each side to tolerate clock skew.

Time is injected as a parameter (``for_time``) rather than read from the clock
inside the algorithm, so verification stays deterministic and testable — callers
pass ``now_utc()``.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
from datetime import datetime, timezone

_DIGITS = 6
_PERIOD = 30  # seconds per code (RFC 6238 default)
_B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"


def generate_secret(length: int = 20) -> str:
    """Return a base32-encoded random secret (no padding), ~32 chars for 20 bytes."""

    raw = secrets.token_bytes(length)
    return base64.b32encode(raw).decode("ascii").rstrip("=")


def _normalize(secret: str) -> bytes:
    s = secret.strip().replace(" ", "").upper()
    s += "=" * (-len(s) % 8)  # restore base32 padding
    return base64.b32decode(s, casefold=True)


def _hotp(key: bytes, counter: int) -> str:
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF) % (10**_DIGITS)
    return str(code).zfill(_DIGITS)


def _epoch(for_time: datetime) -> int:
    if for_time.tzinfo is None:
        for_time = for_time.replace(tzinfo=timezone.utc)
    return int(for_time.timestamp())


def now_code(secret: str, *, for_time: datetime) -> str:
    """The valid code for ``for_time`` (used in stub mode / tests)."""

    return _hotp(_normalize(secret), _epoch(for_time) // _PERIOD)


def verify(secret: str, code: str, *, for_time: datetime, window: int = 1) -> bool:
    """True if ``code`` matches any step within +/- ``window`` of ``for_time``."""

    if not code or not code.strip().isdigit():
        return False
    code = code.strip()
    key = _normalize(secret)
    counter = _epoch(for_time) // _PERIOD
    for drift in range(-window, window + 1):
        if hmac.compare_digest(_hotp(key, counter + drift), code):
            return True
    return False


def provisioning_uri(secret: str, *, account_name: str, issuer: str) -> str:
    """otpauth:// URI for QR provisioning in an authenticator app."""

    from urllib.parse import quote

    label = quote(f"{issuer}:{account_name}")
    params = f"secret={secret}&issuer={quote(issuer)}&digits={_DIGITS}&period={_PERIOD}"
    return f"otpauth://totp/{label}?{params}"
