# Admin API Flows

## Organization Configuration
- GET /organizations/me — get org details
- PATCH /organizations/me/enrollment — set enrollment mode
- POST /organizations/me/connect — start Stripe Connect onboarding
- POST /organizations/me/rotate-code — rotate org code

## Plan Management
- GET /plans — list all plans
- POST /plans — create plan
- PUT /plans/{id} — update plan
- POST /plans/{id}/publish — publish draft plan
- POST /plans/{id}/archive — archive published plan

## Payroll
- GET /payroll/runs — list payroll runs
- POST /payroll/runs — create draft run
- PUT /payroll/runs/{id} — update entries
- POST /payroll/runs/{id}/finalize — lock + generate stubs
- POST /payroll/runs/{id}/pay — mark as paid

## Staff Management
- GET /staff — list staff members
- POST /staff/invite — send staff invite
- PATCH /staff/{id}/rates — update compensation
- POST /staff/shifts/check-in — start shift
- POST /staff/shifts/check-out — end shift

## Analytics
- GET /analytics/headline — headline metrics
- GET /analytics/revenue — revenue breakdown
- GET /analytics/exports — CSV export

## Audit
- GET /audit — paginated audit log
- GET /audit/actions — distinct action types

## Receipts
- GET /receipts/review-queue — pending reviews
- POST /receipts/{id}/review — approve/reject receipt
- POST /receipts/{id}/reverse — reverse auto-approval
