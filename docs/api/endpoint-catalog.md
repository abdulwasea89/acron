# API Endpoint Catalog

## Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/auth/register | Create owner account + organization |
| POST | /api/v1/auth/login | Authenticate with org code + email + password |
| POST | /api/v1/auth/refresh | Refresh JWT access token |
| POST | /api/v1/auth/logout | Revoke session |
| POST | /api/v1/auth/verify-email | Verify 6-digit email code |
| POST | /api/v1/auth/forgot-password | Request password reset |
| POST | /api/v1/auth/reset-password | Complete password reset |

## Organizations
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/organizations/me | Get current org details |
| PATCH | /api/v1/organizations/me/enrollment | Set enrollment mode |
| POST | /api/v1/organizations/me/connect | Start Stripe Connect onboarding |
| POST | /api/v1/organizations/me/rotate-code | Rotate org code |

## Members
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/members | List member directory |
| GET | /api/v1/members/approval-queue | List pending approvals |
| POST | /api/v1/members/{id}/approval | Approve or reject prospect |
| POST | /api/v1/members/{id}/status | Change member status |
| PATCH | /api/v1/members/{id}/role | Change member role |
| POST | /api/v1/members/invite | Send invite-only invite |
| POST | /api/v1/members/import | Bulk import from CSV |

## Plans
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/plans | List published plans |
| POST | /api/v1/plans | Create plan |
| PUT | /api/v1/plans/{id} | Update plan |
| POST | /api/v1/plans/{id}/publish | Publish plan |
| POST | /api/v1/plans/{id}/archive | Archive plan |

## Payments
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/payments/pay | Create payment intent |
| POST | /api/v1/payments/cash | Log cash payment |
| GET | /api/v1/payments | List payments |
| POST | /api/v1/payments/{id}/refund | Process refund |

## Staff
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/staff/shifts/current | Get current active shift |
| POST | /api/v1/staff/shifts/check-in | Check in for shift |
| POST | /api/v1/staff/shifts/check-out | Check out of shift |

## Audit
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/audit | List audit logs (paginated) |
| GET | /api/v1/audit/actions | List distinct audit actions |
