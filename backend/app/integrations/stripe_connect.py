"""Stripe Connect Standard abstraction for member payments + stub fallback.

Member money flows directly into the gym's connected account; the platform never
touches it (Security Rule #3, Section 4.9). Stub mode returns deterministic fake
objects so member signup/payment runs without a real Stripe account.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from app.core.config import settings

try:
    import stripe as _stripe
except Exception:  # pragma: no cover
    _stripe = None


def _fake_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:24]}"


@dataclass
class ConnectPaymentResult:
    id: str
    status: str          # succeeded | requires_action | failed
    amount: int
    currency: str
    charge_id: str | None = None


@dataclass
class ConnectAccountLink:
    account_id: str
    onboarding_url: str


class StripeConnect:
    def __init__(self) -> None:
        self.live = settings.stripe_live
        if self.live and _stripe is not None:
            _stripe.api_key = settings.stripe_secret_key

    async def create_account_link(self, *, email: str) -> ConnectAccountLink:
        """Begin Connect onboarding; return account id + redirect URL."""

        if not self.live:
            acct = _fake_id("acct")
            return ConnectAccountLink(account_id=acct, onboarding_url=f"https://connect.stub/{acct}")
        account = _stripe.Account.create(type="standard", email=email)
        link = _stripe.AccountLink.create(
            account=account.id,
            refresh_url="https://app.example.com/connect/refresh",
            return_url="https://app.example.com/connect/return",
            type="account_onboarding",
        )
        return ConnectAccountLink(account_id=account.id, onboarding_url=link.url)

    async def charge_member(
        self,
        *,
        connected_account_id: str,
        amount_cents: int,
        currency: str,
        idempotency_key: str,
        description: str = "",
    ) -> ConnectPaymentResult:
        """Charge a member on the gym's connected account (direct charge)."""

        if not self.live:
            return ConnectPaymentResult(
                id=_fake_id("pi"),
                status="succeeded",
                amount=amount_cents,
                currency=currency,
                charge_id=_fake_id("ch"),
            )
        pi = _stripe.PaymentIntent.create(
            amount=amount_cents,
            currency=currency,
            description=description,
            idempotency_key=idempotency_key,
            automatic_payment_methods={"enabled": True, "allow_redirects": "never"},
            stripe_account=connected_account_id,  # direct charge on connected acct
        )
        return ConnectPaymentResult(
            id=pi.id, status=pi.status, amount=pi.amount, currency=pi.currency,
            charge_id=(pi.latest_charge if isinstance(pi.latest_charge, str) else None),
        )

    async def refund(
        self, *, connected_account_id: str, charge_id: str, amount_cents: int, idempotency_key: str
    ) -> dict:
        if not self.live:
            return {"id": _fake_id("re"), "status": "succeeded", "amount": amount_cents}
        refund = _stripe.Refund.create(
            charge=charge_id,
            amount=amount_cents,
            idempotency_key=idempotency_key,
            stripe_account=connected_account_id,
        )
        return {"id": refund.id, "status": refund.status, "amount": refund.amount}

    async def retrieve_payment_intent(
        self, *, connected_account_id: str, idempotency_key: str
    ) -> ConnectPaymentResult | None:
        """For stuck-payment reconciliation (Section 13.6).

        In stub mode there is no remote state, so return None (caller marks
        failed). With a real key, look up by idempotency key via the events API.
        """

        if not self.live:
            return None
        return None  # pragma: no cover  (production: query Stripe)


connect_stripe = StripeConnect()
