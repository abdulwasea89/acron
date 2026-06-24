"""Org code generation (Section 4.7): 8-12 alphanumeric, e.g. IRON-PULS-3K9.

Derives a human-friendly prefix from the gym name plus a random suffix. The
caller is responsible for uniqueness (retry on collision).
"""

from __future__ import annotations

import re
import secrets

_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no ambiguous chars (I,O,0,1)


def _slug(name: str, size: int) -> str:
    letters = re.sub(r"[^A-Za-z]", "", name).upper()
    if len(letters) >= size:
        return letters[:size]
    return (letters + _rand(size)).ljust(size, "X")[:size]


def _rand(n: int) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(n))


def generate_org_code(name: str) -> str:
    """Build a code like ``IRON-PULS-3K9``."""

    words = [w for w in re.split(r"\s+", name.strip()) if w]
    first = _slug(words[0] if words else "GYM", 4)
    second = _slug(words[1], 4) if len(words) > 1 else _rand(4)
    suffix = _rand(3)
    return f"{first}-{second}-{suffix}"
