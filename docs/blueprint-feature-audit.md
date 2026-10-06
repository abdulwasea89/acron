# Blueprint vs Codebase — Feature Audit

**Source:** `AI-Native CRM · Global Product Blueprint _V3.pdf`
**Codebase:** `acron` — `backend/app` (FastAPI), `frontend` (Next.js), `mobileapp` (Expo)
**Scope:** Gym-first. Sections 1.1–1.13 are authored for gyms; Section 9 (multi-domain) is partially present as `academy` / `office` industry schemas.

**Legend:** ✅ Built · 🟡 Partial · ❌ Not built

| # | Department | Feature | Priority | Status | Evidence / Gap |
|---|---|---|---|---|---|
| 1 | Sales & Leads | Lead capture (WhatsApp/SMS/IG/FB/LINE/WeChat/forms/calls/walk-ins) | P0 | ❌ Not built | No channel integrations; no `Lead` model |
| 2 | Sales & Leads | Lead profile: goal, budget, preferred times | P0 | ❌ Not built | — |
| 3 | Sales & Leads | Pipeline: New → Contacted → Trial → Visited → Joined/Lost | P0 | ❌ Not built | No pipeline entity |
| 4 | Sales & Leads | Instant first reply 24/7 | P0 | ❌ Not built | — |
| 5 | Sales & Leads | Trial and tour booking | P0 | ❌ Not built | Only class booking exists |
| 6 | Sales & Leads | Follow-up sequences (day 0, 1, 3, 7) | P0 | ❌ Not built | — |
| 7 | Sales & Leads | Lost-reason tracking and lead scoring | P1 | ❌ Not built | — |
| 8 | Sales & Leads | Speed-to-lead reporting; missed-call text-back | P1 | ❌ Not built | — |
| 9 | Sales & Leads | Corporate and group memberships | P1–P2 | 🟡 Partial | `Company`, `CompanyContract`, seat-holders |
| 10 | Sales & Leads | Referral tracking | P1–P2 | ❌ Not built | — |
| 11 | Membership | Member profile: photo, ID, contact, emergency, goals, health | P0 | 🟡 Partial | `OrganizationMember`; no goals/health/ID |
| 12 | Membership | Plans: daily→yearly, family, student, off-peak, packs, credits | P0 | 🟡 Partial | `MembershipPlan`; only `recurring`/`one_time_pack`/`drop_in` |
| 13 | Membership | Joining fees, discounts, promo codes | P0 | 🟡 Partial | price/tax only; no promo-code engine |
| 14 | Membership | Freeze/pause (travel, illness, seasonal) | P0 | 🟡 Partial | `frozen` status + plan pause; no request/approve flow |
| 15 | Membership | Renewals and expiry reminders | P0 | 🟡 Partial | expiry/grace status; no reminder cadence engine |
| 16 | Membership | Upgrades, downgrades, transfers, cancellation w/ save offer | P1 | 🟡 Partial | status change + SaaS upgrade; no save offers |
| 17 | Membership | Family/multi-payer accounts; segmentation and tags | P1–P2 | ❌ Not built | — |
| 18 | Front Desk | Member check-in by QR, card/RFID, app, biometric, manual | P0 | ❌ Not built | **No member attendance/visit model** |
| 19 | Front Desk | Status on check-in (expired, dues, birthday, at-risk) | P0 | ❌ Not built | — |
| 20 | Front Desk | Shared team inbox for all channels | P0 | ❌ Not built | Chat = AI assistant threads, not member inbox |
| 21 | Front Desk | Staff "Today" task list | P0 | ✅ Built | `Task` model, `/tasks`, web + mobile |
| 22 | Front Desk | Walk-ins, day passes, guest log, lockers | P1–P2 | ❌ Not built | — |
| 23 | Front Desk | Offline mode with sync | P1 | ❌ Not built | — |
| 24 | Finance | Local payment methods per country | P0 | 🟡 Partial | Stripe Connect + cash/wallet/transfer; no Pix/UPI/M-Pesa |
| 25 | Finance | Recurring billing: cards, direct debit, mandates | P0 | 🟡 Partial | SaaS retries + member subs; no card-updater |
| 26 | Finance | Failed-payment and overdue recovery (dunning) | P0 | 🟡 Partial | SaaS grace→read-only; no member dunning ladder |
| 27 | Finance | Cash and manual payments with digital receipts | P0 | ✅ Built | `Payment`, `CashReconciliation`, receipt PDF |
| 28 | Finance | Payment-proof verification (bank/wallet screenshots) | P1 | ✅ Built | `ReceiptUpload`, AI OCR pipeline, workers |
| 29 | Finance | Invoices with local tax (VAT, GST, sales tax) | P1 | ✅ Built | `Invoice.tax_amount`, `TaxMode`, PDF |
| 30 | Finance | Expenses, P&L, revenue by plan/branch/trainer | P1 | 🟡 Partial | revenue by plan/method; no expenses/P&L/branch |
| 31 | Finance | Refunds, credits, chargeback evidence, accounting export | P1 | 🟡 Partial | refunds + receipt reverse + audit; no export |
| 32 | Retention | 90-day onboarding journey | P0 | ❌ Not built | — |
| 33 | Retention | Attendance-drop detection vs own baseline | P0 | ❌ Not built | No attendance data |
| 34 | Retention | Churn-risk score with reasons | P0 | 🟡 Partial | `member_churn` specialist; no scored model |
| 35 | Retention | Inactivity ladder (5 / 10 / 14–21 days) | P0 | ❌ Not built | — |
| 36 | Retention | Win-back campaigns; milestones; birthdays | P1 | ❌ Not built | — |
| 37 | Retention | NPS at day 7/30/90; complaint clustering | P1 | ✅ Built | `NpsSurvey`, day-7/30/90 daily sweep, member + admin `/nps` API, keyword complaint clustering |
| 38 | Retention | Challenges, streaks, leaderboards | P2 | ✅ Built | `GymChallenge` + `MemberChallengeProgress` + `MemberStreak`, daily `retention.gamification` sweep (start 08:10 UTC), member `/challenges/me` + `/leaderboard`, admin `/challenges` create/status/detail |
| 39 | Marketing | Segmented campaigns by channel | P1 | ✅ Built | <API:POST /api/v1/campaigns> |
| 40 | Marketing | Seasonal offers (New Year, Ramadan, Diwali…) | P1 | ❌ Not built | — |
| 41 | Marketing | Referral programme; review requests | P1 | ❌ Not built | — |
| 42 | Marketing | Lead-ad integrations (Meta, Google, TikTok) | P1 | ❌ Not built | — |
| 43 | Marketing | Campaign ROI: leads → trials → members → revenue | P1 | ❌ Not built | — |
| 44 | Marketing | Landing pages; content ideas | P2 | ❌ Not built | — |
| 45 | Trainers | Trainer profiles, schedules, availability | P1 | 🟡 Partial | `MemberTrainer` assignment; no availability |
| 46 | Trainers | PT package sales and session tracking | P1 | ❌ Not built | — |
| 47 | Trainers | Trainer–client matching | P1 | ❌ Not built | — |
| 48 | Trainers | Workout and diet plans; progress tracking | P2 | ❌ Not built | — |
| 49 | Trainers | Trainer performance by client retention | P1 | 🟡 Partial | payroll specialists + commissions |
| 50 | Classes | Timetable, booking | P1 | ✅ Built | `ClassSession`, `ClassBooking`, member booking |
| 51 | Classes | Capacity, waitlist | P1 | ❌ Not built | — |
| 52 | Classes | No-show tracking and reminders | P1 | 🟡 Partial | check-in exists; no no-show/reminders |
| 53 | Classes | Utilisation analytics; instructor substitution | P2 | 🟡 Partial | `ops_class_fill`, `ops_class_demand` |
| 54 | HR & Payroll | Roles and permissions (owner/manager/front desk/trainer) | P0 | ✅ Built | Owner/Manager/Trainer/Front Desk/Member RBAC |
| 55 | HR & Payroll | Activity and audit log | P0 | ✅ Built | `AuditLog`, `/audit`, `/audit/actions` |
| 56 | HR & Payroll | Shifts, attendance, salaries, commissions, per-session pay | P1 | ✅ Built | `Shift`, payroll engine, `MemberTrainer`, commissions |
| 57 | HR & Payroll | Staff performance: response time, conversions, collections | P1 | ❌ Not built | No messaging → no response times |
| 58 | POS & Access | POS for supplements, merchandise, day passes | P1 | ❌ Not built | — |
| 59 | POS & Access | Inventory and low-stock alerts | P2 | ❌ Not built | — |
| 60 | POS & Access | Door and turnstile access tied to membership | P2 | ❌ Not built | — |
| 61 | POS & Access | Equipment register and maintenance | P2 | ❌ Not built | — |
| 62 | POS & Access | Peak-hour tracking; safety checklists | P2 | 🟡 Partial | `ops_peak_hours` only |
| 63 | Analytics | "Today" command centre | P0 | 🟡 Partial | dashboard + `/analytics/headline`; not a ranked action list |
| 64 | Analytics | Daily owner brief on preferred channel | P0 | ❌ Not built | `/assistant/briefing` is in-app only |
| 65 | Analytics | KPIs: active members, joins, churn, MRR, collections | P0 | 🟡 Partial | `analytics_service`, revenue analytics |
| 66 | Analytics | Revenue-at-risk panel | P0 | 🟡 Partial | risk specialists |
| 67 | Analytics | Wins feed (money recovered) | P0 | ❌ Not built | — |
| 68 | Analytics | Ask-anything analytics | P1 | ✅ Built | `/assistant`, LangGraph agent, 40 specialists |
| 69 | Analytics | Multi-branch, multi-currency, franchise royalties | P1–P2 | ❌ Not built | single org; `currency` field only |
| 70 | Compliance | Waivers, health forms (PAR-Q), contracts, e-signature | P1 | ❌ Not built | — |
| 71 | Compliance | Consent management per channel/purpose | P0 | ❌ Not built | — |
| 72 | Compliance | Data-subject requests: access, export, correction, erasure | P0 | ❌ Not built | — |
| 73 | Compliance | Auto-renewal disclosures, cooling-off, online cancellation | P0 | ❌ Not built | — |
| 74 | Compliance | Role-based access to sensitive data | P0 | 🟡 Partial | RBAC exists; no field-level sensitivity |
| 75 | Compliance | Evidence Vault | P0 | 🟡 Partial | `AuditLog` only; no versioning/vault |
| 76 | Compliance | Data residency options | P1 | ❌ Not built | — |
| 77 | Member XP | Messaging-first self-service: renew, pay, freeze, book | P0 | ❌ Not built | App self-service only, no messaging |
| 78 | Member XP | Web portal / PWA: card, QR, dues, history | P1 | 🟡 Partial | mobile member app; no card/QR |
| 79 | Member XP | Branded app, workout log, streaks, rewards | P2 | 🟡 Partial | Expo app exists; no streaks/rewards |
| 80 | Member XP | Import from spreadsheets and competitor exports | P0 | ✅ Built | `/members/import` bulk CSV |
| 81 | Member XP | Multilingual UI, RTL, local date/number formats | P0 | ❌ Not built | — |
| 82 | Member XP | Public API and webhooks; usage and cost meter | P1–P2 | 🟡 Partial | Stripe webhooks only; no public API/meter |
| 83 | AI Architecture | Event ledger (append-only, per person) | — | ❌ Not built | Only `AuditLog` + chat messages |
| 84 | AI Architecture | Understanding (LLM extraction from messages) | — | 🟡 Partial | LLM in assistant; no inbound-message extraction |
| 85 | AI Architecture | Customer world model | — | 🟡 Partial | structured analytics; no per-member summary/history |
| 86 | AI Architecture | Signal engine (rules + ML risk) | — | 🟡 Partial | deterministic specialists; no ML |
| 87 | AI Architecture | Decision layer (next-best-action, value, owner) | — | 🟡 Partial | assistant proposes writes; no ranked engine |
| 88 | AI Architecture | Action layer (auto-send, approve, task, call) | — | 🟡 Partial | write tools w/ approval interrupt; no send/call |
| 89 | AI Architecture | Outcome loop / Wins | — | ❌ Not built | — |
| 90 | AI Architecture | Autonomy L0–L3 + fail-closed | — | 🟡 Partial | per-action confirm; no levels/dial |
| 91 | AI Architecture | Lead Concierge agent | — | ❌ Not built | — |
| 92 | AI Architecture | Renewal & Collections agent | — | ❌ Not built | — |
| 93 | AI Architecture | Retention Coach agent | — | ❌ Not built | — |
| 94 | AI Architecture | Front-Desk Copilot agent | — | ❌ Not built | — |
| 95 | AI Architecture | Owner Analyst agent | — | 🟡 Partial | assistant + 40 analytics specialists |
| 96 | AI Architecture | Reputation Agent | — | ❌ Not built | — |
| 97 | AI Architecture | Compliance Guard agent | — | ❌ Not built | — |
| 98 | AI Architecture | AI-disclosure setting | — | ❌ Not built | — |
| 99 | Localisation | Country Packs | — | ❌ Not built | — |
| 100 | Localisation | Messaging channels per region | — | ❌ Not built | — |
| 101 | Localisation | Local payments | — | 🟡 Partial | Stripe + cash; no regional rails |
| 102 | Localisation | Privacy-law rule packs | — | ❌ Not built | — |
| 103 | Localisation | Membership and messaging rules | — | ❌ Not built | — |
| 104 | Localisation | Languages, RTL, culture | — | ❌ Not built | — |
| 105 | Localisation | Currency | — | 🟡 Partial | per-org `currency` field |
| 106 | Localisation | Tax (VAT, GST, sales tax) | — | ✅ Built | invoice `tax_mode` / `tax_rate` |
| 107 | Localisation | Purchasing-power / PPP pricing | — | ❌ Not built | — |
| 108 | Localisation | Industry Packs | — | 🟡 Partial | gym/academy/office schemas |
| 109 | Evidence Vault | Append-only ledger / versioning | — | ❌ Not built | — |
| 110 | Evidence Vault | Soft delete + Recycle Bin | — | ❌ Not built | Hard deletes only |
| 111 | Evidence Vault | Automatic Evidence Packs (PDF + Excel) | — | ❌ Not built | — |
| 112 | Evidence Vault | Tamper-evident audit chain | — | ❌ Not built | — |
| 113 | Evidence Vault | WORM storage | — | ❌ Not built | — |
| 114 | Evidence Vault | Point-in-time recovery / 3-2-1 backups | — | ❌ Not built | — |
| 115 | Evidence Vault | Owner-held daily exports | — | ❌ Not built | — |
| 116 | Evidence Vault | Access and export log | — | 🟡 Partial | partial via audit |
| 117 | Evidence Vault | Owner alerts (bulk delete / payment edits) | — | ❌ Not built | — |
| 118 | Evidence Vault | Erasure with hash-only stub | — | ❌ Not built | — |
| 119 | Multi-Domain | Generic engine (Person / Event / Payment) | — | 🟡 Partial | industries + shared models |
| 120 | Multi-Domain | Sales-company pack | — | ❌ Not built | — |
| 121 | Multi-Domain | Pack builder / marketplace | — | ❌ Not built | — |
| 122 | UX Screens | Today (ranked list, value at stake, Send/Edit/Skip/Call) | — | 🟡 Partial | dashboard, not ranked actions |
| 123 | UX Screens | Inbox (all channels + AI drafts) | — | ❌ Not built | — |
| 124 | UX Screens | Desk (check-in scanner + status card) | — | ❌ Not built | — |
| 125 | UX Screens | People (unified timeline of messages/visits/payments) | — | 🟡 Partial | member detail only |
| 126 | UX Screens | Money (collections, dues, cash drawer, P&L) | — | 🟡 Partial | payments/cash/analytics |
| 127 | UX Screens | Ask (natural-language Q&A + action buttons) | — | ✅ Built | assistant |
| 128 | UX Screens | Wins (feed of members saved / money recovered) | — | ❌ Not built | — |

## Summary

| Status | Count |
|---|---|
| ✅ Built | 12 |
| 🟡 Partial | 43 |
| ❌ Not built | 73 |
| **Total** | **128** |

## Notes

- The codebase is a **gym operations + billing platform with an AI analytics assistant**, not (yet) the **AI-CRM** described in the blueprint.
- The biggest structural gap: **no member attendance/check-in model**, which the blueprint calls the strongest churn predictor.
- The largest built areas: membership/plans, payments, AI receipt verification, cash reconciliation, invoices/tax, payroll + commissions, classes booking, tasks, RBAC, audit log, bulk import, and the Ask-anything assistant (40 analytics specialists).
- Non-gym domains exist only as **industry schemas** (`gym`, `academy`, `office`), not full Industry Packs.
