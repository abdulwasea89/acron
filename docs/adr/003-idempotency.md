# ADR 003: Idempotency on All State-Changing Operations

## Context
Payment systems have a critical failure mode: double-charging. A member taps "Pay", loses signal, taps again. Without protection, they get charged twice. This also applies to refunds, class bookings, member invitations, and payroll runs.

## Decision
Require an `Idempotency-Key` header on all POST / PUT / PATCH / DELETE requests.

- Client generates a UUID before sending the request and saves it locally
- Server checks the idempotency table: if the key was seen and completed, return the cached response
- If the key was seen and still in_progress, return 409 Conflict
- If the key is new, claim it, mark in_progress, process the request, mark completed
- A stuck-payment reconciliation worker runs every 2 minutes, querying Stripe for keys stuck in_progress longer than 30 seconds

## Consequences
- Zero double-charges even under network failures
- Slight storage overhead for the idempotency table
- Client must be able to generate and persist UUIDs locally
- Reconciliation worker handles edge cases where the server crashes mid-processing
