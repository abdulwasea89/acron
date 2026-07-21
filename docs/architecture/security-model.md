# Security Model

> Authentication, authorization, tenant isolation, and session management.

## Authentication
- Passwords: 12+ chars, mixed case, numbers, symbols, checked against HIBP
- JWT: 15-minute access token + 7-day refresh token
- HTTP-only cookies (not localStorage) to prevent XSS
- Email verification required before any action (6-digit code, 10-min expiry)

## Authorization (RBAC)
- 5 roles: Owner, Manager, Trainer, Front Desk, Member
- Capability matrix as single source of truth (`permissions.py`)
- Route handlers use `require_capability()` dependency — never hard-code role lists

## Tenant Isolation
- JWT scoped to single `organization_id`
- `X-Organization-Id` header checked against JWT on every request
- RLS at database level as second defense
- Multi-org users have separate sessions per org

## Session Management
- Every session tracked centrally in `sessions` table
- Owner can revoke any session instantly
- Refresh token invalidated on revocation
- Device info, IP, and user agent logged per session
