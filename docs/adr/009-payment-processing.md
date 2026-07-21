# ADR 009: Payment Processing Architecture

**Status:** Accepted

## Context
The platform handles three distinct payment paths: online card payments, front-desk cash logging, and member-uploaded receipt proof. Each has different validation, idempotency, and reconciliation requirements.

## Decision
Route payments through a unified service layer with path-specific handlers:

1. **Card payments** — Stripe PaymentIntent via gym's Connect account, idempotency key from client, webhook-driven status updates
2. **Cash payments** — Direct DB write by authorized staff, triggers receipt PDF generation and member activation
3. **Receipt uploads** — Image → AI pipeline → auto-approve or admin review queue

## Consequences
- Stripe webhooks handle the asynchronous card settlement lifecycle
- Cash payments are instant but require end-of-day reconciliation
- Receipt uploads are the slowest path (AI processing time) but fully automated at high confidence
- All three paths update the same subscription and member status tables
