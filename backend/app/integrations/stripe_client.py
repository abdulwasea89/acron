"""Stripe Platform abstraction for SaaS billing + a stub fallback.

When no real Stripe key is configured (``settings.stripe_live`` is False), every
method returns a deterministic fake object so registration/billing flows run
end-to-end locally. The same ``idempotency_key`` is always passed through to
Stripe (Security Rule #2, Section 13.5).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from app.core.config import settings

try:
    import stripe as _stripe
except Exception:  # pragma: no cover
    _stripe = None


@dataclass
class FakePaymentIntent:
    id: str
    status: str
    amount: int
    currency: str
    client_secret: str


def _fake_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:24]}"


class StripePlatform:
    """SaaS-side Stripe (the platform's own account)."""

    def __init__(self) -> None:
        self.live = settings.stripe_live
        if self.live and _stripe is not None:
            _stripe.api_key = settings.stripe_secret_key

    async def create_customer(self, email: str, name: str | None = None) -> str:
        if not self.live:
            return _fake_id("cus")
        cust = _stripe.Customer.create(email=email, name=name)
        return cust.id

    async def charge_first_month(
        self, *, customer_id: str, amount_cents: int, currency: str, idempotency_key: str
    ) -> FakePaymentIntent:
        """Charge the first SaaS month immediately (Section 3.2.2)."""

        if not self.live:
            return FakePaymentIntent(
                id=_fake_id("pi"),
                status="succeeded",
                amount=amount_cents,
                currency=currency,
                client_secret=_fake_id("secret"),
            )
        pi = _stripe.PaymentIntent.create(
            amount=amount_cents,
            currency=currency,
            customer=customer_id,
            confirm=True,
            idempotency_key=idempotency_key,
            automatic_payment_methods={"enabled": True, "allow_redirects": "never"},
        )
        return FakePaymentIntent(
            id=pi.id, status=pi.status, amount=pi.amount, currency=pi.currency,
            client_secret=pi.client_secret or "",
        )

    async def create_subscription(self, *, customer_id: str, tier: str) -> str:
        if not self.live:
            return _fake_id("sub")
        # In production: map tier -> price_id and create a real subscription.
        return _fake_id("sub")


platform_stripe = StripePlatform()
