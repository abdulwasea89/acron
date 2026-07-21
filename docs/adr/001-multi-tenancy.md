# ADR 001: Multi-Tenancy via Organization Isolation

## Context
The platform serves multiple gyms. Each gym's data must be completely isolated from every other gym. A data breach at one gym must never leak another gym's members, payments, or plans.

## Decision
Use **logical multi-tenancy** via a single shared database with `organization_id` on every table.

- Every API request includes an `X-Organization-Id` header that must match the JWT's `org_id` claim
- All SQL queries filter by `organization_id`
- Row-Level Security (RLS) at the database level as a second defense layer
- One person can belong to multiple orgs via `organization_members` join table, but each session is scoped to exactly one org

## Consequences
- Simple deployment (single DB, no per-tenant provisioning)
- Lower operational overhead than database-per-tenant
- RLS prevents accidental cross-org reads even if application-level filtering fails
- All queries must be scoped — a missing `organization_id` filter is a security bug
