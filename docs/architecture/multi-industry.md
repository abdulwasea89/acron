# Multi-Industry Blueprint — gym · office · academy (EXTREME DETAIL)

> **Status: DESIGN DOCUMENT ONLY — nothing here is implemented.**
> Approved direction: generalize the single-gym platform into one product that serves **three verticals** on a shared core + a declarative **Industry Registry** + per-vertical modules:
>
> 1. **Gyms & fitness** (`gym`) — existing behavior is the reference; must stay byte-for-byte compatible.
> 2. **Corporate offices / serviced & coworking space** (`office`) — desks, private offices, meeting rooms sold to **companies**; B2B invoicing. *Explicitly no gym/fitness flavor.*
> 3. **Education academies** (`academy`) — **courses → cohorts (batches)**, term tuition, **guardians** pay for students.
>
> `club` and `salon` are explicitly **out of scope**.
>
> Every claim about existing code cites the real file. New entities use the naming below consistently so implementation is unambiguous.

---

## 0. Existing-code seams this builds on (verified 2026-09-09)

| Concern | Where it lives today | Gym-only detail that must generalize |
|---|---|---|
| Venue type | `backend/app/models/organization.py:29` | `industry: str = "gym_fitness"` — **dormant**, nothing reads/writes it except migration `2cf…:75` |
| Venue status | `Organization.gym_status` (`GymStatus OPEN/CLOSED/HALF_DAY`) | Name/values gym-tinted but harmless |
| Setup checklist | `Organization.checklist_stripe_connected / _plan_published / _enrollment_configured / _staff_invited / _office_configured` (`organization.py:60-64`); built by `build_checklist()` (`app/services/organizations_service.py:212`) | Fixed 5 booleans; `SetupChecklist` schema (`app/schemas/organizations.py:66-73`) |
| Roles | `Role` enum OWNER/MANAGER/TRAINER/FRONT_DESK/MEMBER (`app/core/constants.py`) | `TRAINER`, `FRONT_DESK` are gym words |
| Capabilities | `Capability` (20 values) + `_MATRIX` (`app/core/permissions.py:14-59`); `role_has()` | Names like `book_classes`, `check_in_shift`, `log_cash_payment` |
| Registration | `POST /auth/register` (owner step 1) → `/auth/verify-email` → `POST /organizations/register` body `RegisterGymRequest{owner_email, details:GymDetails, tier, payment_token}` (`app/schemas/organizations.py:24-35`) | `GymDetails` has no industry |
| Plan/offer object | `membership_plans` (`app/models/plan.py`): `billing_type∈recurring|one_time_pack|drop_in`, `cycle_length/unit`, `auto_renew`, `trial_days`, `pack_size`, `validity_days`, `inclusions_json/rules_json`, `visibility/status/featured` | All fields are membership-shaped |
| Subscription | `subscriptions` (`app/models/subscription.py`): `plan_id`, `price_snapshot`, `current_period_end`, `grace_until`, `frozen_until`, `classes_remaining` | Grace/expiry tuned for monthly memberships |
| Schedule entity | `class_sessions` + `class_bookings` (`app/models/class_session.py`): title, `trainer_member_id`, `starts_at/ends_at`, `capacity`, `booked_count`, `trainer_checked_in`, `cancelled`; booking carries `idempotency_key` | Trainer-centric |
| Money | `payments` (`app/models/payment.py`): `kind∈saas_subscription|member_fee|trainer_payout`, `method∈card|cash|bank_transfer|mobile_wallet`, idempotency, refunds | `kind`/`method` need `space|tuition`-ish semantics + `invoice` |
| Money engine | `memberships_service.pay_and_activate`, `cash_service.log_cash_payment`, `receipts_service`, `payroll_service`, `classes_service.book_class` — all idempotent via `idempotency_service.claim/complete/fail` | Activation logic is membership-hardcoded |
| Web nav | `frontend/components/Sidebar.tsx:16-33` hardcoded `NAV` (16 items), "Gym Ops" wordmark | Nav not data-driven |
| Mobile routing | `mobileapp/src/components/auth-guard.tsx` `routeForRole()`; per-role tab bars in `(member)/_layout.tsx`, `(staff)/_layout.tsx`, `(admin)/_layout.tsx` | Hardcoded by role only |
| Analytics | `analytics_service.headline_metrics / revenue_analytics`; frontend `app/app/analytics/page.tsx`; mobile `gym-settings/revenue.tsx` | Revenue/churn assumptions |

**Known pre-existing correctness gaps the multi-industry work must NOT silently inherit** (already documented in repo memory; listed here so new vertical money code is designed correctly from the start): cash logging is not idempotent (`cash_service.log_cash_payment`); FAILED-idempotency replays return success (`pay_and_activate`, `refund`, `book_class`); GRACE is never entered by any code path; renewals stack ACTIVE `Subscription` rows instead of closing the prior one; live Stripe `charge_member` creates an unconfirmed PaymentIntent; `create_subscription` returns a fake id even in live mode; SaaS invoices have no backing rows. The academy/office verticals should be built against the *fixed* versions of these (see §9 money engine changes), not the buggy ones.

---

## 1. Naming & canonical identifiers (use everywhere, never deviate)

| Thing | Canonical value(s) |
|---|---|
| Industry keys | `gym`, `office`, `academy` (old `"gym_fitness"` values backfilled to `gym`) |
| Offer kinds (on `membership_plans`) | `membership` (gym, default), `space` (office), `course` (academy) |
| `Organization.industry` type | Python `Industry(str, Enum)` in `app/core/industry.py`; stored as string; default `gym` |
| Money modes | `consumer_connect` (gym, academy), `b2b_invoice` (office) |
| Role labels (display only) | gym: Trainer/Front desk; office: Space manager / Reception & Concierge; academy: Teacher / Registrar |
| `PaymentMethod` addition | `invoice` |
| Payer concepts | gym: member; office: **company** (billed) + **seat-holder** (person); academy: **guardian** (pays) + **student** (member) |

---

## 2. Industry Registry — full specification

New file **`backend/app/core/industry.py`** (mirrored to `shared/industries/{gym,office,academy}.json` + a generated TS module for web/mobile). Single source of truth. Contains:

### 2.1 Python model

```python
class Money(str, Enum): CONSUMER_CONNECT="consumer_connect"; B2B_INVOICE="b2b_invoice"
class ScheduleKind(str, Enum): CLASSES="classes"; SPACE="space"; COHORTS="cohorts"

@dataclass(frozen=True)
class Industry:
    key: str                        # gym | office | academy
    label: str
    tagline: str
    money: Money
    offer_kind: str                 # membership | space | course
    schedule: ScheduleKind
    org_code_fallback_prefix: str   # GYM | OFF | ACAD (only if generated code has no name)
    default_currency: str           # USD (configurable per org as today)
    default_accent: str             # brand hue hint for onboarding
    requires_connect: bool          # gym/academy True; office False
    checklist: tuple[str, ...]      # ordered step codes (see §6)
    modules: frozenset[str]         # enabled feature modules from MASTER_MODULES (see §5)
    capabilities_overrides: tuple[tuple[str, tuple[str,...]], ...]  # cap -> roles for THIS industry (over base)
    roles_labels: dict[str, str]    # Role.value -> display label
    member_noun: str                # "member" | "seat-holder" | "student"
    payer_noun: str                 # "member" | "company" | "guardian"
    offer_schema_path: str          # /industry-schemas/{key}-offer.json (served by backend)
    dashboards: dict[str, list[str]]  # role -> dashboard tile ids (see §5.4)
    analytics_headline: tuple[str,...]
    nav: dict[str, list[str]]       # role-group -> ordered web module ids (see §5.3)

INDUSTRIES: dict[str, Industry] = {"gym": ..., "office": ..., "academy": ...}
def get_industry(key: str) -> Industry: ...      # raises 404-ish KeyError -> 422 by caller
def valid_industry_keys() -> tuple[str, ...]
```

### 2.2 HTTP surface

New **`backend/app/api/v1/routes/industries.py`** (registered in `app/api/v1/router.py`, prefix `/industries`):

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /industries` | public | Catalog for the registration picker: `[{key,label,tagline,requires_connect,default_currency}]` |
| `GET /industries/{key}` | public | Full public `Industry` meta (incl. `roles_labels`, `member_noun`, `modules` — safe, no secrets) |
| `GET /industries/{key}/offer-schema` | public | JSON Schema v4 doc for that industry's offer builder (served from static JSON committed in `app/static/industry-schemas/`) |
| `GET /me/industry` | `get_tenant` | Current org's industry + labels/modules (drives web/mobile nav after login) |

`main.py` also mounts `app/static` so schemas are fetchable directly.

---

## 3. Data model — complete table-by-table change spec

### 3.1 Core (edited) — migrate in ONE Alembic revision

**`organizations`**
- `industry` → `Industry` enum-backed string, `NOT NULL`, default `'gym'`; backfill `'gym_fitness'` → `'gym'`.
- Add `checklist_companies_added: bool = False`, `checklist_courses_added: bool = False`, `checklist_invoice_template_set: bool = False` (extend the fixed-5 to 8 total; unused ones are simply `True` for other industries so `build_checklist` can render generically — see §6).

**`membership_plans`**
- Add `offer_kind: str NOT NULL DEFAULT 'membership'` (validated `∈ {membership, space, course}`).
- Add `spec_json: str | None` — industry attributes validated against the industry offer JSON Schema on every create/update.
- Add `org_industry: str | None` denormalized copy of `organizations.industry` (kept in sync by service) purely so plan queries can filter `(org, offer_kind)` without a join; **nullable** to avoid backfill cost.
- Semantics of existing columns per `offer_kind`:
  - `membership` → exactly as today (`billing_type`, `cycle_*`, `pack_size`, `classes_remaining`).
  - `space` → `price` = per-seat per-term price; `billing_type/cycle` derived from `spec.term`; `pack_size/validity_days` unused; `spec_json` authoritative.
  - `course` → `price` = tuition; `billing_type=recurring` unused; `spec_json` authoritative (installments, sibling discount, batches).

**`subscriptions`** — becomes the generic "active entitlement" row for all three industries (renamed in docs only; table name unchanged):
- `classes_remaining` stays for gym packs; add `credits_remaining: float | None` (office room credits, academy makeup credits).
- `current_period_end` semantics: gym=next cycle, office=contract end, academy=term end.
- No new columns strictly required; behavior branches on `membership_plans.offer_kind` via `plan_id`.

**`payments`**
- `PaymentMethod` gains `INVOICE = "invoice"`.
- `PaymentKind` gains `SPACE = "space"`, `TUITION = "tuition"` (sets recorded for office/academy charges; analytics joins plan.offer_kind as a fallback).
- `payments.method=invoice` rows link `invoice_id` (new FK, nullable) instead of a Stripe intent.
- No `amount`/`tax` semantics change (stays `float` per existing — **note**: floats remain a latent correctness risk; out of scope, tracked separately).

**`organization_members`**
- Add `company_id: str | None` FK → `companies.id` (office seat-holders). NULL for gym/academy/gym and office contacts not tied to a company.
- `member_status` reuse: office seat-holder ACTIVE/expired per contract; academy student ACTIVE per term.

### 3.2 New generic tables

**`relationships`** (academy guardian↔student; reusable later for household/family)
| col | type | notes |
|---|---|---|
| id | uuid-hex PK | gen_uuid() |
| organization_id | FK organizations | tenant |
| from_member_id | FK organization_members | guardian (the account that pays/views) |
| to_member_id | FK organization_members | student (the enrolled member) |
| kind | str | `guardian_student` now; enum reserved `family`, `household` |
| note | str | e.g. "father", "mother", "uncle" |
| active | bool default True | soft-remove |
| created_at/updated_at | TimestampModel | |
Unique `(organization_id, from_member_id, to_member_id, kind)`.

### 3.3 Office tables (industry=`office`)

**`companies`** (tenant company renting space)
| col | type | notes |
|---|---|---|
| id | PK | |
| organization_id | FK org | tenant |
| name | str | |
| legal_name | str | for invoice |
| billing_email | str | invoice recipient |
| tax_id | str | VAT/CNIC-ish, nullable |
| contact_name / contact_phone | str | |
| status | str enum `active\|suspended\|past_due` | |
| created_at/updated_at | | |

**`company_contracts`** — a company's active space agreement
| col | type | notes |
|---|---|---|
| id | PK | |
| organization_id | FK org | |
| company_id | FK companies | |
| plan_id | FK membership_plans | offer_kind must be `space` |
| seats | int | number of paid seats |
| started_at / ends_at | datetime | term window |
| billing_cycle | `monthly\|quarterly\|annual` | from plan spec, denormed |
| status | `active\|ended\|terminated` | |
| price_per_seat_snapshot | float | preserve price at signing |
| deposit_amount / deposit_paid | | |
| notes | | |
One company may hold several contracts (different plans/teams).

**`invoices`**
| col | type | notes |
|---|---|---|
| id | PK | |
| organization_id | FK org | |
| company_id | FK companies | |
| contract_id | FK company_contracts | nullable (adhoc) |
| number | str unique-per-org | `INV-YYYY-NNNN` |
| period_start / period_end | datetime | billing window |
| issue_date / due_at | datetime | |
| line_items_json | str | `[{description, qty, unit_price, amount}]` |
| subtotal / tax_amount / total | float | |
| status | `draft\|sent\|paid\|overdue\|voided` | |
| payment_id | FK payments | set when settled |
| pdf_url | str | rendered on demand (mirror cash receipt pattern `app/utils/pdf.py`) |
Row written on finalize; **settling an invoice creates a `Payment(method=invoice)` and marks the source subscription(s) paid/ACTIVE**.

### 3.4 Academy tables (industry=`academy`)

**`courses`** — a schedulable curriculum offering
| col | notes |
|---|---|
| id / organization_id | tenant |
| name, subject, level | e.g. "O-Level Mathematics", "Secondary", "Grade 9" |
| description | |
| teacher_member_id | FK org_members (role label teacher) |
| status | `draft\|published\|archived` |
| color/icon | branding |

**`course_batches`** — one cohort of a course (a "batch"/section per term)
| col | notes |
|---|---|
| id / organization_id / course_id FK | |
| name | "Batch B1" |
| capacity | int (enrollment guard) |
| enrolled_count | int (worker-maintained counter, mirror `booked_count` pattern) |
| starts_at / ends_at | term window |
| status | `upcoming\|running\|ended\|cancelled` |

**`course_lessons`** — concrete scheduled session of a batch (feeds attendance; conceptually = academy's `class_sessions`)
| col | notes |
|---|---|
| id / organization_id / batch_id FK | |
| starts_at / ends_at | datetime |
| topic | |
| teacher_member_id | FK (overrides course teacher per lesson) |
| cancelled | bool |
> Implementation note: **reuse the `class_sessions` table** with a new `category ∈ class|space_slot|lesson` column instead of a parallel table, OR add `course_lessons`; recommendation: add `category` + `resource` columns to `class_sessions` and treat lessons/slots as the same table so `classes_service.book_class`/capacity/idempotency and any realtime plumbing are reused verbatim. Choose the single-table route (`class_sessions.category`) unless review prefers isolation. (This doc writes "lessons/slots" to mean rows in `class_sessions` with `category`.)

**`enrollments`** — a student's registration in a batch for a term (money = the plan row)
| col | notes |
|---|---|
| id / organization_id | |
| member_id | FK org_members (the **student**; role member) |
| guardian_member_id | FK org_members nullable (pays; may be self) |
| batch_id | FK course_batches |
| plan_id | FK membership_plans (offer_kind=`course`; fee snapshot via plan) |
| subscription_id | FK subscriptions (generic entitlement) |
| status | `enrolled\|withdrawn\|completed\|terminated` |
| enrolled_at / term_end | |
Unique `(batch_id, member_id)`.

**`enrollment_fees`** — installment ledger for a tuition payment
| col | notes |
|---|---|
| id / organization_id | |
| enrollment_id FK | |
| installment_no | int 1..N |
| due_at | datetime (split across term if `installments>1`) |
| amount | float (tuition/installments, sibling discount applied on first) |
| status | `due\|paid\|overdue\|waived` |
| payment_id FK | set when a `Payment` settles this fee |

**`attendances`**
| col | notes |
|---|---|
| id / organization_id | |
| lesson_id | FK (class_sessions row, category=lesson) |
| enrollment_id FK | |
| status | `present\|absent\|late\|excused` |
| marked_by | FK users |
| marked_at | |

**`relationships`** from §3.2 carries guardian↔student; a student can have multiple guardians (parents).

### 3.5 JSON Schema files (the per-industry "plan" schemas)

Committed at **`backend/app/static/industry-schemas/{gym,office,academy}-offer.json`** and mirrored under `shared/industries/schemas/` for client validation. Each is a **draft-07 JSON Schema** whose `required` + `properties` describe the object stored in `membership_plans.spec_json`. The plan builder in web/mobile fetches it and renders a form from `properties` (see §7.2). These are the three full documents:

<details><summary><b>gym-offer.json</b> — for `offer_kind=membership`, `spec_json` is NULL/unused; schema declares the classic builder fields so the builder UI is still schema-driven.</summary>

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Gym membership plan",
  "type": "object",
  "properties": {
    "billing_type": { "enum": ["recurring", "one_time_pack", "drop_in"] },
    "cycle_length": { "type": "integer", "minimum": 1 },
    "cycle_unit": { "enum": ["day", "week", "month"] },
    "auto_renew": { "type": "boolean" },
    "trial_days": { "type": "integer", "minimum": 0 },
    "pack_size": { "type": "integer", "minimum": 1 },
    "validity_days": { "type": "integer", "minimum": 1 },
    "inclusions": { "type": "array", "items": { "type": "string" } },
    "rules": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["billing_type"]
}
```
</details>

<details><summary><b>office-offer.json</b> — for `offer_kind=space`.</summary>

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Space plan",
  "type": "object",
  "properties": {
    "space_type": { "enum": ["hot_desk", "fixed_desk", "private_office", "meeting_room", "day_pass"] },
    "seats_included": { "type": "integer", "minimum": 1 },
    "term": { "enum": ["monthly", "quarterly", "annual"] },
    "billing": { "enum": ["company_invoice", "card"] },
    "deposit_months": { "type": "integer", "minimum": 0 },
    "room_credits": { "type": "integer", "minimum": 0 },
    "room_credit_validity_days": { "type": "integer", "minimum": 1 },
    "includes": { "type": "array", "items": { "type": "string" } },
    "cancel_notice_days": { "type": "integer", "minimum": 0 }
  },
  "required": ["space_type", "term", "billing"]
}
```
`membership_plans.price` for `space` = per-seat per-`term` price; `contract.total = price * seats_included`.
</details>

<details><summary><b>academy-offer.json</b> — for `offer_kind=course` (course fee/tuition plan).</summary>

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Course fee plan",
  "type": "object",
  "properties": {
    "course_id": { "type": "string" },
    "term": { "type": "string" },
    "installments": { "type": "integer", "minimum": 1, "maximum": 12 },
    "sibling_discount_pct": { "type": "number", "minimum": 0, "maximum": 100 },
    "include_materials_fee": { "type": "number", "minimum": 0 },
    "refund_cutoff_days": { "type": "integer", "minimum": 0 }
  },
  "required": ["course_id", "term"]
}
```
`membership_plans.price` = full tuition (pre-discount); `enrollment_fees` split across `installments`.
</details>

---

## 4. Roles, capabilities & permissions (per-industry matrices)

### 4.1 Role model
- `Role` enum unchanged (5 values). `TRAINER` is the generic **service professional** (trainer/coach, teacher, stylist-equivalent); `FRONT_DESK` is **frontline** (reception, registrar, concierge). Only *labels* change via registry §2.1 `roles_labels`.
- Mobile/web show labels from `/me/industry`.

### 4.2 New generic capabilities (added once to `permissions.py`)
`manage_companies`, `issue_invoices`, `manage_courses`, `manage_batches`, `take_attendance`, `enroll_students`, `book_space` (renames nothing; gym keeps `book_classes`). New `book_space` granted to member role for office/academy contexts via industry override.

### 4.3 Industry capability overrides (delta over the base matrix)

Base matrix = today's gym matrix. Overrides per industry (`capabilities_overrides`):

| Capability | gym (base) | office | academy |
|---|---|---|---|
| `run_payroll` | OWNER | OWNER (space staff) | OWNER (teachers) |
| `manage_members` | OWNER/MANAGER | OWNER/MANAGER (seat-holders) | OWNER/MANAGER/Registrar→FRONT_DESK |
| `manage_companies` | — | OWNER/MANAGER | — |
| `issue_invoices` | — | OWNER/MANAGER | OWNER/MANAGER (fee receipts optional) |
| `manage_courses` / `manage_batches` | — | — | OWNER/MANAGER (+FRONT_DESK read) |
| `enroll_students` | — | — | OWNER/MANAGER/FRONT_DESK |
| `take_attendance` | — | — | TRAINER(teacher)/OWNER/MANAGER |
| `book_classes` | MEMBER | — | MEMBER(students book makeup? no — see below) |
| `book_space` | — | MEMBER (seat-holder books rooms/desks) | — |
| `view_revenue_analytics` | OWNER/MANAGER | OWNER/MANAGER | OWNER/MANAGER |

`role_has(role, cap)` gains optional `industry` param; `require_capability(cap)` reads org industry from `ctx` and applies the override. **Gym behavior is unchanged** because overrides for gym are empty.

---

## 5. Feature modules, nav & dashboards (web + mobile)

### 5.1 Master module catalog (backed by `modules` set on each Industry)

Existing modules stay available; new modules add pages only when the org industry lists them. Web route groups are additive under `/app`.

| Module id | Web route (web) | gym | office | academy | Notes |
|---|---|---|---|---|---|
| `dashboard` | `/app` | ✅ | ✅ | ✅ | server dashboard (stat tiles from registry) |
| `analytics` | `/app/analytics` | ✅ | ✅ | ✅ | tile set per industry |
| `offers` (plans) | `/app/plans` | ✅ "Plans" | ✅ "Space plans" | ✅ "Fee plans" | schema-driven builder |
| `members` | `/app/members` | ✅ Members | ✅ Seat-holders | ✅ Students | label from registry |
| `companies` | `/app/companies` | ❌ | ✅ Companies & tenants | ❌ | new |
| `invoices` | `/app/invoices` | ❌ | ✅ Invoices | ❌ (receipts only) | new |
| `payments` | `/app/payments` | ✅ | ✅ | ✅ | money ledger |
| `cash` | `/app/cash` | ✅ | ✅ | ✅ (fee counter) | front-desk cash log |
| `receipts` | `/app/receipts` | ✅ | ❌ | ✅ (fee payment proof) | AI receipt queue — enable per industry |
| `classes` | `/app/classes` | ✅ Classes | ❌ | ❌ | gym group classes |
| `space` | `/app/space` | ❌ | ✅ Desks & rooms | ❌ | slots in class_sessions(category=space_slot) |
| `courses` | `/app/courses` | ❌ | ❌ | ✅ Courses & batches | new |
| `attendance` | `/app/attendance` | ❌ | ❌ | ✅ | mark per lesson |
| `tasks` | `/app/tasks` | ✅ | ✅ | ✅ | |
| `staff` | `/app/staff` | ✅ | ✅ | ✅ | label teacher/space-manager |
| `audit` | `/app/audit` | ✅ | ✅ | ✅ | |
| `approvals` | `/app/approvals` | ✅ | ✅ | ✅ (approve enrollments) | |
| `payroll` | `/app/payroll` | ✅ | ✅ | ✅ | trainers/teachers/space staff |
| `billing` | `/app/billing` | ✅ | ✅ | ✅ | SaaS tier (owner pays platform) — same for all |
| `account` / `settings` | `/app/account`, `/app/settings` | ✅ | ✅ | ✅ | org details industry-aware |

### 5.2 Web nav trees per industry (what the Sidebar renders)

Built by **`frontend/lib/industry-nav.ts`** from the registry + module flags. Exact ordered items:

- **gym:** Dashboard · Analytics · Plans · Members · Payments · Cash · Receipts · Tasks · Classes · Staff · Audit · Approvals · Payroll · Billing · Account · Settings (identical to today).
- **office:** Dashboard · Analytics · **Companies** · **Space plans** · **Desks & rooms** · **Invoices** · Payments · Cash · Tasks · Staff · Audit · Approvals · Payroll · Billing · Account · Settings. *(Receipts/Classes hidden.)*
- **academy:** Dashboard · Analytics · **Fee plans** · **Courses & batches** · **Enrollments** (folded into Courses page or its own route) · **Attendance** · Members(Students) · Payments · Cash · Receipts · Tasks · Staff(Teachers) · Audit · Approvals · Payroll · Billing · Account · Settings. *(Classes hidden.)*

Wordmark/empty states pull from org (`logo_url`/`accent_color`, already in `OrganizationOut`) so no "Gym Ops" hardcode remains branding-wise — brand default stays for gym.

### 5.3 Mobile per-industry role routing (what `auth-guard.routeForRole` + tab bars become)

`routeForRole(role, industry)` returns the start screen. Tab bars read the industry registry:

- **Member/seat-holder/student tabs:**
  - gym member: Home · **Classes** · Payments · Profile (today).
  - office seat-holder: Home · **Desks & rooms** · Payments/Company usage · Profile.
  - academy student/guardian: Home(timetable) · **Attendance** · Fees/Payments · Profile.
- **Staff/admin tabs** remain Home · Shift(or Cash) · Approve · Tasks · Profile, with module toggles (academy staff gets **Attendance** mark; office admin gets **Approve day-pass**).

### 5.4 Dashboard tile registry (web + mobile headline)

Backend `analytics_service` exposes per-industry headline endpoint (see §9). Tile descriptors:

- gym: `active_members`, `today_revenue`, `today_checkins`, `pending_approvals`.
- office: `occupied_seats`, `occupancy_pct`, `space_mrr`, `outstanding_invoices`.
- academy: `enrolled_students`, `term_fee_collected`, `attendance_rate`, `pending_enrollments`.

`GET /analytics/headline` already returns org-scoped numbers; it becomes industry-branched behind the same service (registry `analytics_headline`).

---

## 6. Account creation & onboarding — per-industry walkthrough

### 6.1 Registration flow (all industries share this skeleton)

1. **Step A — owner account** (unchanged): `POST /auth/register` → email code → `POST /auth/verify-email`. Password 12+/mixed/HIBP, MFA-ready.
2. **Step B — venue details** (industry added): the details form now includes **"What kind of place is this?"** (radio: Gym & fitness / Corporate offices / Education academy) fetched from `GET /industries`. `GymDetails.industry` (`Default "gym"`). Payload `POST /organizations/register` body `RegisterGymRequest{owner_email, details{GymDetails + industry}, tier, payment_token}`. Backend validates `industry ∈ INDUSTRIES` (else 422).
   - Chosen industry pre-fills: `default_currency`, accent hint, org-code fallback prefix, and whether the **Stripe Connect** requirement shows in the checklist.
3. **Step C — SaaS tier + payment** (unchanged for all): `organizations_service.register_gym` provisions org + owner membership + welcome email; welcome email body/labels selected by industry.
4. **Step D — setup checklist** rendered from registry `checklist`; per industry:

| Checklist step (code) | gym | office | academy |
|---|---|---|---|
| `stripe` Connect your payout account | required | **skipped/hidden** | required |
| `offer` Create your first plan | Publish a membership plan | Publish a **space plan** | Create a **course + fee plan** |
| `enroll` How people join | Enrollment mode (open/approved/invite) | Seats allocated by company contract | Guardians enroll students |
| `people` Add your team | Invite trainers/front-desk | Invite space managers/reception | Invite **teachers/registrar** |
| `companies` (office) / `courses` (academy) | — | Add first company/tenant | Add first course & batch |
| `done` | member signup unblocked | invoice template set | first enrollment accepted |

Checklist backing: keep `checklist_*` booleans (add the 3 new ones from §3.1); `build_checklist()` maps step codes → booleans and returns the *industry-ordered* subset in `SetupChecklist` (extend schema with a `steps: [{code,label,done}]` list while keeping old flat fields for back-compat).

### 6.2 Office-specific onboarding (money mode B2B)

1. Owner completes A–C with `industry=office` (Connect step hidden).
2. **Add company:** `POST /companies` (`name`, `billing_email`, `contact`, `tax_id`) — tenant company record.
3. **Publish a space plan** (`POST /plans` with `offer_kind=space` + validated `spec_json`).
4. **Sign a contract:** `POST /companies/{id}/contracts` selects plan + seats → creates `company_contracts` (term window, seats) and creates N `organization_members(role=member, company_id=…)` rows for the company's seat-holder users (invited via email, same invite mechanism).
5. **Invoice template:** org-level defaults (tax, invoice number prefix, due-in-days) in settings.
6. Staff invited; done.

### 6.3 Academy-specific onboarding

1. Owner completes A–C with `industry=academy` (Connect required for guardians).
2. **Create course** (`POST /courses`) then **batches** (`POST /courses/{id}/batches`) and a **fee plan** (plan `offer_kind=course` linking `course_id`).
3. **Register guardians:** either guardian signs up via org code (open/approved/invite) or registrar creates a guardian + student profile with `relationships(kind=guardian_student)`.
4. **Enroll + collect tuition:** `POST /enrollments` (student, batch, plan) → guardian pays (idempotent Connect/cash/receipt) → `enrollment_fees` split by `installments` → student member ACTIVE for term.
5. Teachers (role trainer, label teacher) + attendance settings.

### 6.4 Org code generation
Unchanged algorithm (`app/utils/org_code.py`), but `generate_org_code(name, industry)` falls back to `Industry.org_code_fallback_prefix` when the name yields too-short/empty words. **Uniqueness constraint unchanged.**

---

## 7. Web (Next.js) change plan — file-level

### 7.1 Registry plumbing
- **`frontend/lib/industries.ts`** — typed wrapper around `shared/industries/*.json` + `/api/proxy/industries`, exports `getIndustryNav(industry, role)`, `getIndustryLabels()`, module-flag helpers. (Mirrors backend registry; single source kept in `shared/industries/*.json` generated from backend — script `scripts/gen_industry_ts.py` outputs it, run on backend change.)
- **`frontend/lib/types.ts`** — add `IndustryKey`, `OfferKind`, `Plan.spec`/`offer_kind`, `Company`, `CompanyContract`, `Invoice`, `Course`, `CourseBatch`, `Enrollment`, `Attendance`, `Relationship` interfaces.
- **`frontend/components/Sidebar.tsx`** — replace hardcoded `NAV` with `NAV = buildNav(industry, role)` from `industries.ts`; wordmark from org.
- **`frontend/app/app/layout.tsx`** — fetch `/organizations/me` + `/me/industry`; pass `industry` into `Sidebar`/`PageHeader` (server component already calls `backend<OrganizationOut>`).

### 7.2 Schema-driven offer/plan builder
- **`frontend/app/app/plans/page.tsx`** refactor: on mount fetch `GET /api/proxy/industries/{key}/offer-schema`; render a **field-spec form**:
  - Map each JSON-Schema `property` → an input by `type`/`enum` (string → text, number → number, enum → select, boolean → toggle, array → list-editor, string-with-date-format → date). Render only industry-relevant fields; hide membership-only fields for office/academy.
  - On submit: collect shared fields (`name`, `price`, `visibility`) + `spec_json` from the industry fields; `POST /plans` validates server-side against the same schema.
  - Show per-offer-kind derived fields in the builder (office: seats, term, billing; academy: course dropdown, term, installments).
- New pages reusing existing patterns (client component + `lib/api` + realtime refetch):
  - `frontend/app/app/companies/page.tsx` — CRUD companies + contract dialog.
  - `frontend/app/app/invoices/page.tsx` — create draft (pick company/contract/period), preview line items, mark paid; list with status chips.
  - `frontend/app/app/courses/page.tsx` — courses + batches + fee plans (tabs).
  - `frontend/app/app/attendance/page.tsx` — pick course→batch→lesson, mark per student.
  - `frontend/app/app/space/page.tsx` — slots (rooms/desks) calendar reuse of classes page.
- These pages are **only reachable/nav-linked** when `industry.modules` includes the module (else 404 redirect to `/app`).

### 7.3 Dashboard & analytics
- `frontend/app/app/page.tsx` stat tiles driven by `/analytics/headline` payload keys (already org-scoped; just render the registry tile list + labels).
- `frontend/app/app/analytics/page.tsx` unchanged in mechanism; industry-specific drill-downs are out of v1.

### 7.4 Register page
- `frontend/app/register/page.tsx` — add industry selector step (or a segmented control on the "Your gym" step) populated from `/api/proxy/industries`; pass `industry` into the `/register-gym` payload.

---

## 8. Mobile (Expo) change plan — file-level

### 8.1 Registry & routing
- **`mobileapp/src/lib/industries.ts`** — mirror of the web one (import `shared/industries/*.json` via metro; keep a bundled copy under `mobileapp/src/shared/industries/` to avoid metro monorepo complexity — a tiny copy script regenerates it).
- **`mobileapp/src/components/auth-guard.tsx`** — `routeForRole` becomes `routeForRole(role, industry)`, using registry start screens.
- **`mobileapp/src/stores/org-store.ts`** — `activeOrg` gains `industry` (persisted with org from `/auth/my-organizations`); add explicit `switchOrg` that re-issues session via `POST /auth/switch-org` (fills a real gap).
- Tab bars: each `(member|staff|admin)/_layout.tsx` reads `orgStore.activeOrg.industry` and filters tab set via registry.

### 8.2 Academy screens (guardian/student + teacher)
- `(member)/dashboard.tsx` branch for academy → **timetable** (today's lessons) instead of gym classes.
- New: `(member)/attendance.tsx` (view own attendance), `(member)/fees.tsx` (installments due + idempotent pay, reuse `join/pay.tsx` idempotency pattern), `(member)/classes.tsx` **replaced by** `(member)/lessons.tsx` listing enrolled batch lessons.
- New staff/admin: `(staff)/attendance-mark.tsx` for teachers (lesson picker → per-student present/absent), admin approvals handle pending enrollments.
- Guardian flow: registering a student links via `relationships`; a guardian sees each linked student's timetable/fees.

### 8.3 Office screens (seat-holder)
- `(member)/dashboard.tsx` branch for office → company plan + usage + book desk/room.
- New: `(member)/space.tsx` — browse available slots (from `GET /classes` filtered to `category=space_slot`), idempotent book; `(member)/company.tsx` — seats, room-credit balance.
- Admin/staff quick actions gated by module flags (day-pass approve, space status toggle reuses gym-status pattern).

### 8.4 Register flow
- `mobileapp/src/app/(auth)/register/step-2.tsx` (and gym-details) — add industry picker (choice cards reused from `choice-card.tsx`); store in `register-store.ts`; include `industry` in `/organizations/register` call at `register/payment.tsx`.

---

## 9. Backend service/engine changes (money correctness)

All new flows go through the existing idempotency protocol (`idempotency_service.claim/complete/fail`) and `get_session` commit semantics.

### 9.1 Shared activation rules by `offer_kind`
`memberships_service.pay_and_activate` is refactored into a dispatcher:
- `offer_kind=membership` → existing logic verbatim (after the **known-bug fixes**: honor FAILED cached replay, close prior ACTIVE `Subscription` when starting a new one, keep `price_snapshot` for legacy).
- `offer_kind=space` (office): validate company contract seats not exceeded; compute `total = price_seat_snapshot × seats × term_length`; record `Payment(kind=SPACE)`, method from billing (card→Connect charge; `company_invoice`→create `invoices` row status sent, `Payment(method=invoice)` created on settlement); mark seat-holder subscriptions ACTIVE until `contract.ends_at`. **No per-seat-holder Connect charge** unless plan.billing=card.
- `offer_kind=course` (academy): validate batch capacity (`enrolled_count < batch.capacity` else 409), compute tuition − sibling discount (needs a sibling on a linked `relationships` to the same guardian), split into `enrollment_fees` per `installments`, charge first installment via Connect/cash/receipt; student member ACTIVE until `course_batches.ends_at`.

### 9.2 Grace/expiry per industry
- Membership: unchanged (note: GRACE never set today — flagged; a fix is out of scope here but **office/academy must not rely on GRACE**, they use contract/term end).
- Office: contracts auto-sweep `active → ended` at `ends_at` unless renewed; invoices past `due_at` → `overdue`, company `suspended` after grace days, seat-holder memberships flip EXPIRED (lock app access) — driven by a new Celery task `office.sweep_contracts_and_invoices` (hourly).
- Academy: at `term_end`, batch `running→ended`, student member status → EXPIRED with renewal prompt for next term; `enrollment_fees` overdue when `due_at` passes — worker `academy.sweep_terms` (daily).

### 9.3 Workers (extend `app/workers/`)
- `celery_app.py` beat additions: `office.sweep_contracts_and_invoices` hourly, `academy.sweep_terms` daily, `academy.attendance_reminders` (optional), all import-safe / stub-safe like existing tasks.
- Inline-callable async functions in `app/services/office_service.py` & `academy_service.py` (mirror the `*_worker` pattern already used).

### 9.4 Analytics (org-scoped, industry-branched)
`analytics_service.headline_metrics` + new `office_metrics`/`academy_metrics` behind the same route: occupancy/MRR/outstanding invoices; enrollment/attendance/fee collection. Reuses existing org-scoped query discipline (no cross-tenant leakage).

### 9.5 New service modules (thin routes → services → models, matching the codebase pattern)
- `app/services/office_service.py` — companies/contracts/invoices lifecycle, seat-holder membership, invoice PDF via `app/utils/pdf.py`, invoice settle→Payment, realtime events (`invoice_changed`, `contract_changed`, `space_slot_changed` via `app/realtime/events.py`).
- `app/services/academy_service.py` — courses/batches/lessons, enroll (capacity guard), fees/installments, attendance, sibling-discount calc, guardian relationships, realtime (`course_changed`, `attendance_marked`).
- New route files: `app/api/v1/routes/companies.py`, `invoices.py`, `courses.py`, `enrollments.py`, `attendance.py`, `relationships.py` (or fold into domain routers with prefixes). All mutating endpoints require `Idempotency-Key` (this is where the existing gap is closed for new code).

---

## 10. Frontend API types & schema sharing (avoid the current drift)

Existing drift (frontend/mobile each maintain their own `types.ts`) is **not** re-litigated here, but new industry types are added to all three mirrors in lock-step and cross-checked by a CI type test. If time allows, the industry type slice is a good pilot for generating TS from the OpenAPI schema (`shared/types/api.ts` was supposed to be auto-generated).

---

## 11. Phasing — task-level breakdown

### Phase 0 — Industry core (foundation; gym must stay green)
1. `backend/app/core/industry.py` registry + tests (`test_industry_registry.py`: every key valid, schema files load/parse).
2. `INDUSTRIES` static JSON mirrored to `shared/industries/*.json`; generator script `scripts/gen_industry_ts.py`.
3. `routes/industries.py` (`GET /industries`, `/industries/{key}`, `/industries/{key}/offer-schema`, `/me/industry`) + schemas + router registration.
4. Model edits + **one Alembic revision** (§3.1): industry enum enforcement + backfill; `offer_kind`/`spec_json`/`org_industry` on `membership_plans`; new `checklist_*` booleans; new tables (relationships, companies, contracts, invoices, courses, batches, enrollments, fees, attendances); `PaymentMethod.invoice`/`PaymentKind.space|tuition`; `class_sessions.category`; `organization_members.company_id`.
5. `permissions.py` new capabilities + per-industry overrides + `role_has(role, cap, industry)`; update `require_capability` to read org industry.
6. Registration accepts `industry` (web + mobile) → org code fallback, checklist build by industry, welcome copy.
7. `SetupChecklist` schema: add ordered `steps[]` (back-compat fields kept).
8. Plan builder backend: `plans_service` + `POST/PATCH /plans` validate `spec_json` against industry schema; `GET /plans` filters by offer kind.
9. Web: registry mirror, Sidebar/layout from registry, register picker, schema-driven plan-builder refactor.
10. Mobile: registry copy, `routeForRole(role, industry)`, register picker, org-store.industry.
11. **Gym regression:** entire existing `tests/integration/*` suite passes unchanged.

### Phase 1 — Academy vertical slice
1. Models/routes/services per §3.4/§9.5 (courses→batches→lessons via `class_sessions.category`, enrollments, fees/installments, attendance, relationships guardian link, sibling discount).
2. Pay/activation dispatcher `offer_kind=course` (idempotent first installment).
3. Web pages: courses, attendance, fee plans builder.
4. Mobile: guardian/student screens, teacher attendance.
5. Academy integration tests (register academy → create course/batch/fee plan → guardian enrolls + pays → installment due/overdue sweep → attendance; tenant isolation; idempotent replay).
6. Seed: `scripts/seed_db.py` academy org + one course.

### Phase 2 — Office vertical slice (largest money delta; last)
1. Models/routes/services per §3.3/§9.5 (companies, contracts, invoices, seat-holders, space slots via `class_sessions.category`).
2. Pay/activation dispatcher `offer_kind=space` (invoice vs card), invoice lifecycle + PDF, contract sweep worker.
3. Web pages: companies, invoices, space.
4. Mobile: seat-holder screens.
5. Office integration tests (register office → company → space plan → contract → seat-holder invite → invoice draft/settle/overdue → sweep; isolation/idempotency).
6. Seed office org.

### Phase 3 — polish & docs
1. Analytics headline per industry; dashboard tiles web+mobile.
2. `docs/` refresh: CLAUDE.md monorepo claims, `docs/api/endpoint-catalog.md`, `mobile-api-reference.md`; new ADR "Multi-industry (industry registry)".
3. Re-audit `requirements/Frontend_Launch_Gaps.pdf` against the three verticals.
4. E2E smoke per industry.

---

## 12. Verification strategy

- **Backend:** `uv run pytest -q` — Phase 0 must not change gym results (57 tests green today); Phase 1/2 add suites per §11. JSON Schema validation unit tests (valid specs 200 / invalid 422). New endpoints: idempotency replay assertions (mirror `test_member_signup.py` idempotent replay).
- **Web:** `npx next build` (env note: pnpm build is broken here) + manual register-one-org-per-industry walkthrough (register → checklist → create offer → first member/seat/guardian flow → nav & tiles match the registry).
- **Mobile:** Expo register per industry; verify tab sets and start screens differ; existing role flows still route (gym default).
- **Seeds:** extend `scripts/seed_db.py` (gym baseline + one academy + one office demo org).

---

## 13. Risks & open decisions

1. **Office interpretation** — designed as serviced/coworking **space** (B2B invoice). If "corporate offices" instead means a single company managing internal staff, swap the office module content (drop companies/invoices for employees/allowances) — registry mechanics unaffected. **Confirm before Phase 2.**
2. **One org = one industry** (industry set once at registration). Changing an org's industry later = admin-only, gated (no members) — out of scope unless needed.
3. **Build order** — academy (Phase 1) before office (Phase 2) because office introduces the B2B invoicing money model. Swappable if office is the priority.
4. **Reuse `class_sessions` vs parallel lesson/space tables** (§3.4 note) — recommendation is single-table with `category`; review will decide.
5. Pre-existing money bugs (§0) are fixed opportunistically in the shared dispatcher but are not a Phase-0 deliverable; they must not be regressed by refactor.
