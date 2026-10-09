# Acron Feature Audit — Full Table

Every feature identified in the PDF blueprint and the current codebase inventory, with its implementation surface and status.

- **PDF** — `AI-Native CRM  Global Product Blueprint_V3.pdf`: 79 department-level feature rows; the blueprint's AI, autonomy, agent, localisation, evidence, expansion, and screen requirements are expanded into 49 additional audit items here.
- **API** — `backend/app` (FastAPI).
- **Web** — `frontend/app` (Next.js).
- **Mobile** — `mobileapp/src/app` (Expo).
- **Code snapshot** — based on `main` at `fe15486`, plus the lead-profile implementation in this update. The temporary plans-screen render harness is excluded from shipped-feature counts.
- **Method** — static inspection of models, routes, services, workers, and reachable web/mobile screens. Feature claims in the PDF are treated as requirements, not agent instructions. Automated tests were not run for this documentation audit.

**Part A** = features stated in the PDF. **Part B** = features that exist in the code but are not itemised in the PDF (auth, multi-org, realtime, idempotency, verticals, …).

### Status definitions

| Status | Meaning |
|---|---|
| ✅ **Built** | Implemented and wired end-to-end for the scope named in the feature row |
| 🔧 **Improvement** | A usable implementation exists; the remaining gap is a refinement or broader coverage |
| ⚠️ **Partial** | Some meaningful parts work, but a material requirement in the row is missing |
| 🧨 **Broken / stubbed** | Code is present, but a central promised behavior is a placeholder or cannot perform its purpose |
| ❌ **Not built** | No usable implementation exists; an enum, comment, or unused schema alone does not count |

---

## Summary

| Status | Part A: PDF items (128) | Part B: code-only items (18) | All (146) |
|---|---:|---:|---:|
| ✅ Built | 13 | 15 | **28** |
| 🔧 Improvement | 4 | 0 | **4** |
| ⚠️ Partial | 56 | 3 | **59** |
| 🧨 Broken / stubbed | 1 | 0 | **1** |
| ❌ Not built | 54 | 0 | **54** |

The surface columns are not mutually exclusive; a row can have API and web coverage, for example. Counts above classify each feature row once by its overall status. The 49 cross-cutting PDF items are audit rows 80–128; those row numbers are audit indices, not numbering printed in the PDF.

By priority (both parts; Part B priorities are assigned here, the PDF marks only Part A): P0 — 16 built, 1 improvement, 19 partial, 11 not built; P1 — 7 built, 2 improvements, 13 partial, 13 not built, 1 broken/stubbed; P1–P2 — 1 built, 3 partial, 1 not built; P2 — 4 partial, 5 not built. The 49 cross-cutting items carry no PDF priority.

### Confirmed broken or stubbed behavior

| Feature row | Status | Evidence | Impact |
|---|---|---|---|
| 27 — Payment-proof verification | 🧨 Broken / stubbed | `backend/app/integrations/ocr.py`: `_real_extract()` always returns `None`; the fallback invents extracted fields from request inputs, and `_phash()` is SHA-256 rather than a perceptual image hash | The upload, review, routing, and audit flow exists, but the system does not read or authenticate the receipt image. Do not treat its automated confidence or duplicate result as real OCR/fraud verification. |

Other absent capabilities are classified as **Not built**; incomplete but functioning capabilities remain **Partial** or **Improvement**. Email, push, Stripe, and assistant fallback modes are intentional development behavior when credentials are absent, so they are not counted as broken. The booking `NO_SHOW` enum has no detection or assignment workflow and is therefore counted as **Not built**, not broken.

### Notion comparison limitation

The supplied Notion page did not load in the available browser during this audit, so its current table could not be independently checked. A prior copied tracker was reported to use numbering one higher than the PDF table; treat that offset as provisional until the live Notion rows can be read. The statuses in this file are based on the PDF and repository evidence, not a fresh Notion read.


---

## Part A — Blueprint features (PDF, rows 1–128)

| # | Feature | Pri | PDF | API | Web | Mobile | Status | Evidence / gap |
|---|---|---|---|---|---|---|---|---|
| 1 | Lead capture from WhatsApp, SMS, Instagram, Facebook, LINE, WeChat, web forms, calls, walk-ins | P0 | ✓ | ✓ | — | — | ⚠️ Partial | Manual staff-entered and source-tagged lead intake is available at `/app/leads`; no public web form or WhatsApp/SMS/social channel connectors |
| 2 | Lead profile: goal, budget, preferred times, preferences | P0 | ✓ | ✓ | — | — | ✅ Built | Tenant-scoped profile fields editable in `/app/leads`, with field provenance, searchable prospects, and pipeline stage tracking; does not include AI extraction or conversation linking |
| 3 | Pipeline: New → Contacted → Trial booked → Visited → Joined / Lost | P0 | ✓ | — | — | — | ❌ Not built | No stage enum, no pipeline entity |
| 4 | Instant first reply 24/7 | P0 | ✓ | — | — | — | ❌ Not built | No auto-reply, no FAQ knowledge base |
| 5 | Trial and tour booking | P0 | ✓ | — | — | — | ❌ Not built | `plan.trial_days` is a SaaS free trial; `visitor.py:4` says "a trial" in prose only. Only class booking exists |
| 6 | Follow-up sequences (day 0, 1, 3, 7) | P0 | ✓ | — | — | — | ❌ Not built | Member-side onboarding exists (row 31); lead-side does not |
| 7 | Lost-reason tracking and lead scoring | P1 | ✓ | — | — | — | ❌ Not built | — |
| 8 | Speed-to-lead reporting; missed-call text-back | P1 | ✓ | — | — | — | ❌ Not built | — |
| 9 | Corporate and group memberships; referral tracking | P1–P2 | ✓ | ✓ | ✓ | — | ⚠️ Partial | Corporate fully built: `models/company.py`, `company_contract.py`, `invoices_service.py`, `routes/companies.py`. Referral: `membership.py:56 referred_by_member_id` + 12-month commission attribution (`workers/payroll_runner.py:93`). Missing: referral programme, rewards, lead-side attribution |
| 10 | Member profile: photo, ID (where legal), contact, emergency contact, goals, health notes | P0 | ✓ | ✓ | ✓ | — | ⚠️ Partial | `membership.py:40 photo_url`, `:41 emergency_contact`, `user.py:35 emergency_contact`. Missing: ID, goals, health notes, auto-generated summary |
| 11 | Plans: daily to yearly, family, student, off-peak, class packs, credits | P0 | ✓ | ✓ | ✓ | ✓ | ⚠️ Partial | `PlanBillingType` = recurring / one_time_pack / drop_in; duration + price free-form so most variants expressible. Missing: credits, family linkage |
| 12 | Joining fees, discounts, promo codes | P0 | ✓ | — | — | — | ❌ Not built | 0 matches for `discount\|coupon\|promo\|joining_fee` in `backend/app`. No promotion engine at all |
| 13 | Freeze/pause (travel, illness, seasonal) | P0 | ✓ | ✓ | ✓ | — | ⚠️ Partial | `MemberStatus.FROZEN`; `members_service.py:83 freeze` / `:85 unfreeze` — staff actions only. Missing: member-requested freeze, approve flow, auto-detect from messages |
| 14 | Renewals and expiry reminders | P0 | ✓ | ✓ | — | — | ⚠️ Partial | Post-expiry grace reminders only (`workers/notifications.py:33`, days 1/2/3). Missing: pre-expiry T-7/T-3/T-1 cadence |
| 15 | Upgrades, downgrades, transfers, cancellation with save offer | P1 | ✓ | — | — | — | ❌ Not built | `saas_billing_service.py:74 upgrade` / `:90 downgrade` / `:116 cancel` are **SaaS-tier only**. `memberships_service.py` is signup/activation — no member plan change, transfer, save offer (verified: no such function exists) |
| 16 | Family and multi-payer accounts; segmentation and tags | P1–P2 | ✓ | ✓ | — | — | ⚠️ Partial | Segments are dynamic and computed: `campaign_service.py:82 _resolve_segment` (status, plan, days-since-visit). Missing: family accounts, multi-payer, tags |
| 17 | Check-in by QR, card/RFID, app, biometric or manual | P0 | ✓ | ✓ | ✓ | — | ⚠️ Partial | **QR is fully working end-to-end**: member QR issued (`MemberDetailSheet.tsx:602` — `QRCodeSVG value={acron:member:{member_id}}`), webcam scanner (`components/attendance/QrScanner.tsx`, `@zxing/browser`), decode → `checkIn(memberId, "", "qr")` (`attendance/page.tsx:377-386`). Manual ✅ (inline in `attendance/page.tsx:318`, offline localStorage queue). All 5 values in `AttendanceMethod` (`core/constants.py:208`). Missing: card/RFID reader, biometric hardware, member self-check-in in mobile app |
| 18 | Status on check-in: expired, dues, birthday, at-risk | P0 | ✓ | ✓ | ✓ | — | ✅ Built | `services/attendance_service.py:142` renewal line, `:43 _RISK_DAYS = 14`, `:184` status payload |
| 19 | Shared team inbox for all channels | P0 | ✓ | ✓ | ✓ | — | ⚠️ Partial | Inbox fully built: conversations, assignment, status, AI draft; `Channel` enum has 12 values (`core/constants.py:227` — WHATSAPP, SMS, EMAIL, INSTAGRAM, MESSENGER, LINE, WECHAT, TELEGRAM, WEB_CHAT, PHONE, WALK_IN, OTHER). **The inbox never sends** — `inbox_service.py` stores only; `integrations/` has no sms/whatsapp/telegram module at all (email + push are the only transports, used by notifications/campaigns, not the inbox) |
| 20 | Staff "Today" task list | P0 | ✓ | ✓ | ✓ | ✓ | ✅ Built | `models/staff.py:28 class Task`, `staff_service.py:272-348` CRUD, `frontend/app/app/tasks`, `mobileapp/src/app/(admin)/tasks.tsx` |
| 21 | Walk-ins, day passes, guest log, lockers | P1–P2 | ✓ | ✓ | ✓ | — | ✅ Built | `models/visitor.py`, `visitor_service.py:130` day pass → `Payment(kind=DAY_PASS)`, `routes/front_desk.py` |
| 22 | Offline mode with sync | P1 | ✓ | ✓ | ✓ | — | 🔧 Improvement | `routes/attendance.py:62 POST /sync` — idempotent offline-queued check-in flush; `:56` offline roster |
| 23 | Local payment methods per country | P0 | ✓ | — | — | — | ❌ Not built | `PaymentMethod` = CARD, CASH, BANK_TRANSFER, MOBILE_WALLET, OTHER — generic only. No SEPA / iDEAL / Pix / UPI / M-Pesa / JazzCash |
| 24 | Recurring billing: cards, direct debit, mandates | P0 | ✓ | ✓ | — | — | ⚠️ Partial | Stripe card recurring built; 0 matches for `direct_debit` / `mandate`. No card-updater, no smart retry |
| 25 | Failed-payment and overdue recovery (dunning) | P0 | ✓ | ✓ | — | — | ⚠️ Partial | SaaS has the full escalation ladder (`saas_billing_service.py`). Members get grace reminders days 1/2/3 (`notifications.py:33`, email + push + in-app). Missing: escalating ladder to staff call, smart retry |
| 26 | Cash and manual payments with digital receipts | P0 | ✓ | ✓ | ✓ | ✓ | ✅ Built | `models/cash.py`, `cash_service.py`, `routes/cash.py:63` receipt PDF, `CashReconciliation` |
| 27 | Payment-proof verification (bank-transfer or wallet screenshots) | P1 | ✓ | ✓ | — | — | 🧨 Broken / stubbed | The upload, review, routing, and audit workflow exists, but the core image-reading behavior does not: `_real_extract()` returns `None`, fallback fields are derived from request inputs, and `_phash()` is SHA-256 rather than a perceptual hash. The system cannot verify receipt content or detect image fraud |
| 28 | Invoices with local tax (VAT, GST, sales tax) | P1 | ✓ | ✓ | ✓ | — | ⚠️ Partial | `plan.tax_rate` end-to-end incl. inclusive-tax: `invoices_service.py:83`, `memberships_service.py:345 _amount_with_tax()`. Missing: country/region rule packs |
| 29 | Expenses, P&L, revenue by plan, branch or trainer | P1 | ✓ | ✓ | ✓ | — | ⚠️ Partial | Revenue by plan/trainer ✅ (swarm specialists `rev_by_plan`, `payroll_commissions`). 0 matches for `expense`. No P&L, no branch dimension |
| 30 | Refunds, credits, chargeback evidence; accounting export | P1 | ✓ | ✓ | — | — | ⚠️ Partial | Refunds ✅ approval-gated (`agent/tools/write.py refund_payment` via `_proposal()`). Missing: account credits, chargeback evidence assembly, accounting export |
| 31 | 90-day onboarding journey (day 1, days 2–7, weeks 2–4) | P0 | ✓ | ✓ | — | — | ⚠️ Partial | `models/onboarding.py`, `onboarding_service.py:203` ("not visited in 7 days"), `routes/onboarding.py`, `workers/onboarding.py`. Missing: UI |
| 32 | Attendance-drop detection vs each member's own baseline | P0 | ✓ | ✓ | — | — | ⚠️ Partial | `retention_service.py:41-44` — 14-day window vs prior 56-day baseline, `DROP_RATIO=0.5`, `SEVERE_RATIO=0.25`, `MIN_TENURE_DAYS=21`. Missing: UI |
| 33 | Churn-risk score with reasons | P0 | ✓ | ✓ | — | — | ⚠️ Partial | `retention_service.py:166-245 compute_risk` — 0-100 score, `HIGH_BAND=70`/`MEDIUM_BAND=40`, weighted `RiskReason` objects with human text, 5 signal families, loyalty cushion (−10). Missing: UI |
| 34 | Inactivity ladder: 5 days message, 10 days staff check-in, 14–21 days call | P0 | ✓ | ✓ | — | — | ⚠️ Partial | `inactivity_ladder_service.py:95` rungs incl. "Win-back"; `routes/ladder.py`, daily worker. Missing: UI |
| 35 | Win-back campaigns; milestones; birthdays | P1 | ✓ | ✓ | — | — | ⚠️ Partial | `models/winback.py`, `models/celebration.py`, both services + workers. Missing: UI |
| 36 | NPS at day 7, 30, 90; complaint clustering | P1 | ✓ | ✓ | — | — | ⚠️ Partial | `nps_service.py:435 _nps()`, theme taxonomy at `:75`; day-7/30/90 daily sweep, `routes/nps.py`. Missing: UI |
| 37 | Challenges, streaks, leaderboards | P2 | ✓ | ✓ | — | — | ⚠️ Partial | `models/gamification.py` — `GymChallenge`, `MemberChallengeProgress`, `MemberStreak`; `routes/challenges.py`, daily worker. Missing: UI |
| 38 | Segmented campaigns by channel (WhatsApp, SMS, email, LINE, and others) | P1 | ✓ | ✓ | — | — | ⚠️ Partial | Segment resolution real (`campaign_service.py:82 _resolve_segment`); `CampaignChannel` = **IN_APP, EMAIL, BOTH** — not WhatsApp/SMS/LINE. `routes/campaigns.py` exists. Missing: the named channels, and UI |
| 39 | Seasonal offers (New Year, summer, Ramadan, Diwali, Lunar New Year, and more) | P1 | ✓ | — | — | — | ❌ Not built | 0 matches for `seasonal`. No local calendar |
| 40 | Referral programme; review requests after positive moments | P1 | ✓ | — | — | — | ❌ Not built | 0 matches for `review_request`. Referral *attribution* exists (row 9); no programme, no rewards, no review requests |
| 41 | Lead-ad integrations (Meta, Google, TikTok) | P1 | ✓ | — | — | — | ❌ Not built | — |
| 42 | Campaign ROI: leads → trials → members → revenue | P1 | ✓ | — | — | — | ❌ Not built | 0 matches for `roi` in campaign context. No funnel attribution |
| 43 | Landing pages; content ideas | P2 | ✓ | — | — | — | ❌ Not built | — |
| 44 | Trainer profiles, schedules, availability | P1 | ✓ | ✓ | ✓ | — | ⚠️ Partial | Staff model + `Shift` (`models/staff.py:13`) + payroll rates. Missing: availability model, public profile |
| 45 | PT package sales and session tracking | P1 | ✓ | — | — | — | ❌ Not built | 0 matches for `pt_package` / `session_credit`. `member_trainer.py` is a coach link only |
| 46 | Trainer–client matching | P1 | ✓ | ✓ | ✓ | — | ⚠️ Partial | Manual assignment only: `member_trainer.py`, `routes/members.py:245-283 assign_trainer/unassign`. Missing: goal/preference/timing matching |
| 47 | Workout and diet plans; progress tracking | P2 | ✓ | — | — | — | ❌ Not built | No routine/program/exercise model |
| 48 | Trainer performance by client retention | P1 | ✓ | — | — | — | ❌ Not built | No retention ranking per trainer |
| 49 | Timetable, booking, capacity, waitlist | P1 | ✓ | ✓ | ✓ | ✓ | ⚠️ Partial | `class_session.py:30 capacity: int = 20`, booking + cancel built (`classes_service.py:174`), member booking in web + mobile (`mobileapp/(member)/classes.tsx:60-140` idempotent). **0 matches for `waitlist`/`wait_list`** |
| 50 | No-show tracking and reminders | P1 | ✓ | — | — | — | ❌ Not built | `BookingStatus.NO_SHOW` exists (`core/constants.py:205`) and is in the DB enum, but is **never assigned anywhere** — 0 matches for `BookingStatus.NO_SHOW` outside the definition. No no-show detection, no reminder logic, no risk signal |
| 51 | Utilisation analytics; instructor substitution | P2 | ✓ | ✓ | — | — | ⚠️ Partial | Swarm specialists `ops_class_fill`, `ops_space_use`, `ops_peak_hours`. Missing: instructor substitution (0 matches for `substitut`) |
| 52 | Roles and permissions: owner, manager, front desk, trainer | P0 | ✓ | ✓ | ✓ | ✓ | ✅ Built | `Role` enum + `Capability` enum (incl. `TAKE_ATTENDANCE`), enforced in API deps |
| 53 | Activity and audit log | P0 | ✓ | ✓ | ✓ | — | ✅ Built | `models/audit_log.py`, `audit_service.py`, `routes/audit.py`, `record_audit()` called from services |
| 54 | Shifts, attendance, salaries, commissions, per-session pay | P1 | ✓ | ✓ | ✓ | ✓ | ✅ Built | `models/staff.py:13 Shift` + `:221/:246 check_in/check_out`; `payroll_service.py` fixed+hourly+per-class+commission; `workers/payroll_runner.py:93` 12-month commission window; `frontend/app/app/payroll`, `mobileapp/(staff)/shift.tsx` |
| 55 | Staff performance: response time, conversions, collections | P1 | ✓ | — | — | — | ❌ Not built | 0 matches for staff KPI/performance aggregation (`performance\|kpi\|response_time\|conversion`) |
| 56 | POS for supplements, merchandise, day passes | P1 | ✓ | ✓ | — | — | ⚠️ Partial | Day passes write real payments (`visitor_service.py:130`). 0 matches for `sale/retail/merch/stock` — no retail POS |
| 57 | Inventory and low-stock alerts | P2 | ✓ | — | — | — | ❌ Not built | 0 matches for `inventory` |
| 58 | Door and turnstile access tied to membership status | P2 | ✓ | — | — | — | ❌ Not built | No device integration |
| 59 | Equipment register and maintenance | P2 | ✓ | — | — | — | ❌ Not built | 0 matches for `asset` / `maintenance` |
| 60 | Peak-hour tracking; safety checklists | P2 | ✓ | ✓ | — | — | ⚠️ Partial | `ops_peak_hours` specialist. Missing: safety checklists |
| 61 | "Today" command centre | P0 | ✓ | — | ✓ | — | ⚠️ Partial | `frontend/app/app/page.tsx` (494 lines) with KPI strip + headline metrics. A dashboard, not the blueprint's ranked action list ("8 people need you today; USD 1,240 at stake" with Send/Edit/Skip/Call) |
| 62 | Daily owner brief on the owner's preferred channel | P0 | ✓ | ✓ | — | — | 🔧 Improvement | `routes/assistant.py:331 POST /briefing` → `workflows.weekly_briefing`. **Weekly, not daily**; **in-app only**, not on preferred channel |
| 63 | KPIs: active members, joins, churn, MRR, collections, conversion | P0 | ✓ | ✓ | ✓ | ✓ | ✅ Built | `analytics_service.py`, `routes/analytics.py`, KPI strip `frontend/app/app/page.tsx:196` |
| 64 | Revenue-at-risk panel; Wins feed (money recovered) | P0 | ✓ | ✓ | — | — | ⚠️ Partial | `revenue_at_risk` computed and returned (`retention_service.py:383-409`). **Wins feed absent** — 0 matches for `wins` feed in backend/frontend/mobileapp |
| 65 | Ask-anything analytics | P1 | ✓ | ✓ | ✓ | — | 🔧 Improvement | `routes/assistant.py`, `agent/` LangGraph graph, 40-specialist swarm, `ChatGroq` live when `GROQ_API_KEY` set (`agent/model.py:32`) with documented offline stub; web `frontend/app/app/assistant` + streaming API |
| 66 | Multi-branch, multi-currency, franchise royalties | P1–P2 | ✓ | — | — | — | ❌ Not built | 0 matches for `branch_id\|location_id\|site_id\|royalty\|franchise` in models. "venue" hits are the industry vertical. `default_currency` on org only |
| 67 | Waivers, health forms (PAR-Q), contracts with e-signature | P1 | ✓ | — | — | — | ❌ Not built | 0 matches for `waiver` / `parq`. All `esignature` hits are `Stripe-Signature` webhook headers |
| 68 | Consent management per channel and purpose (opt-in, opt-out) | P0 | ✓ | — | — | — | ❌ Not built | 0 matches for `opt_in\|opt_out\|consent\|unsubscribe`. The `SUPPRESSED` delivery status is **not** consent — `campaign_service.py:276` derives `wants_email` from the campaign's channel; the only suppression is `email_verified == False` |
| 69 | Data-subject requests: access, export, correction, erasure | P0 | ✓ | — | — | — | ❌ Not built | 0 matches for `gdpr\|dsar\|erasure` |
| 70 | Auto-renewal disclosures, cooling-off and online cancellation | P0 | ✓ | — | — | — | ❌ Not built | 0 matches for `cooling_off\|auto_renewal` |
| 71 | Role-based access to sensitive data | P0 | ✓ | ✓ | — | — | ⚠️ Partial | RBAC roles + capabilities enforced in deps. Missing: field-level sensitivity |
| 72 | Evidence Vault (section 8) | P0 | ✓ | — | — | — | ❌ Not built | Audit log exists but is editable — no hash chain (`prev_hash: 0`), no soft delete (`deleted_at: 0`), no packs, no WORM, no residency. See rows 109–118 |
| 73 | Data residency options (EU, India, Gulf, and others) | P1 | ✓ | — | — | — | ❌ Not built | 0 matches for `storage_region` |
| 74 | Messaging-first member self-service: renew, pay, freeze, book | P0 | ✓ | ✓ | — | ✓ | ⚠️ Partial | Member app can **book** (`mobileapp/(member)/classes.tsx:60-140` — idempotent `POST /classes/book`, `DEL /classes/bookings/{id}`) and **view dues/history** (`payments.tsx` → `GET /payments/my`). Missing: renew, freeze self-service (freeze is staff-only, `members_service.py:83`), messaging/AI concierge |
| 75 | Web portal or PWA: card, QR, dues, history | P1 | ✓ | ✓ | — | ✓ | ⚠️ Partial | Earlier audit said "No `mobile/` directory" — **`mobileapp/` exists**: Expo app, 44 screens under `mobileapp/src/app/`, member dues + payment history real (`payments.tsx`). Missing: digital member card, QR code (0 matches for `qr`/`member_card` in mobileapp) |
| 76 | Branded app, workout log, streaks, rewards | P2 | ✓ | ✓ | — | ✓ | ⚠️ Partial | Branded Expo app exists (`mobileapp/app.json`, industry-aware tabs in `(member)/_layout.tsx:31-70`). Backend streaks/challenges complete. Missing: workout log, streak/reward UI (0 matches in mobileapp screens) |
| 77 | Import from spreadsheets and competitor exports | P0 | ✓ | ✓ | — | — | ⚠️ Partial | Backend only: `routes/members.py:331 POST /members/import` → `members_service.py:324 bulk_import_csv`. **No UI in web or mobile** (0 matches for import/CSV in `frontend/app` or `mobileapp/src`). No competitor-format importer (0 matches for `competitor`) |
| 78 | Multilingual UI, right-to-left support, local date and number formats | P0 | ✓ | — | — | — | ❌ Not built | `org.country/timezone/default_currency` fields only. 0 matches for `i18n`/`translation`; the "locale" frontend hits are `toLocaleDateString` |
| 79 | Public API and webhooks; usage and cost meter | P1–P2 | ✓ | ✓ | — | — | ⚠️ Partial | Inbound Stripe webhooks ✅ signature-verified, two endpoints (`routes/webhooks.py:1-60` — `/webhooks/stripe`, `/webhooks/stripe-connect`). Missing: outbound public API, API keys, usage/cost meter |
| 80 | L1 Event ledger: append-only timeline per person, nothing overwritten | — | ✓ | ✓ | — | — | ⚠️ Partial | `AuditLog` + append-only attendance records. No per-person raw event stream (messages, notes, calls) as source of truth |
| 81 | L2 Understanding: LLM + rules extract intent, goal, objection, sentiment, payment details, freeze requests, any language | — | ✓ | ✓ | — | — | ⚠️ Partial | LLM live in assistant (`agent/model.py:32 ChatGroq`). No inbound-message extraction pipeline — messages are never parsed into structured facts |
| 82 | L3 Customer model: structured state + history — plan, expiry, dues, visit baseline, risk, goal, trainer, summary | — | ✓ | ✓ | — | — | ✅ Built | Snapshot + `plan_summaries.py` one-paragraph summary; risk from `retention_service.py`; visit baseline computed |
| 83 | L4 Signal engine: deterministic triggers + ML risk scoring (expiry, absence, visit drop, unpaid dues, unanswered lead) | — | ✓ | ✓ | — | — | ⚠️ Partial | Deterministic triggers (workers) + weighted score (`retention_service.py:166-245`). **No ML**; no unanswered-lead signal (no leads) |
| 84 | L5 Decision layer: next best action, draft, value estimate, owner assignment, autonomy level | — | ✓ | ✓ | — | — | ⚠️ Partial | Assistant proposes writes via `_proposal()` with draft text. No ranked next-best-action engine, no value estimate, no owner assignment, no autonomy level |
| 85 | L6 Action layer: auto-send · approve-then-send · staff task · call | — | ✓ | ✓ | — | — | ⚠️ Partial | Auto / approve / task all exist but scattered across workers and features. No call action; sends limited to email + push |
| 86 | L7 Outcome loop: did they reply, return, pay, renew? Model learns; Wins feed shows money recovered | — | ✓ | — | — | — | ❌ Not built | No learning loop, no outcome attribution, no Wins feed (`wins: 0`) |
| 87 | L0 Observe: update summary, compute risk, tag lead — always automatic | — | ✓ | ✓ | — | — | ⚠️ Partial | Risk computation and summaries run automatically in workers. No lead tagging (no leads) |
| 88 | L1 Auto-act (safe): FAQ reply, receipt, renewal reminder, class reminder, first lead reply — automatic, template-bound, reversible | — | ✓ | ✓ | — | — | ⚠️ Partial | Grace reminders, onboarding messages, celebration messages auto-send on schedule. No FAQ reply, no first-lead reply |
| 89 | L2 Approve first: discounts, win-back offers, complaint replies, freezes, bulk campaigns — one-tap approval | — | ✓ | ✓ | ✓ | — | ⚠️ Partial | Real human-in-the-loop gate: `agent/tools/write.py` 8 approval-gated writes via `_proposal()` / `_rejected()`. No one-tap approval UI for the full set |
| 90 | L3 Human only: refunds, price changes, medical topics, angry customers, cash mismatches — AI briefs a human | — | ✓ | — | — | — | ❌ Not built | Not distinguished from L2. No risk classification, no fail-closed timeout |
| 91 | Owner trust ladder: move any action type between levels; promote to L1 after seeing results; AI-disclosure setting per country | — | ✓ | — | — | — | ❌ Not built | No L0–L3 tiers, no owner-controlled promotion dial, no AI-disclosure setting (`AI Act Art. 50`) |
| 92 | Lead Concierge — instant reply, qualification, trial booking, follow-up | — | ✓ | — | — | — | ❌ Not built | No lead entity, no inbound auto-reply |
| 93 | Renewal & Collections — expiry reminders, dunning, payment links, proof matching | — | ✓ | ✓ | — | — | ⚠️ Partial | Grace reminders (days 1/2/3), payment-proof pipeline, SaaS dunning ladder. Missing: payment links to members, member escalation ladder |
| 94 | Retention Coach — onboarding, absence check-ins, milestones, save offers | — | ✓ | ✓ | — | — | ✅ Built | Onboarding journey + inactivity ladder + win-back + celebrations all built with routes and daily workers |
| 95 | Front-Desk Copilot — check-in context, draft replies | — | ✓ | ✓ | ✓ | — | ⚠️ Partial | Check-in status card (row 18) + inbox AI draft (`inbox_service.py`). Missing: context summary at check-in beyond status flags |
| 96 | Owner Analyst — morning brief, Q&A, explanations | — | ✓ | ✓ | ✓ | — | ✅ Built | `POST /assistant/briefing` + ask-anything with 40 specialists (`routes/assistant.py:331`) |
| 97 | Reputation Agent — review requests, complaint clustering | — | ✓ | ✓ | — | — | ⚠️ Partial | NPS + complaint clustering built (`nps_service.py:75` theme taxonomy). Missing: review requests (0 matches for `review_request`) |
| 98 | Compliance Guard — checks consent, quiet hours, disclosures, cancellation rules per country | — | ✓ | — | — | — | ❌ Not built | No consent model, no country rule packs, no quiet hours — nothing to check against |
| 99 | Country Pack container: quiet hours, consent types, reminder schedules, cooling-off, cancellation channels, AI-disclosure text, retention defaults | — | ✓ | — | — | — | ❌ Not built | 0 matches for `country_pack`. `org.country/timezone/default_currency` are bare fields |
| 100 | Messaging channels by region (WhatsApp, SMS, LINE, WeChat, Telegram; email fallback) | — | ✓ | — | — | — | ❌ Not built | 12-value `Channel` enum (`core/constants.py:227`) but `integrations/` contains only `email.py`, `push.py`, `llm.py`, `ocr.py`, `hibp.py`, `stripe_*` — no sms/whatsapp/line/wechat/telegram module exists. `inbox_service.py` stores conversations without sending |
| 101 | Local payment methods by region (SEPA, Pix, UPI AutoPay, M-Pesa, JazzCash, cards/ACH, Stripe/Adyen gateway) | — | ✓ | ✓ | — | — | ⚠️ Partial | Stripe + cash + bank_transfer + mobile_wallet generic. No regional rails (0 matches for `pix\|upi\|m_pesa\|sepa\|jazzcash`) |
| 102 | Privacy-law rule packs (GDPR, AI Act, CCPA, LGPD, DPDP, PDPL) with deadline tracking | — | ✓ | — | — | — | ❌ Not built | 0 matches for `gdpr\|privacy_rule\|deadline` tracking |
| 103 | Membership and messaging rules (US state auto-renewal, UK DMCC cooling-off, opt-in/STOP, quiet hours 8am–9pm) | — | ✓ | — | — | — | ❌ Not built | 0 matches for `quiet_hours\|cooling_off\|stop_keyword` |
| 104 | Languages and RTL (major languages, Hinglish/Roman Urdu/Spanglish/Arabizi, Arabic/Urdu/Hebrew layouts) | — | ✓ | — | — | — | ❌ Not built | 0 matches for `i18n` / `translation` / `rtl` |
| 105 | Currency: multi-currency pricing, reports, multi-branch consolidation | — | ✓ | ✓ | — | — | ⚠️ Partial | `org.default_currency` only. No multi-currency pricing or consolidation |
| 106 | Tax: VAT, GST, sales tax on invoices by country and region | — | ✓ | ✓ | — | — | ⚠️ Partial | `plan.tax_rate` incl. inclusive-tax handling (`memberships_service.py:345`). No country/region rule packs |
| 107 | Culture: local holidays/seasons, women-only hours, tone per country, local names and formats | — | ✓ | — | — | — | ❌ Not built | 0 matches for `holiday\|women_only\|tone` |
| 108 | Pricing: tiers adjusted for purchasing power (PPP) | — | ✓ | — | — | — | ❌ Not built | 0 matches for `ppp\|purchasing_power` |
| 109 | Append-only ledger: old versions kept on every edit | — | ✓ | — | — | — | ❌ Not built | `AuditLog` records changes but rows are editable/deletable. No version history |
| 110 | Soft delete + Recycle Bin: 90-day restorable, one-click undo | — | ✓ | — | — | — | ❌ Not built | 0 matches for `deleted_at` / `recycle`. Hard deletes only (`members_service.py:417 delete_member`) |
| 111 | Automatic Evidence Packs: PDF + Excel snapshot before delete, merge, bulk edit or payment change | — | ✓ | — | — | — | ❌ Not built | 0 matches for evidence pack generation |
| 112 | Tamper-evident audit chain: hash-chained entries + signed daily checkpoints outside the DB | — | ✓ | — | — | — | ❌ Not built | 0 matches for `prev_hash` / checkpoint signing |
| 113 | WORM storage: object lock blocks deletion/overwrite during retention | — | ✓ | — | — | — | ❌ Not built | 0 matches for `worm` / object lock |
| 114 | Point-in-time recovery + 3-2-1 backups (three copies, two media, one off-site) | — | ✓ | — | — | — | ❌ Not built | No PITR/backup config in codebase |
| 115 | Owner-held daily exports: daily Excel to email/cloud, monthly PDF statement | — | ✓ | — | — | — | ❌ Not built | 0 matches for daily export worker |
| 116 | Access and export log: records who viewed or exported what | — | ✓ | ✓ | — | — | ⚠️ Partial | Partial via `AuditLog` (record_audit covers state changes). No dedicated view/export logging |
| 117 | Owner alerts: bulk deletes, payment edits, large exports, after-hours changes | — | ✓ | — | — | — | ❌ Not built | No alert rules on audit events |
| 118 | Erasure with hash-only stub: personal fields erased, hash keeps chain valid | — | ✓ | — | — | — | ❌ Not built | No erasure path at all |
| 119 | Generic engine: Person / Event / Payment / "Say-Do-Pay" core | — | ✓ | ✓ | ✓ | ✓ | ⚠️ Partial | **Multi-industry built** — `org.industry ∈ {gym, office, academy}` (`models/organization.py:29`), `core/industry.py` per-industry labels/modules/checklist/nouns, schema-driven plan builder, `routes/industries.py`, industry-aware mobile tabs (`(member)/_layout.tsx:31-70`). Missing: clinic/salon/real-estate/B2B verticals |
| 120 | Sales-company pack (contacts, deals, meetings, quotes, lead ownership) | — | ✓ | — | — | — | ❌ Not built | 0 matches for sales-company pack |
| 121 | Pack builder / vertical marketplace | — | ✓ | — | — | — | ❌ Not built | Industry schemas are hardcoded, not installable packs |
| 122 | Today: one ranked list ("8 people need you today; USD 1,240 at stake") with Send / Edit / Skip / Call per card | — | ✓ | — | ✓ | — | ⚠️ Partial | `frontend/app/app/page.tsx` (494 lines) has KPI strip + headline metrics but no ranked action list, no value-at-stake cards, no per-item actions |
| 123 | Inbox: all channels in one place, member summary alongside, AI drafts | — | ✓ | ✓ | ✓ | — | ⚠️ Partial | Inbox UI, assignment/status, member linking, and AI drafts exist. `inbox_service.py` explicitly has no channel provider; replies are stored but not delivered externally. Email/push transports are used by other notification flows, not by this inbox. |
| 124 | Desk: check-in scanner with a status card for each arrival | — | ✓ | ✓ | ✓ | — | ⚠️ Partial | Both halves exist: scanner (`QrScanner.tsx` @zxing webcam reader, wired at `attendance/page.tsx:657`) + status card (`attendance_service.py:184`, shown in attendance page). Missing: RFID/biometric hardware paths |
| 125 | People: one scrollable timeline of messages, visits and payments per person | — | ✓ | ✓ | ✓ | — | 🔧 Improvement | Member detail sheet shows visits + payments (`member_detail`, `frontend/app/app/members/[memberId]`). No unified message timeline |
| 126 | Money: collections, dues, cash drawer, P&L, recovered this month | — | ✓ | — | ✓ | — | ⚠️ Partial | Collections/dues/cash drawer ✅ (`frontend/app/app/cash`, `payments`, `analytics`). No P&L (row 29), no "recovered this month" |
| 127 | Ask: natural-language questions in any language, action buttons in the answer | — | ✓ | ✓ | ✓ | — | ✅ Built | Assistant with LangGraph + 40 specialists, streaming (`frontend/app/api/assistant/stream`), approval-gated write actions |
| 128 | Wins: feed of members saved, money recovered, leads converted | — | ✓ | — | — | — | ❌ Not built | 0 matches for wins feed. Shares root cause with row 64 and layer 86 |

---

## Part B — App-only features (in code, not itemised in the PDF)

| # | Feature | Pri | PDF | API | Web | Mobile | Status | Evidence / gap |
|---|---|---|---|---|---|---|---|---|
| A1 | Authentication: register, email-code verify, login, JWT refresh, password reset | P0 | — | ✓ | ✓ | ✓ | ✅ Built | `auth.py` (24 endpoints); web `/login` `/register` `/forgot-password`; mobile `(auth)` group = 20 screens |
| A2 | MFA (TOTP) with QR enrolment + recovery codes | P0 | — | ✓ | ✓ | ✓ | ✅ Built | `auth.py /mfa*`, `/recover-codes`, `mfa_service.py`; web Account→Security `MfaCard.tsx`; mobile `(auth)/mfa*` |
| A3 | Magic-link passwordless login | P1 | — | ✓ | ✓ | ✓ | ✅ Built | `/magic-link/request` + `/magic-link/verify`; web `/magic-link`; mobile `(auth)/magic-link` |
| A4 | Session inventory and revocation (self + admin) | P0 | — | ✓ | ✓ | — | ✅ Built | `/sessions`, `/admin/sessions`, revoke; web `SettingsView.tsx` section `sessions` |
| A5 | Multi-org membership and org switcher | P1 | — | ✓ | — | — | ⚠️ Partial | `/my-organizations`, `/switch-org` exist; **no switcher UI** — web and mobile only ask for an org code at login |
| A6 | Member self-signup: org code → verify → password → plan → pay | P0 | — | ✓ | — | ✓ | ✅ Built | `memberships.py signup/*`; mobile `(auth)/join/{pick-plan,verify-email,set-password,pay}`; no web equivalent |
| A7 | Invite-only redemption (single-use code bound to email) | P1 | — | ✓ | ✓ | ✓ | ✅ Built | `POST /members/invite`, `/memberships/invite/redeem`; web `/redeem`; mobile `(auth)/redeem` |
| A8 | Approved-enrollment approval queue (prospect review) | P1 | — | ✓ | ✓ | ✓ | ✅ Built | `GET /members/approval-queue`, `POST /{id}/approval`; web `/approvals`; mobile `(admin)/approvals` |
| A9 | Notification centre (bell, unread count, mark read) | P1 | — | ✓ | — | ✓ | ✅ Built | `notifications.py` (4 endpoints); mobile `notification-bell.tsx` + `realtime.ts`; **no web bell** |
| A10 | Real-time sync over WebSocket (ticketed) | P1 | — | ✓ | ✓ | ✓ | ✅ Built | `routes/ws.py /ws`, `frontend/app/api/ws-ticket`; web live attendance; mobile `lib/realtime.ts` |
| A11 | Gym registration wizard + setup checklist | P0 | — | ✓ | ✓ | ✓ | ✅ Built | `/organizations/register`, `/me/checklist`; web `/create-gym`; mobile `(auth)/register/step-1..3`, `tier`, `payment` |
| A12 | Stripe Connect onboarding and connect status | P0 | — | ✓ | ✓ | ✓ | ✅ Built | `/me/connect`, `/me/connect/complete`; web `SettingsView` payments; mobile `gym-settings/stripe.tsx` |
| A13 | Org code rotation, enrollment mode, gym open/closed status | P0 | — | ✓ | ✓ | ✓ | ✅ Built | `/me/rotate-code`, `/me/enrollment`, `/me/gym-status`; mobile `gym-settings/rotate-code`, `(admin)/gym-status` |
| A14 | SaaS subscription: tier upgrade/downgrade/cancel, invoices, PDF | P0 | — | ✓ | ✓ | — | ✅ Built | `saas_billing.py` (6 endpoints); web `/billing` with tier switcher |
| A15 | Space / resource booking (rooms and slots, capacity) | P1 | — | ✓ | ✓ | ✓ | ✅ Built | `space.py` (8 endpoints); web `/space`; mobile `(member)/space` |
| A16 | Multi-industry verticals (gym / office / academy) + offer schema | P1 | — | ✓ | ✓ | ✓ | ⚠️ Partial | Industry catalog, offer schemas, registration pickers, and industry-aware screens exist for three hard-coded verticals. No installable pack builder or other vertical packs |
| A17 | Idempotency framework (key claim, hash check, stuck reconciliation) | P0 | — | ✓ | — | — | ✅ Built | `idempotency_service.py` (claim/complete/fail, 106 lines); used by payments, classes, invoices, memberships, assistant |
| A18 | Email + push transports (transactional delivery) | P0 | — | ✓ | — | — | ⚠️ Partial | `integrations/email.py`, `push.py`; **no SMS/WhatsApp/LINE/Telegram transport exists** — see PDF rows 19/38/100 |

---

## Notes on the four 🔧 Improvement rows

| Row | Feature | What works | What to improve |
|---|---|---|---|
| 22 | Offline mode with sync | Idempotent offline-queued **check-in** flush (`POST /attendance/sync`) + offline roster | Generalise to visits, payments and bookings — the blueprint means the whole app offline |
| 62 | Daily owner brief | `POST /assistant/briefing` → `workflows.weekly_briefing` | Runs **weekly**, not daily, and lands **in-app only** instead of the owner's preferred channel |
| 65 | Ask-anything analytics | LangGraph graph, 40 specialists, streaming, write actions | Needs `GROQ_API_KEY` in production — without it every answer is the `[offline stub]` |
| 125 | People timeline | Member sheet shows visits + payments | No unified message/visit/payment timeline on one scroll |

---

## Where the biggest holes are

1. **Sales & leads (rows 1–8)** — lead profiles are built and manual intake is partial; the remaining 6 of 8 features are not built. No channel integrations, trials, automated replies, or follow-up sequences.
2. **Evidence Vault (rows 109–118)** — 9 of 10 not built: no hash chain, no soft delete, no evidence packs, no WORM.
3. **Compliance & legal (rows 67–73)** — 6 of 7 not built: no waivers, consent, data-subject requests or cooling-off.
4. **Localisation (§6, rows 99–108)** — 7 of 10 not built: no i18n/RTL, no local payment rails, no privacy-law packs.
5. **Retention UI (rows 31–37)** — backend workflows and workers exist, but the feature-specific owner/member screens are missing.

---

*Authoritative inventory: 128 PDF-derived items plus 18 code-only capabilities. Status counts are row-level and use the definitions above. The Notion page remains unverified.*
