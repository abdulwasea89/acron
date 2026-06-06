## What We Are Building

A **multi-tenant SaaS platform** for gym operations. One product, three interfaces:

- **Web portal** — Admin command center for gym owners, managers, and HR
- **Mobile app** — For gym members, trainers, front-desk staff, and owner quick actions
- **Backend API** — FastAPI handling all business logic, payments, AI, and real-time sync

The platform serves **three money flows**:
1. **SaaS subscription** — Gym owners pay the platform monthly ($29 / $79 / custom)
2. **Member fees** — Members pay their gym directly via Stripe Connect (platform never touches this money)
3. **Trainer salaries** — Gyms pay trainers; platform tracks, calculates, and generates pay stubs

Every gym is a **tenant** — isolated by `organization_id`. One person can own multiple gyms. Members can belong to multiple gyms with completely independent memberships, plans, and billing cycles.

---

## Why This Architecture

**Multi-tenancy** keeps gyms isolated. A data breach at one gym never leaks another's members. A billing error in one org never affects others. This is non-negotiable for a product handling real money and real people's health data.

**Stripe Connect Standard** (not Express) keeps the platform out of merchant-of-record territory. Gyms get money directly into their bank accounts. The platform only touches its own SaaS fee. This avoids PCI scope expansion, legal liability, and complex money-movement compliance.

**Idempotency everywhere** prevents the most common and most damaging bug in payment systems: double-charging. A member taps Pay, loses signal, taps again. Without idempotency, they get charged twice. With it, the second tap returns the first result. Zero double-charges. Zero refund disputes. Zero angry gym owners.

**AI receipt verification** solves the cash-payment tracking problem. Gyms in many countries run heavily on cash. Owners forget to log it. Members show up claiming they paid. The AI reads the receipt photo, checks if it's real, checks if it's a duplicate, checks if the amount matches a known plan, and either auto-approves or sends to admin review. This removes the manual bottleneck that kills gym operations at scale.

**WebSocket real-time sync** means an owner can create a plan on their laptop and see it appear on their phone in under 2 seconds. A trainer can check in and the owner sees it immediately. No refresh buttons. No stale data. No "I didn't see that update."

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Web** | Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui | Server components by default, minimal JS shipped, excellent DX |
| **Mobile** | Expo SDK 52, React Native, TypeScript | One codebase for iOS + Android, native camera/push, fast iteration |
| **Backend** | FastAPI, Python 3.12+, Pydantic v2, SQLAlchemy 2.0 | Async-native, automatic OpenAPI generation, strict type validation |
| **Database** | PostgreSQL 16, Redis | ACID transactions for money, RLS for tenant isolation, Redis for sessions/cache/queues |
| **Auth** | JWT (15-minute access, 7-day refresh), bcrypt, HTTP-only cookies | Stateless, scalable, secure against XSS |
| **Payments** | Stripe Platform (SaaS) + Stripe Connect Standard (gym payments) | Two separate Stripe accounts, zero commingling |
| **AI / OCR** | GPT-4o Vision / Tesseract + custom validation | Receipt reading, authenticity detection, duplicate checking |
| **Real-time** | WebSocket (FastAPI native) | Bidirectional, low latency, no polling overhead |
| **Queue** | Celery + Redis / ARQ | Background jobs: payroll generation, AI processing, stuck-payment reconciliation |
| **File Storage** | AWS S3 / Cloudflare R2 | Receipt images, pay stub PDFs, CSV exports |
| **Email** | Resend / SendGrid | Transactional: welcome, verification, pay stubs, invoices |
| **Push** | Expo Push Notifications + FCM | Mobile alerts for payments, approvals, class reminders |
| **Monitoring** | Sentry (errors), Prometheus + Grafana (metrics) | Production observability |

---

## Monorepo Structure

```
gym-operations-platform/
├── web/                          # Next.js 15 — admin portal, public pages
│   ├── app/
│   │   ├── (auth)/               # Login, register, forgot password, MFA
│   │   ├── (admin)/              # Owner/manager dashboard
│   │   │   ├── dashboard/        # Setup checklist, headline metrics
│   │   │   ├── members/          # Directory, bulk import, profiles
│   │   │   ├── plans/            # Plan builder, publish, archive
│   │   │   ├── payroll/          # Draft, adjust, finalize, pay
│   │   │   ├── analytics/        # Revenue, churn, attendance, exports
│   │   │   ├── settings/         # Org details, Stripe, security
│   │   │   └── audit/            # Full searchable audit log
│   │   ├── (public)/             # Landing, pricing, docs
│   │   └── api/                  # Next.js API routes: webhooks, auth callbacks
│   ├── components/               # shadcn/ui + custom
│   ├── lib/                      # Utilities, API client
│   ├── hooks/                    # React hooks
│   └── types/                    # Shared TypeScript types
│
├── backend/                      # FastAPI — all business logic
│   ├── app/
│   │   ├── api/v1/               # Route handlers
│   │   │   ├── auth.py           # Register, login, MFA, sessions, password reset
│   │   │   ├── organizations.py  # Org CRUD, SaaS billing, Stripe Connect
│   │   │   ├── plans.py          # Plan builder, publish, archive
│   │   │   ├── members.py        # Directory, invite, import, profiles
│   │   │   ├── payments.py       # Process, refund, cash log, receipt upload
│   │   │   ├── receipts.py       # AI pipeline, admin review queue
│   │   │   ├── payroll.py        # Draft, adjust, finalize, export
│   │   │   ├── staff.py          # Trainer/front desk management
│   │   │   ├── analytics.py      # Aggregations, exports
│   │   │   └── webhooks.py       # Stripe webhooks (Platform + Connect)
│   │   ├── core/                 # Config, security, dependencies
│   │   ├── models/               # SQLAlchemy ORM + Pydantic schemas
│   │   ├── services/             # Business logic layer
│   │   │   ├── ai_receipt.py     # OCR → authenticity → duplicate → validation → scoring
│   │   │   ├── stripe_service.py # Platform + Connect abstraction
│   │   │   ├── payroll_engine.py # Fixed + hourly + per-class + commission
│   │   │   └── idempotency.py    # Key claim, hash check, stuck reconciliation
│   │   ├── db/                   # Migrations (Alembic), session, RLS policies
│   │   └── workers/              # Celery tasks: payroll, AI, reconciliation
│   ├── alembic/                  # Versioned migrations
│   ├── tests/                    # pytest + pytest-asyncio
│   ├── Dockerfile
│   └── pyproject.toml
│
├── mobile/                       # Expo — React Native
│   ├── app/
│   │   ├── (auth)/               # Org code entry, email verify, password, MFA
│   │   ├── (member)/             # Dashboard, classes, payments, profile, receipt upload
│   │   ├── (staff)/              # Trainer/front desk: check-in, cash log, approve receipts
│   │   └── (admin)/              # Owner quick actions: approve, toggle, announce, view
│   ├── components/
│   ├── hooks/
│   ├── services/                 # API client, image upload, push notifications
│   └── stores/                   # Zustand + MMKV (persistent local state)
│
├── shared/                       # Cross-platform contracts
│   └── types/
│       ├── api.ts                # Auto-generated from FastAPI OpenAPI
│       └── constants.ts          # Enums, magic numbers, limits
│
├── docker-compose.yml            # PostgreSQL + Redis + backend
├── turbo.json                    # Monorepo task orchestration
└── README.md
```

---

## Core Flows

### 1. Gym Owner Registration

```
App opens → "Register My Gym"
    ↓
Step 1: Owner account
    Full name · Email · Password · Confirm password
    Password: 12+ chars, mixed case, numbers, symbols
    Checked against Have I Been Pwned API — reject compromised passwords
    ↓
Step 1.5: Email verification
    6-digit code sent, 10-minute expiry, single-use
    Max 3 resends per hour per email
    ↓
Step 2: Gym details
    Gym name · Industry (preselected: Gym/Fitness) · Address · Country
    Timezone · Default currency · Working hours per day · Logo · Accent color
    ↓
Step 3: SaaS tier selection
    Starter $29/mo (up to 25 members) · Pro $79/mo (up to 100) · Enterprise custom
    Total with tax shown before payment
    ↓
Step 4: Payment
    Stripe-hosted card form
    First month charged immediately
    Failure → error shown, retry
    Success → organization created
    ↓
Organization provisioning
    Unique org_id (tenant isolated)
    Unique org code generated: 8-12 alphanumeric (e.g., IRON-PULS-3K9)
    Owner user created with Owner role
    Welcome email: web login URL, org code, mobile links, getting-started guide
    ↓
Setup checklist (blocks member signup until complete)
    ✓ Gym registered
    ✓ SaaS plan active
    ⚠ Connect Stripe (for member payments)
    ⚠ Create membership plans (REQUIRED)
    ☐ Configure enrollment mode
    ☐ Invite staff
    ☐ Set office statuses & leave types
```

### 2. Member Signup (Open Enrollment)

```
App opens → "Join an Existing Gym"
    ↓
Enter org code → Rate limit + CAPTCHA check
    Per IP: max 3 attempts/hour
    Per email: max 2 attempts/day
    Per org code: max 50 signups/day → auto-frozen
    ↓
Enter email → 6-digit verification (10-min expiry)
    Check: email not already member of this org
    ↓
Set password (same complexity as admin)
    Account created in pending_payment status
    ↓
Pick published plan
    Sees all public plans: name, price, billing type, key inclusions
    Featured plan highlighted
    ↓
Pay
    Client generates UUID idempotency key, saves locally, disables button
    Server checks idempotency table: never seen → claim, mark in_progress
    Same key passed to Stripe-Idempotency-Key header
    Server processes: if completed → return cached; if in_progress → 409 Conflict
    Success → membership activated, member logged in
    ↓
Complete profile
    Name (required), photo, phone, emergency contact
    ↓
Land on member dashboard
    Welcome email sent
    Appears in admin Member Directory as Active
```

**Approved Enrollment Variant:** After password step, signup goes to admin approval queue. Admin sees email, name, extra info. Approves → prospect notified, proceeds to payment. Rejects → prospect notified with reason.

**Invite-Only Variant:** "Join with code" disabled. Members receive direct email invite with single-use code tied to their email.

### 3. Returning Member Login

```
Member opens app → "Log In"
    ↓
Enter org code + email + password
    System validates all three together
    Vague error on failure — never reveals which field is wrong
    ↓
JWT issued, scoped to ONE organization_id
    ↓
System checks membership status
    Active      → Member dashboard
    Grace (1-3 days) → Dashboard + persistent "Payment due. X days left." banner
    Expired     → "Payment Required" screen
    Frozen      → Limited access, unfreeze flow
    Cancelled   → Treated like new prospect
    Banned      → Login blocked
```

**Expired Member Flow:**
```
"Payment Required" screen
    "Your plan expired on [date]. How would you like to resolve this?"
    [Pay $149 Online Now] → Stripe card form, idempotent
    [I paid offline — Upload Receipt] → AI receipt verification pipeline
```

### 4. AI Receipt Verification Pipeline

```
Member uploads receipt photo (camera or gallery)
    Max 10MB, JPG/PNG/HEIC
    Instructions: "Show amount, date, gym name clearly"
    ↓
Pre-processing
    Auto-rotate, crop to receipt boundaries, enhance contrast
    Save original + processed to S3
    ↓
Step 1: OCR Extraction
    Amount paid · Date · Payer name · Payee/gym name · Transaction ID · Payment method
    ↓
Step 2: Authenticity Check
    Font consistency · Edit marks / pixelation · EXIF data integrity
    ↓
Step 3: Duplicate Detection
    Perceptual hash compared against all prior receipts in this org
    ↓
Step 4: Cross-Field Validation
    Amount matches known plan? · Date within claim window? · Gym name matches org? · Receipt # used before?
    ↓
Step 5: Confidence Score (0-100%)
    ↓
Decision:
    ≥ 95%  → Auto-approve. Membership activated instantly. 5% random spot-audit later.
    70-94% → Admin review queue with AI extracted data + confidence shown. Member: "Being reviewed, 24 hours."
    < 70%  → Admin queue, flagged suspicious with reasons. Same review message.
```

**Admin Review Queue:**
- Shows: member info, claimed amount, AI confidence, extracted fields, original image
- One-click: Approve / Reject (with reason) / Request more info
- Random spot audit: Background job picks 5% of auto-approved receipts weekly
- Admin can reverse auto-approval → member status reverts, notified

**Tuning:** Start at 95%. Monitor weekly reversal rate. > 2% → raise to 97%. < 0.2% and queue backed up → lower to 92%. Tune monthly.

### 5. Cash Payment Logging (Front Desk)

```
Staff with Front Desk role opens app
    ↓
"Log Cash Payment"
    ↓
Search member by name, email, or phone
    ↓
Enter: amount, plan being paid for, method (cash / bank transfer / mobile wallet), date, optional notes
    ↓
Confirm
    Payment record created: logged_by = staff_user_id, method = cash
    Member status → Active
    ↓
Receipt PDF auto-generated and emailed to member
    Member sees it in Payment History
    ↓
Push notification: "Your payment of $149 has been recorded. Membership active until [date]."
```

**End-of-Day Cash Reconciliation:**
- Admin or designated staff runs reconciliation
- System shows total cash payments logged that day
- Staff counts actual cash, enters count
- Discrepancy flagged with staff member's name
- Weekly discrepancy report by staff member
- **3 discrepancies in 30 days → automatic alert to owner**

### 6. Payment Idempotency (Zero Double-Charge)

```
Phone                          Server
    ↓                              ↓
1. Generate UUID            Check idempotency table
2. Save locally             Key = "a3f2-9b1c-..."
3. Disable button               ├─ seen, completed → return cached
4. Send request                 ├─ seen, in_progress → 409 Conflict
    ↓                           └─ never seen → claim, mark in_progress
    Server → Stripe (Stripe-Idempotency-Key = same UUID)
    ↓
    Stripe processes idempotently
    ↓
    Server: mark completed, cache response
```

**Failure Modes Handled:**
- **A — Request never reached server:** Network died before request left. Retry processes normally.
- **B — Server processed but response lost:** Card charged, DB updated. Retry returns cached success.
- **C — Server crashed mid-processing:** Card maybe charged, state unclear. Reconciliation worker queries Stripe, returns correct answer.
- **D — User double-tapped button:** Two requests in flight. Second waits or returns first result.
- **E — App reinstall lost local key:** New attempt with no memory. Server-side de-duplication window catches it.

**Stuck-Payment Reconciliation Worker (runs every 2 minutes):**
- Finds keys stuck `in_progress` > 30 seconds
- Queries Stripe with idempotency key:
  - Stripe shows succeeded → mark complete, create payment, activate membership
  - Stripe shows failed or no record → mark failed

**Applies to:** Payments, refunds, class bookings, member invitations, plan archival, payroll runs.

### 7. Trainer Payroll Engine

**Per-Trainer Compensation Setup (stackable components):**
- Fixed monthly salary — e.g., $1,500/month base
- Hourly rate — e.g., $25/hour for tracked hours (regular / overtime / weekend)
- Per-class rate — e.g., $30 per class taught (only if trainer actually checked in)
- Commission rate — e.g., 5% of revenue from members they referred (first 12 months only)

**Payroll Run Sequence:**
```
Step 1: Auto-generate draft
    End of pay period, system generates draft for all active staff
    Each trainer: fixed + hourly + classes + commissions − deductions = net
    ↓
Step 2: Owner review
    Adds bonuses, edits deductions, corrects errors
    Each manual change requires a note (audit trail)
    ↓
Step 3: Recurring bonuses / deductions
    Auto-applied: e.g., $100 for 100% attendance, equipment damage repayments
    ↓
Step 4: Review & lock
    Owner sees total cost, per-trainer breakdown, deductions
    Locks payroll on Finalize — no more edits
    ↓
Step 5: Pay stubs
    Per-trainer PDF: pay period, components, deductions, net pay, method
    Emailed to trainer, stored in app under Pay History
    ↓
Step 6: Payment execution
    Bank transfer: system generates bulk CSV for owner to upload to banking portal
    Cash: owner records payout, trainer confirms in-app, counts toward cash reconciliation
    Mobile wallet: owner initiates payout via system
```

**Advance Requests:**
- Trainer requests pay advance from mobile
- Owner approves with repayment schedule
- Advance paid out and auto-deducted from subsequent payrolls

### 8. SaaS Subscription Lifecycle

```
Registration: Owner picks tier → immediate first-month charge via Platform Stripe
    ↓
Recurring: Auto-charge every 30 days
    ↓
Failed Charge:
    Day 0:  Email + push notification to owner
    Day 1, 3, 5: Stripe auto-retries
    Day 6:  Grace ends → Org enters READ-ONLY mode
             No plan edits, no new signups, no payroll runs
             Existing members still use the app
    Day 30: Org fully SUSPENDED → Members locked out
    Day 90: Data archived → Deleted after retention period
    ↓
Upgrade: Immediate, prorated. New features unlock instantly. New amount from next cycle.
Downgrade: Scheduled for next cycle. Blocked if current usage exceeds lower tier limit.
Cancellation: Runs until end of paid period. 90-day retention, then deletion.
```

**Tiers:**
| Tier | Price | Member Cap | Key Features |
|------|-------|-----------|-------------|
| Starter | $29/mo | 25 | Basic ops, single trainer |
| Pro | $79/mo | 100 | Payroll, advanced analytics, multiple trainers |
| Enterprise | Custom | Unlimited | Mandatory MFA, dedicated support, SLA |

### 9. Admin Web vs Mobile Split

**Web (Full Power):**
- Plan creation and editing, member management (bulk imports, deactivations)
- Payroll runs and adjustments, refund processing
- Role and permission configuration, Stripe configuration
- Full analytics with charts and exports, audit logs (full searchable)
- Security settings: sessions, MFA enforcement, org code rotation

**Mobile (Limited Quick Actions):**
- Approve / reject pending items (leave, receipts, applications) with swipe gestures
- Toggle gym status (Open / Closed / Half-Day)
- Create simple tasks (title + assignee + deadline)
- Search and view member profiles
- Send quick text-only announcements
- Headline analytics only: today's check-ins, today's revenue, pending counts

**Explicitly NOT on Mobile:**
- Create or edit plans, process refunds, run payroll, edit roles
- Bulk-import members, change Stripe configuration, view full audit logs
- Archive plans, change security policies
- Any attempt shows: "This action is available on the web portal."

**Real-Time Sync:** Actions on web reflect on mobile within ~2 seconds via WebSocket (and vice versa).

### 10. Multi-Gym Membership

```
One user account (one email) can be a member at multiple gyms
Each membership is independent:
    - Different plan
    - Different status
    - Different payment history
    - Different billing cycle
    - Paid into different Stripe Connect account
    ↓
Org Switcher in App Header:
    🥊 Iron Pulse Boxing ▼
    Hi Sarah · ✓ Active until April 1
    Dropdown shows:
        ▸ Iron Pulse Boxing [active]
        ▸ Downtown Yoga
        ▸ CrossFit Westside
    ↓
Switch Behavior:
    Tap → current session invalidated
    App re-authenticates against target org
    JWT reissued with new organization_id
    App reloads with target org's data, branding, accent color
    ↓
Visual Org Context:
    Current org's logo top-left, accent color across UI, gym name in greetings
    Persistent banner ensures member never confuses which gym they're in
    ↓
Re-Auth on Stricter Security:
    If target org has mandatory MFA or biometric required
    Switching triggers re-auth challenge before completing switch
```

**Tenant Isolation Enforced:**
- JWT scoped to single `organization_id`
- Every API request: JWT org must match `X-Organization-Id` header
- Row-level security at database: query in Org A context cannot read Org B data
- Even with multi-org membership, each org's data is completely isolated

---

## Role Capabilities

| Capability | Owner | Manager | Trainer | Front Desk | Member |
|-----------|-------|---------|---------|-----------|--------|
| Register gym | ✅ | — | — | — | — |
| Create / edit plans | ✅ | ✅ | — | — | — |
| Archive plans | ✅ | Confirm only | — | — | — |
| Approve cash receipts | ✅ | ✅ | — | ✅ | — |
| Process refunds | ✅ | Limited | — | — | — |
| Invite members | ✅ | ✅ | — | ✅ | — |
| Run payroll | ✅ | — | — | — | — |
| Toggle gym status | ✅ | ✅ | — | ✅ | — |
| Assign tasks | ✅ | ✅ | To self | — | — |
| Log cash payment | ✅ | ✅ | — | ✅ | — |
| Upload receipt proof | — | — | — | — | ✅ |
| Book classes | — | — | — | — | ✅ |
| Check in for shift | — | — | ✅ | ✅ | — |
| View revenue analytics | ✅ | ✅ | — | — | — |

---

## Security Rules (Never Violate)

1. **Tenant Isolation First** — Every API request MUST include `X-Organization-Id` matching JWT `org_id`. RLS is the second defense, not the first.
2. **Idempotency on All State Changes** — `Idempotency-Key` header required for POST/PUT/PATCH/DELETE. Client generates UUID before sending. Server deduplicates via table + Stripe passthrough.
3. **Two Stripes, Never Mixed** — Platform Stripe for SaaS only. Gym's Stripe Connect for member payments only. Never route member money through platform account.
4. **Vague Errors on Auth Failures** — Login failure never reveals which field is wrong (email, password, or org code).
5. **Password Standards** — 12+ characters, mixed case, numbers, symbols. Checked against Have I Been Pwned. Reject compromised passwords.
6. **Email Verification Before Action** — Members cannot pay or access anything until email verified with 6-digit code. Stops disposable emails.
7. **No Mobile Financial Actions** — Refunds, payroll, plan edits, security settings are web-only. Mobile explicitly blocked with clear message.
8. **Session Revocation** — Every session tracked centrally. Owner can revoke any session instantly. Refresh token invalidated immediately.
9. **Cash Reconciliation Mandatory** — End-of-day reconciliation required. Discrepancies logged with staff name. 3 discrepancies in 30 days = alert.
10. **AI Receipt Audit Trail** — Every receipt action logged: upload time, AI verdict, admin actions, final outcome. Used for disputes and AI model improvement.

---

## Stripe Integration Details

**Platform Stripe (SaaS):**
- `stripe_customer_id` on organization
- Subscription created on registration
- `invoice.payment_succeeded` → extend SaaS period
- `invoice.payment_failed` → trigger grace period workflow
- `customer.subscription.deleted` → mark org cancelled

**Stripe Connect Standard (Gym Payments):**
- `stripe_connect_account_id` on organization
- Onboarding: owner redirected to Stripe Connect, enters business info, bank, ID verification
- `account.updated` → update `stripe_connect_status` (pending / active / restricted)
- `payment_intent.succeeded` → create payment record, activate membership
- `payment_intent.payment_failed` → notify member, allow retry
- `charge.refunded` → update payment status, notify member

**Webhook Endpoints:**
- `/api/v1/webhooks/stripe` — Platform webhooks (SaaS)
- `/api/v1/webhooks/stripe-connect` — Connect webhooks (gym payments)
- Each endpoint verifies Stripe signature. Route by event type.

---

## AI Receipt Verification Thresholds

| Confidence | Action | Member Sees |
|-----------|--------|-------------|
| ≥ 95% | Auto-approve. 5% random spot-audit later. | "Membership active." Instant. |
| 70-94% | Admin review queue. AI data shown to admin. | "Being reviewed. You'll hear back within 24 hours." |
| < 70% | Admin queue, flagged suspicious with reasons. | Same review message. |

**Tuning Plan:**
- Start at 95%
- Monitor weekly: admin reversal rate on auto-approved receipts
- Reversal rate > 2% → raise threshold to 97%
- Reversal rate < 0.2% AND admin queue backed up → lower to 92%
- Tune monthly until stable

---

## Database Core Schema (Summary)

**Organizations** — tenant root. `org_id`, `org_code`, SaaS tier/status, Stripe customer ID, Connect account ID, enrollment mode, MFA required.

**Users** — cross-tenant identity. Email, password hash, MFA config, HIBP check. One user can belong to multiple orgs via organization_members.

**Organization Members** — tenant-scoped role. Links user to org with role (owner/manager/trainer/front_desk/member). Member status (active/grace/expired/frozen/cancelled/banned). Staff rates (hourly, per-class, fixed, commission).

**Membership Plans** — owner-defined, not platform templates. Name, price, billing type (recurring/one_time_pack/drop_in), inclusions, rules, visibility (public/members_only/invite_only), status (draft/published/paused/archived).

**Subscriptions** — member's active plan. Status, amount paid, Stripe IDs, cycle dates, grace/freeze windows. Legacy pricing preserved if plan price changes.

**Payments** — all money events. Amount, method (card/cash/bank_transfer/mobile_wallet), Stripe IDs for card, logged_by for cash, receipt image + AI status for offline. Idempotency key on every record.

**Receipt Uploads** — AI pipeline artifacts. Original + processed images, OCR raw + extracted fields, authenticity scores, perceptual hash, duplicate flag, cross-validation results, confidence score, auto_approve flag, admin review actions.

**Payroll Runs** — per-period aggregation. Pay period dates, status (draft/locked/finalized/paid), totals. Linked to payroll entries.

**Payroll Entries** — per-staff line item. Fixed + hourly + classes + commission + bonuses − deductions − advance repayment = net. Payment method, pay stub URL, notes.

**Cash Reconciliations** — end-of-day. System total vs actual count, discrepancy, performed_by, notes.

**Audit Logs** — every state change. Actor, action, entity type/id, old/new values, metadata (IP, user agent).

**Sessions** — active auth tokens. User, org, token hash, device info, IP, expiry, last activity, revoked flag.

**Idempotency Keys** — deduplication table. Key, request hash, status (in_progress/completed/failed), response body, timestamps.

---

## Commands (Development)

```bash
# Setup
pnpm dev:backend      # FastAPI + PostgreSQL + Redis via docker-compose
pnpm dev:web          # Next.js dev server
pnpm dev:mobile       # Expo dev client

# Build
pnpm build:backend    # Docker image
pnpm build:web        # Next.js static export
pnpm build:mobile     # EAS build

# Quality
pnpm lint             # ESLint + Ruff across all packages
pnpm typecheck        # TypeScript + mypy
pnpm test             # Run all test suites
pnpm test:e2e         # Playwright + Maestro

# Database
pnpm db:migrate       # Alembic upgrade
pnpm db:seed          # Seed dev data
pnpm db:reset         # Drop + recreate + migrate

# Deployment
pnpm deploy:staging   # Deploy to staging
pnpm deploy:prod      # Deploy to production
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Payment double-charge rate | 0% |
| AI receipt auto-approval accuracy | > 98% |
| Web → Mobile sync latency | < 2 seconds |
| Cash reconciliation discrepancy | < 1% |
| Member signup completion rate | > 85% |
| Payroll processing time (draft to finalized) | < 10 minutes |
| API response time (p95) | < 200ms |
| Uptime | 99.9% |

---

## Open Decisions (Resolve Before Build)

1. **Trainer Commission Attribution:** Strict 12-month window (recommended). Clean math, no clawbacks, easy to explain.
2. **Cash Audit Risk:** Daily reconciliation mandatory. 3 discrepancies in 30 days triggers owner alert.
3. **AI Threshold:** Start at 95%. Tune monthly based on reversal rate.
4. **Stripe Model:** Connect Standard for Phase 1. Express (platform as merchant of record) is Phase 2+ only.
5. **Mobile Refunds:** None in v1. Small-cap mobile refunds ($50) considered for v1.1.

---

## End-to-End Walkthrough: Owner First Day

| Time | Action | Result |
|------|--------|--------|
| 00:00 | Alex downloads app, taps "Register My Gym" | — |
| 00:01 | Enters name, email, password. Verifies 6-digit code. | Account created |
| 00:02 | Enters gym details: Iron Pulse Boxing, NY, USD, 5AM–10PM | Org record created |
| 00:03 | Picks Pro tier ($79/mo). Enters card. | Charged $79. Org active. Code: IRON-PULS-3K9 |
| 00:04 | Lands on dashboard. Sees setup checklist. | ⚠ Connect Stripe, ⚠ Create plans |
| 00:05 | Clicks "Connect Stripe." Completes onboarding. | `stripe_connect_status` = active |
| 00:08 | Creates 3 plans: Monthly $149, 10-pack $200, Drop-in $25. Publishes. | Member signup unblocked |
| 00:15 | Sets enrollment to Open. Generates trainer invite codes. | Gym live |
| 00:25 | Imports 200 existing members via CSV. | Members pending activation. Emails sent. |
| 00:30 | Gym is live. | — |

## End-to-End Walkthrough: Member Sarah's Day

| Time | Action | Result |
|------|--------|--------|
| Morning | Sees flyer with IRON-PULS-3K9. Downloads app. | — |
| +1min | Taps "Join." Enters code. Passes CAPTCHA. | Org validated |
| +2min | Enters email, verifies code, sets password. | Account pending payment |
| +3min | Sees 3 plans. Picks Monthly $149. | Plan selected |
| +4min | Enters card. Payment idempotent. | Charged $149. Active until next cycle. |
| +5min | Completes profile. | Profile done |
| +6min | Lands on dashboard. Books 6PM Boxing. | Booking confirmed. Push sent. |

## End-to-End Walkthrough: Returning Member — Cash Path

| Date | Actor | Action | Result |
|------|-------|--------|--------|
| Apr 1 | System | Sarah's membership expires. | Status → expired |
| Apr 3 | Sarah | Pays Alex $149 cash. | Alex forgets to log |
| Apr 5 | Sarah | Opens app, logs in. Status expired. | Routed to "Payment Required" |
| Apr 5 | Sarah | Taps "I paid offline — Upload Receipt." Snaps photo. | Receipt queued for AI |
| Apr 5 | AI | Extracts: $149, Apr 3, Iron Pulse Boxing, Sarah Chen. | Cross-checks: matches plan, valid window, gym matches. Confidence: 96% |
| Apr 5 | System | Auto-approves (≥95%). | Reactivated. Active until May 5. |
| Apr 5 | Sarah | Lands on dashboard. Books class. | — |
| Apr 5 | Alex | Gets notification. | "Sarah's receipt auto-approved. Audit available." |

---

> **Document Status:** Engineering Ready  
> **Next Step:** Architecture review → Database migrations → Backend scaffolding → API contracts → Frontend implementation
"""

with open('/mnt/agents/output/AGENTS.md', 'w') as f:
    f.write(agents_md)

print(f"AGENTS.md written: {len(agents_md):,} characters, {len(agents_md.splitlines())} lines")
