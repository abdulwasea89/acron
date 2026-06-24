"""Idempotency helpers: stable request-body hashing (Section 13.4)."""

from __future__ import annotations

import hashlib
import json
from typing import Any


def hash_request_body(body: Any) -> str:
    """Stable sha256 of a JSON-serializable body (order-independent)."""

    if body is None:
        normalized = ""
    elif isinstance(body, (bytes, bytearray)):
        normalized = body.decode("utf-8", "ignore")
    elif isinstance(body, str):
        normalized = body
    else:
        normalized = json.dumps(body, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
