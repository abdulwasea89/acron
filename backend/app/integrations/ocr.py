"""AI receipt OCR + authenticity with a deterministic stub fallback (Section 10).

In production this would call GPT-4o Vision / Tesseract + a custom validator.
Without an API key it runs a deterministic stub that derives plausible fields and
a stable perceptual hash from the image bytes, so the full pipeline (extract ->
authenticity -> duplicate -> cross-validate -> score) runs locally and tests are
reproducible.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field

from app.core.config import settings


@dataclass
class OCRResult:
    raw_text: str
    amount: float | None
    date: str | None
    payer: str | None
    payee: str | None
    txn_id: str | None
    method: str | None
    authenticity_score: float          # 0..1
    perceptual_hash: str
    flags: list[str] = field(default_factory=list)


def _phash(image_bytes: bytes) -> str:
    """Stable content hash used as a stand-in for a perceptual hash."""

    return hashlib.sha256(image_bytes).hexdigest()[:32]


async def extract_receipt(
    image_bytes: bytes,
    *,
    expected_amount: float | None = None,
    expected_payee: str | None = None,
    payer_name: str | None = None,
) -> OCRResult:
    """Extract fields + authenticity signals from a receipt image."""

    ph = _phash(image_bytes)

    if settings.ocr_provider_api_key or settings.openai_api_key:
        # Production hook: call the real vision model here. Falls through to the
        # stub on any failure so the pipeline never hard-blocks in dev.
        result = await _real_extract(image_bytes, ph)
        if result is not None:
            return result

    # ---- Deterministic stub ----
    # Derive a pseudo-confidence from the hash so the same image scores the same.
    seed = int(ph[:8], 16)
    authenticity = 0.80 + (seed % 20) / 100.0  # 0.80..0.99
    flags: list[str] = []
    if seed % 7 == 0:
        flags.append("possible_edit_marks")
        authenticity -= 0.25

    return OCRResult(
        raw_text=f"STUB RECEIPT\nAmount: {expected_amount or 0}\nPayee: {expected_payee or ''}",
        amount=expected_amount,
        date=None,
        payer=payer_name,
        payee=expected_payee,
        txn_id=ph[:12].upper(),
        method="cash",
        authenticity_score=round(max(0.0, min(authenticity, 1.0)), 3),
        perceptual_hash=ph,
        flags=flags,
    )


async def _real_extract(image_bytes: bytes, ph: str) -> OCRResult | None:  # pragma: no cover
    """Placeholder for the real vision-model call. Returns None to use the stub."""

    return None
