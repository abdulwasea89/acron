# ADR 011: Audit Logging

**Status:** Accepted

## Context
Every state change in the system must be recorded for compliance, debugging, and dispute resolution. This includes membership status changes, payments, plan edits, payroll runs, and admin actions.

## Decision
Use a centralized `audit_logs` table with a structured schema:

- `action` — dotted string like `member.approved`, `payment.created`, `plan.archived`
- `actor_user_id` — who performed the action (null for system events)
- `entity_type` + `entity_id` — what was changed
- `old_values` / `new_values` — JSON snapshots of the changed fields
- `metadata` — extra context (reason, IP, request ID)
- `organization_id` — for tenant-scoped queries

## Consequences
- Every action is self-documenting with before/after snapshots
- The UI can show a full searchable audit trail
- Storage grows linearly with usage — older logs archived after 90 days
- No soft deletes — `DELETE` operations record the deleted data in `old_values`
