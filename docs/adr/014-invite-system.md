# ADR 014: Invite System

**Status:** Accepted

## Context
Invite-only enrollment mode requires a mechanism for admins to send single-use invitations to prospects. These must tie a specific email to a unique code that expires.

## Decision
Use the existing verification token system for invites:

- Admin enters email → system creates a pending member with `PENDING_ACTIVATION` status
- A `MEMBER_INVITE` verification token is generated (single-use, expiring)
- Token is sent via email to the prospect
- Prospect clicks the link or enters the code in the app → account is activated
- Code is tied to the email — cannot be used by a different email address
- Invite-only mode blocks the standard "Join with code" flow at the first step

## Consequences
- Reuses the existing verification infrastructure (no new tables)
- Single-use tokens prevent brute-force guessing
- Email delivery is critical — if email fails, the invite is stuck
- Admin can resend invites for pending members
