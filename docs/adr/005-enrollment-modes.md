# ADR 005: Three Enrollment Modes

**Status:** Accepted

## Context
Different gyms have different onboarding preferences. Some want anyone to join freely, others want to vet prospects, and some want complete control over who joins.

## Decision
Support three enrollment modes configurable in gym settings:

1. **Open** — Anyone with the org code signs up and pays immediately. Lowest friction.
2. **Approved** — Prospect signs up and sets password, then is placed in `pending_approval` status. Admin reviews and either approves (moves to `pending_payment`) or rejects (moves to `cancelled`). Email notification sent either way.
3. **Invite-only** — Org code signup is disabled. Members can only join via a single-use invite code sent by email from an admin.

## Branching Logic
- `start_signup()` blocks INVITE_ONLY at the first step
- `set_password()` branches: OPEN → PENDING_PAYMENT, APPROVED → PENDING_APPROVAL
- `pay_and_activate()` blocks if status is PENDING_APPROVAL
- `redeem_invite()` handles the INVITE_ONLY path separately

## Consequences
- More complex signup flow with conditional branching
- Admin needs a dedicated approval queue UI (approvals page)
- INVITE_ONLY requires email delivery to function
- Approval decisions are audited for compliance
