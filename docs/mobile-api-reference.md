# Mobile API Reference

Living reference for building against the backend from the Expo app
(`mobileapp/`). All endpoints are prefixed with `/api/v1`. Base URL:
`EXPO_PUBLIC_API_URL ?? http://localhost:8000` (see `mobileapp/src/lib/api.ts`).

## Transport & security

- **Auth**: `Authorization: Bearer <accessToken>` (15-min) + refresh flow.
- **Tenancy**: every request also sends `X-Organization-Id`. The JWT `org_id`
  MUST match this header — the backend rejects mismatches (`app/api/deps.py`).
- **Idempotency**: state-changing POSTs must pass an `Idempotency-Key` header.
  In `mobileapp` use `{ idempotent: true }` in `api.post(...)` so the client
  generates/sends the UUID. The server dedupes; a duplicate returns the cached
  first result (zero double-charges).
- **403** on capability-gated endpoints means the user's role lacks permission —
  hide the UI section rather than showing an error (see `useGet`'s `forbidden`).
- **MFA**: login returns `428` or `requires_mfa: true` → route to `(auth)/mfa`.

## Role → mobile group routing

On login (`mobileapp/src/app/(auth)/login.tsx`) the role decides the redirect:

| Role | Group | Route |
|------|-------|-------|
| member | `(member)` | `/(member)/dashboard` |
| trainer, front_desk | `(staff)` | `/(staff)/dashboard` |
| owner, manager | `(admin)` | `/(admin)/dashboard` |

Each group is a tab navigator (Ionicons via `@expo/vector-icons`; glyph maps in
each `_layout.tsx`, chrome in `components/tab-bar.tsx`). Owner/manager may also
holder `member` capabilities in a second org — handled by switching org via
`X-Organization-Id`.

## Endpoints used by the app

### Session & profile
- `GET /auth/me` → `{ user_id, email, org_id, role, member_id, member_status }`
- `GET /auth/me/profile` → `ProfileOut` (has `full_name`)
- `POST /auth/member-login` — body `{ org_code, email, password, remember }` →
  `LoginResponse`. Vague error on failure (never reveals which field).
- `POST /auth/login` — admin/staff login (no org code).

### Organization
- `GET /organizations/me` → `OrganizationOut`:
  `id, name, org_code, saas_tier, saas_status, enrollment_mode, gym_status,
  member_cap, stripe_connect_status, accent_color, logo_url`.
  > **Note**: `currency` is NOT in the payload — default money display to `USD`.
- `GET /organizations/me/checklist` → `SetupChecklist` (admin setup checklist).

### Classes
- `GET /classes` → `ClassSessionOut[]` (org-wide; no member-scoped endpoint, so
  member dashboards show today's sessions as the "Today's schedule" list).

### Staff shifts
- `GET /staff/shifts/current` → `ShiftOut | null`
- `POST /staff/shifts/check-in` → 201
- `POST /staff/shifts/check-out`

### Analytics (staff/admin), receipts, tasks, members
- `GET /analytics/headline` → `HeadlineMetrics`:
  `today_check_ins, today_revenue, pending_receipts, pending_approvals,
  active_members`.
- `GET /receipts/review-queue` → `ReceiptReviewItem[]` (admin approval queue).
- `GET /staff/tasks` → `TaskOut[]` (requires `ASSIGN_TASKS`; 403 → hide section).
- `GET /members/approval-queue` → `MemberDirectoryItem[]` (enrollment approvals).

## Capability matrix (which roles may call what)

Matrix lives in `backend/app/core/permissions.py` (`Capability` + `_MATRIX`).

| Capability | Roles |
|-----------|-------|
| `TOGGLE_GYM_STATUS` | owner, manager, front_desk |
| `ASSIGN_TASKS` | owner, manager, trainer (to self) |
| `MANAGE_SETTINGS` | owner, manager |
| `LOG_CASH_PAYMENT` | owner, manager, front_desk |
| `APPROVE_RECEIPTS` | owner, manager, front_desk |
| Revenue analytics | owner, manager |

## Member status semantics

`pending_payment` → `active` → `grace` → `expired` (also `frozen`,
`cancelled`, `banned`, `pending_approval`). Member dashboards show a status
banner (grace/expired = "Payment due", pending_approval = awaiting admin).

## Mobile conventions

- **Styling**: Tailwind v4 via Uniwind + `heroui-native` (compound components,
  `onPress`, not `onClick`). Use semantic tokens (`bg-surface`,
  `bg-surface-tertiary`, `bg-accent`, `text-accent`, `text-muted`,
  `bg-success`) — avoid Tailwind alpha modifiers (`bg-x/25`) which are not
  proven in this codebase's Uniwind.
- **Formatting**: `src/lib/format.ts` (`money`, `formatTime`, `formatDay`,
  `greeting`, `daysUntil`, `relativeDeadline`, `firstName`).
- **Data fetching**: `src/hooks/use-api.ts` `useGet` (loading/error/forbidden).
- **Skeletons/errors**: `src/components/dashboard-skeleton.tsx`,
  `dashboard-states.tsx` (`DashboardError` + retry).
- **Screen shell**: `src/components/app-screen.tsx` (title header + scroll) and
  `auth-screen.tsx` (auth flow shell). Both pad `insets.top + 24` under the
  status bar.