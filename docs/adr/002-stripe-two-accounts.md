# ADR 002: Two Separate Stripe Accounts

**Status:** Accepted

## Context
The platform processes two kinds of payments: SaaS subscription fees from gym owners and member membership fees paid to gyms. These must never be commingled.

## Decision
Maintain two completely separate Stripe accounts:

1. **Platform Stripe** — Owned by the platform provider. Used only for SaaS subscription billing (gym owners pay here). This is the platform's revenue.
2. **Stripe Connect Standard** — Each gym creates their own Stripe Connect account during onboarding. Member payments flow directly into the gym's bank account. The platform never touches this money.

## Consequences
- Zero PCI scope expansion — platform never handles member card data
- Gyms get money directly in their bank accounts within 2 business days
- Platform only touches its own SaaS fee
- More onboarding friction (gym owners must complete Stripe Connect signup)
- Two webhook endpoints, two sets of event handling
