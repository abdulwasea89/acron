# ADR 016: Email Delivery

**Status:** Accepted

## Context
Transactional emails are critical for the platform: verification codes, welcome emails, pay stubs, approval notifications, and billing invoices. Delivery failures must be surfaced clearly.

## Decision
Use Resend as the primary email provider with SendGrid as fallback:

- **Primary:** Resend (modern API, high deliverability, React email support)
- **Fallback:** SendGrid (mature, widely used)
- All emails are sent asynchronously via background tasks
- Delivery failures are logged and surfaced to the caller
- In development/stub mode, emails are logged to console instead of sent
- Email templates are simple text-based (HTML in future iterations)

## Consequences
- Resend's API is clean and developer-friendly
- Async sending prevents email latency from blocking API responses
- Stub mode enables development without a real email provider
- Delivery failures are explicit — the caller knows if the email was sent
- No email queue yet — if Resend is down, emails are dropped (fallback to SendGrid planned)
