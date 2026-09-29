# Globalization Blueprint — one engine, every country

> **Status: DESIGN DOCUMENT ONLY — nothing here is implemented.**
> This generalizes the *AI-Native Gym CRM Product Blueprint V2* (which was written for Pakistan) into a country-agnostic product. The rule is simple:
>
> **A country is configuration, not code.** No payment rail, language, currency, tax rule, ID document, calendar, or messaging channel may be hardcoded. A new market ships as a **Country Pack** + provider adapters — never a fork.
>
> The engine is already two-dimensional — **Vertical Pack** (gym · academy · office · clinic · salon · real estate · sales) × **Country Pack** (locale, money, compliance, providers). This document specifies the second axis. It builds on `docs/architecture/multi-industry.md`; the same "declarative registry + adapters" pattern is reused.
>
> **Pakistan is the beachhead, not the product.** Lahore is where the engine is proven; every construct below must already be provider-neutral so market #2 is configuration.

---

## 0. Seams in the current codebase (country assumptions to remove)

| Concern | Where | Country assumption to generalize |
|---|---|---|
| Currency | `Organization.default_currency`, `memberships_service` amounts | Free-text ISO code today; needs **price books** per country + minor-unit integers (§2) |
| Money storage | `payments.amount` is `float` | Must become integer **minor units** + currency before multi-currency (floats lose cents on FX/rounding) |
| Member payments | `stripe_service` + **Stripe Connect Standard** (ADR-002) | Provider-agnostic `PaymentProvider` registry; Stripe is one adapter, not the rail (§3) |
| SaaS billing | Platform Stripe subscription | Local rails + local tax; app-store / local card support (§3, §10) |
| Messaging | WhatsApp assumed as sole channel in the PDF | `ChannelProvider` registry; WhatsApp has **uneven country availability and pricing** (§4) |
| Receipts / OCR | `ai_receipt` pipeline, `payments.method=card\|cash\|bank_transfer\|mobile_wallet` | Method enum is rail-specific; generalize to `method=provider_id` + `instrument` (§3) |
| AI voice/text | Roman-Urdu examples in PDF | Per-locale language packs, transcription + transliteration (§13) |
| Tax / invoices | Office B2B invoicing in `multi-industry.md` | Country tax profiles + e-invoicing regimes (§5) |
| ID document | CNIC (PDF, `multi-industry.md` companies.tax_id) | `NationalId` registry per country; KYC provider (§9) |
| Phone | assumed PK formats | **E.164** everywhere + per-country validation/display (§1) |
| Calendar / culture | Ramadan, ladies timings baked into examples | Regional calendar registry + configurable session attributes (§8) |
| Compliance | PK draft DP bill cited | Compliance profiles per country; data residency regions (§6, §7) |

---

## 1. Locale layer

A `Locale` is the unit of language + formatting. One country may have many; one language spans many countries (`en`, `es`, `ar`, `fr`, `hi`, `pt-BR`, `ur`, `sw`, …).

```ts
interface Locale {
  code: string;              // BCP-47: en-US, es-MX, pt-BR, ar-SA, ur-PK
  language: string;          // ISO 639-1
  script: "latin" | "arabic" | "devanagari" | "han" | …;
  direction: "ltr" | "rtl";
  fallback: string;          // e.g. "en"
  dateFormat: string;        // ICU
  numberFormat: string;      // ICU
  firstDayOfWeek: 0 | 1 | 6;
}
```

- **RTL is a first-class layout** (`direction: rtl`): the web shell, sidebar, and mobile must mirror via logical CSS properties (`ms-*`/`me-*`, `start`/`end`), not hardcoded left/right. Retrofitting RTL later is expensive.
- **Phone**: store E.164; validate/display via a per-country rule pack (libphonenumber data), never regex-by-country in code.
- **Names/addresses**: configurable name order (given/family first), address format and required fields per country.
- **Pluralization & gender**: ICU MessageFormat for message templates; some languages need gender agreement.
- **Fonts**: script-capable font stack per script (Arabic/Devanagari/Han fallbacks), not just Latin.

---

## 2. Currency & money (global-first)

- **Integer minor units, always.** `amount_minor: int` + `currency: ISO-4217`. `1000` = `10.00`. No floats for money. (Current `float` columns are a latent correctness bug — fix before any FX.)
- **Currency registry**: ISO-4217 code, `minor_units` (2, or 0 for JPY/KRW, 3 for KWD/BHD/TND), symbol, placement, rounding rules.
- **Price books**: a plan/offer carries **per-country price entries** (price + currency + tax-inclusive flag), not one global number. Purchasing-power tiers are config, not code.
- **FX**: only when a price book entry is missing; store both charged amount and base-currency amount + the FX rate used, for accounting. Display currency may differ from settlement currency.
- **Tax-inclusive display**: US shows tax added at checkout; EU/UK/AU/IN show tax-inclusive prices. This is a `Country Pack` display rule (§5, §12).
- **Formatting**: ICU per locale (`₹1,00,000` vs `$100,000` vs `100.000,00 €`).

---

## 3. Payments — provider registry

No rail is baked in. Each org's country picks an ordered list of **enabled `PaymentProvider`s**; the checkout UI renders what the country supports.

```ts
interface PaymentProvider {
  id: string;                    // "stripe", "adyen", "razorpay", "mpesa", …
  countries: string[] | "*";
  currencies: string[] | "*";
  capabilities: {
    card: boolean; applePay: boolean; googlePay: boolean;
    bankTransfer: boolean; ach: boolean; sepa: boolean; openBanking: boolean;
    wallets: string[];           // ["jazzcash","easypaisa","mPesa","gcash","oxxo"]
    recurring: boolean; refunds: boolean; partialCapture: boolean;
    payer: "connect" | "platform" | "merchant_of_record";
  };
  onboarding: "connect_standard" | "connect_express" | "oauth" | "api_keys";
}
```

| Market | Typical adapters (illustrative, config not commitment) |
|---|---|
| Global card | Stripe, Adyen, Checkout.com |
| EU / UK | Stripe, Adyen, **SEPA Direct Debit**, iDEAL, Bancontact, SEPA via GoCardless |
| India | Razorpay, Cashfree, UPI, NetBanking |
| Pakistan | JazzCash, EasyPaisa, Raast, local card acquirers |
| Africa | M-Pesa, Paystack, Flutterwave, Airtel Money |
| LATAM | Mercado Pago, dLocal, OXXO, PIX (Brazil) |
| SEA | GCash, Xendit, Midtrans |
| US | Stripe, ACH (Plaid/Stripe), ACH debit |

Design rules:
- **Member fees never route through the platform** (ADR-002 spirit) — the adapter honors `capabilities.payer`. Stripe Connect Standard is simply the global-card adapter's onboarding mode.
- **Payment methods are data**, not an enum in code: `payment_records` store `provider_id`, `instrument` (`card|bank|wallet|cash|invoice|online`), `provider_ref`, `idempotency_key`.
- **Idempotency** stays exactly as specified (blueprint §2, ADR-003): the UUID is passed to the provider where supported, and server-side reconciliation covers the rest.
- **Offline/cash** is a universal first-class method with the AI-screenshot/receipt verification pipeline (blueprint §4) — not PK-only. Cash-heavy markets (PK, NG, ID, PH, Egypt, Latin America) all use it.
- **Payouts/SaaS**: platform subscription billing also picks a local-capable processor + local tax; app-store (Apple/Google) billing is an adapter for consumer markets.

---

## 4. Messaging — channel registry (WhatsApp is not universal)

The PDF assumes WhatsApp, but availability, pricing, and template rules differ by country, and some markets are SMS- or LINE/Telegram-first. Channels are a registry:

```ts
interface ChannelProvider {
  id: string;                 // "whatsapp_cloud", "twilio_sms", "line", "telegram", "rcs", …
  countries: string[] | "*";
  cap: { inbound: boolean; outbound: boolean; templates: boolean; rich: boolean; voice: boolean };
  pricing: { unit: "message" | "conversation"; inboundFree?: number; currency: string };
  requiresOptIn: boolean;
}
```

- **Channel-agnostic message API**: agents draft a *message*, and the delivery layer picks the member's reachable channel (WhatsApp → SMS → email → push), respecting opt-in and 24-hour windows.
- **Capability matrix per country** (e.g. WhatsApp Cloud API availability + template categories + per-message pricing; SMS sender-ID rules; RCS availability) lives in the Country Pack, so cost meters and "will this broadcast work?" checks are data-driven.
- **Email** (Resend/SES) works everywhere; **push** (Expo/FCM/APNs) everywhere; **in-app inbox** is the fallback of record.
- **Voice notes** (a PK/SA/LATAM habit) are handled by channel + locale transcription (§13), not assumed.
- **Consent/opt-out** is universal and stored per channel, per member (blueprint §1.14).

---

## 5. Tax & invoicing

Different countries, different rules. A `TaxProfile` per Country Pack:

- **Tax type**: VAT (EU/UK/GCC), GST (IN/AU/SG/CA), Sales tax (US, state-level), consumption tax (JP). Inclusive vs exclusive display.
- **Rates**: configurable per country/region, with effective dates.
- **B2B / B2C**: reverse charge (EU cross-border), tax IDs (VAT/GSTIN/ABN/EIN), tax-exempt handling.
- **E-invoicing regimes** (mandatory in many countries): Italy SDI, India GST e-invoice/IRP, Brazil NF-e, Saudi ZATCA, Mexico CFDI, EU ViDA. Model as an `EInvoiceProvider` adapter — cleartax/avalara/stripe-tax style, or direct.
- **Invoice numbering**: sequential per org per country, prefix/suffix rules.
- **Receipts**: legal receipt fields per country (business name, tax ID, address, tax breakdown).

---

## 6. Compliance & data residency

A `ComplianceProfile` per Country Pack. At minimum:

- **Privacy regimes**: GDPR/UK-GDPR, ePrivacy; CCPA/CPRA (US-CA) + state laws; PIPEDA/Quebec Law 25 (CA); LGPD (BR); POPIA (ZA); DPDP Act (IN); PDPA (SG, TH, MY); APPI (JP); PIPL (CN); PDPA (AE); draft PK bill.
- **Lawful basis & consent**: marketing consent is opt-in in EU/UK/CA/BR etc.; channel opt-in tracked per member.
- **Data-subject rights**: access, correction, erasure, portability, restriction — with statutory SLAs (e.g. 30 days GDPR, 72-hour breach notice).
- **Data residency**: choose a **region** at org creation (EU, US, IN, AU, …); all data + backups stay in-region. Postgres per region / row-level region tag + regional object storage.
- **Processors & transfers**: DPAs, SCCs for cross-border; sub-processor list; PII masking in LLM prompts (blueprint §6.3) with a **no-retention LLM endpoint** or in-region model.
- **Breach response**: audit-log-backed evidence, notification workflow, 72-hour clock where required.
- **Age/health data**: health notes are special-category data under GDPR Art. 9; stricter handling + explicit consent; clinics need even more (§ multi-domain).

---

## 7. Evidence Vault vs. the right to erasure (global)

The Evidence Vault (blueprint §7) is a selling point but collides with GDPR Art. 17 and similar. Global-consistent design:

- **Two deletion paths** (already proposed for PK, make it universal):
  1. **Business delete** → soft delete + Recycle Bin + Evidence Pack + hash-chained audit. Retention per data type.
  2. **Data-subject erasure** → owner-approved path that **anonymizes PII** (name/phone/national-ID/health) and keeps a **hash-only stub** so the tamper-evident chain still verifies. This satisfies erasure without destroying the audit chain.
- **Legal hold** overrides erasure where tax/accounting law requires retention (invoices typically 6–10 years; country-configurable).
- **Per-country retention matrix** in the Country Pack; owner-configurable within legal bounds.
- **Consent log** universal; export ("Download Evidence" / DSAR export) machine-readable.
- **Data residency** (§6) applies to Evidence Packs and WORM storage (S3 Object Lock in the org's region).

---

## 8. Time, calendar & culture

- **Timezones**: store UTC; render in org tz and member tz; schedule in org tz.
- **Week start / fiscal year**: per Country Pack (Sun/Mon/Sat; fiscal year varies — e.g. Apr–Mar in IN/UK-gov, Jul–Jun in AU, calendar in US).
- **Regional calendars**: Ramadan/Eid, Diwali, Lunar New Year, Easter, summer — configurable operating-hours and campaign calendars. The PDF's "Ramadan/summer schedule" is one instance of a general **Season** model.
- **Units**: metric/imperial toggle (distances, weights, temperatures) per country.
- **Configurable session attributes**: "ladies timings" is one value of a generic `session_audience`/`attribute` system (gender-segregated, age group, skill level), enabling equivalent features everywhere.
- **Currency/date/holiday formatting** come from locale (§1).

---

## 9. Identity, documents & KYC

- **National ID registry**: CNIC (PK), Aadhaar/PAN (IN), SSN/EIN (US), NINO (UK), CPF/CNPJ (BR), Emirates ID (AE), etc. — validation + masking per country.
- **KYC/KYB**: provider-agnostic adapter (Stripe Identity, Persona, Onfido, Sumsub) for owner/business verification; required by the payment adapter.
- **Documents**: waiver/PAR-Q (fitness) vs intake forms (clinic) vs enrolment agreement (academy) — template + e-signature provider adapter, with country legal wording.
- **Business registry verification** (for office/B2B): VAT/Tax ID validation per country.

---

## 10. Pricing & packaging (global)

- **Price books** per currency/market (§2), not a single USD number.
- **Tax-inclusive vs exclusive** display per country (§5).
- **Outcome-based pricing** (blueprint §5.2) localized to the market's norm.
- **App-store billing** for consumer markets (Apple/Google) as a payment adapter — mandatory on mobile in many stores.
- **No per-seat pricing** stays a global positioning choice (blueprint §8.6), but currency and tax are local.

---

## 11. Country Pack — schema

One pack per country; versioned config, no code branches.

```ts
interface CountryPack {
  code: string;                 // ISO 3166-1 alpha-2: PK, US, GB, IN, AE …
  name: string;
  region: "eu" | "us" | "uk" | "apac" | "mena" | "latam" | "africa";   // data residency
  defaultLocale: string;
  locales: string[];
  currencies: string[];
  defaultCurrency: string;
  tax: TaxProfile;
  eInvoice?: EInvoiceProviderId;
  paymentProviders: string[];   // ordered preference
  channelProviders: string[];   // ordered preference
  identity: { nationalId: string; kyc: string[] };
  compliance: ComplianceProfile;
  retention: Record<DataType, number>; // days
  calendar: { weekStart: 0|1|6; fiscalYearStart: number; seasons: string[] };
  units: "metric" | "imperial";
  priceBook: string;            // price-book id
  legal: { terms: string; privacy: string; waiverTemplates: string[] };
}
```

`organizations` gains `country_code` (+ optional `locale`, `data_region`), set at registration; drives currency, tax, providers, formatting, retention, and the registration checklist.

---

## 12. Provider adapter interfaces (the shared contract)

Every external system is an adapter behind a stable internal interface, so the core never imports a vendor SDK directly:

- `PaymentProvider` — `createCharge`, `refund`, `onboardPayout`, `capabilities` (§3)
- `ChannelProvider` — `send`, `receiveWebhook`, `capabilities`, `pricing` (§4)
- `TaxProvider` / `EInvoiceProvider` — `calculate`, `issueInvoice`, `report` (§5)
- `IdentityProvider` — `startKyc`, `verifyBusiness` (§9)
- `LLMProvider` — `extract`, `draft`, `answer`; region-pinned, no-retention option (§6, §13)

The multi-industry doc already uses this pattern for the **Vertical Pack**; Country Packs add no new architecture — they populate the same registries.

---

## 13. AI localization

- **Language packs**: the AI must extract and draft in the member's language (Urdu/Roman Urdu today; Arabic, Spanish, Portuguese, Hindi, Indonesian, Swahili, French next). Romanized input (Roman Urdu, Hinglish, Arabizi) is a general "transliteration" concern.
- **Voice notes**: per-locale STT (Whisper-class multi-language) + language auto-detect; store transcript + confidence in the event ledger.
- **Gym/market voice**: the AI learns tone per org and per **language**, not per country; formal/informal register varies by locale.
- **PII masking** before prompts (universal); **no-retention** LLM endpoints for GDPR markets; in-region inference where residency demands.
- **Evaluation**: per-language quality gates (answer accuracy, extraction F1) before a locale goes live.

---

## 14. Rollout path

| Stage | Markets | Goal | Signal to advance |
|---|---|---|---|
| A | **Lahore, PK** (beachhead) | Prove engine + ROI | Paying gyms renewing; a clear "PKR recovered" story |
| B | Same-language / similar (e.g. GCC English/Urdu, India) | Reuse engine with new Country Packs | Pack setup days, not months; payments + messaging work end-to-end |
| C | UK/EU, US, AU | Global card rails + full tax/e-invoicing + GDPR residency | Local compliance passes; no code fork ships for a new country |
| D | LATAM, SEA, Africa | Local wallets (PIX, GCash, M-Pesa) + local languages | Country Pack + adapters only; pack builder/partner-led |

**Country readiness checklist** (before "supported"): locale + RTL tested; price book + tax display; ≥1 payment adapter live; ≥1 messaging channel live; consent + erasure path; residency region; legal docs localized; AI language QA passed.

---

## 15. Impact on existing code (summary)

- `payments.amount` float → `amount_minor: int` + `currency`; migrate with a deliberate rounding policy.
- `PaymentMethod` enum → `provider_id` + `instrument` (keep legacy values mapped).
- `stripe_service` → `services/payments/` registry with a `stripe` adapter; other adapters added per Country Pack.
- New `country_packs` config (json, versioned) + `organizations.country_code`/`locale`/`data_region`.
- `format.ts` (web) and mobile formatters become locale-driven (Intl) instead of hardcoded.
- Sidebar/nav unaffected (§ multi-industry registry already drives it).
- AI receipt/OCR, idempotency, Evidence Vault, audit — already provider-neutral; only the *method vocabulary* changes.

---

## 16. Risks & open decisions

1. **Money type migration** — floats → minor-unit integers touches every payment path; do it once, before multi-currency. Highest-priority prerequisite.
2. **WhatsApp coverage/cost variability** — the channel registry must ship with accurate per-country pricing, or cost meters lie.
3. **Data residency strategy** — single-region-plus-tag vs region-per-deployment; decide before EU/US launch (affects backups, WORM, LLM routing).
4. **E-invoicing scope** — deadlines are legal, not product-driven; treat as a launch blocker per country.
5. **LLM data handling** — EU/health-data markets may require no-retention or in-region inference; verify per provider.
6. **Currency of record for analytics** — pick a base currency and record FX at charge time so "revenue" and "wins" stay honest across countries.
7. **Regulatory review per market** — fitness/health data + biometric check-in (if used) adds local rules (biometric privacy laws in IL, US-IL/TX, EU).
