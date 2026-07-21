# Payment Flows

> Card, cash, receipt upload, and idempotency workflows.

## Card Payment (Online)
1. Member selects plan → client generates idempotency key
2. POST to backend with plan ID + idempotency key
3. Backend creates Stripe PaymentIntent via gym's Connect account
4. Stripe returns client_secret → frontend confirms card via Stripe Elements
5. Webhook `payment_intent.succeeded` → activate membership
6. Webhook `payment_intent.payment_failed` → notify member, allow retry

## Cash Payment (Front Desk)
1. Staff searches member, enters amount + plan
2. Payment record created with `method = cash`, `logged_by = staff_id`
3. Member status → Active
4. Receipt PDF generated and emailed to member
5. Counts toward end-of-day cash reconciliation

## Receipt Upload (Offline Proof)
1. Member uploads receipt photo (camera or gallery, max 10MB)
2. AI verification pipeline runs (OCR → authenticity → dedup → validation)
3. >= 95% confidence → auto-approve, member activated
4. 70-94% → admin review queue
5. < 70% → admin queue flagged suspicious

## Idempotency Flow
- Client generates UUID, saves locally, sends as header
- Server: never seen → claim + process; completed → return cached; in_progress → 409
- Reconciliation worker cleans stuck keys every 2 minutes
