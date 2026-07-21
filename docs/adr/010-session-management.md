# ADR 010: Session Management

**Status:** Accepted

## Context
Users need persistent authentication across web and mobile. Sessions must be revocable by the gym owner. Refresh tokens reduce login frequency while maintaining security.

## Decision
Use a dual-token JWT system with server-side session tracking:

- **Access token** — 15-minute lifetime, stateless JWT containing `user_id`, `organization_id`, `role`
- **Refresh token** — 7-day lifetime, stored in `sessions` table with device info and IP
- Every session is tracked centrally; owner can revoke any session from the admin panel
- Refresh token rotation: each refresh issues a new token and invalidates the old one
- HTTP-only cookies for both tokens (not localStorage)

## Consequences
- Short access tokens limit damage if a token is stolen
- Session tracking provides audit trail for "who was logged in where"
- Revocation is instant — the refresh endpoint checks the revoked flag
- Users need to re-authenticate every 7 days at most
