// Mobile mirror of the backend Industry registry (backend/app/core/industry.py),
// kept byte-for-byte consistent with the web mirror (frontend/lib/industries.ts).
//
// The registry is the single source of truth for what differs between venue
// verticals: gym (gyms & fitness), office (serviced/coworking space, B2B
// invoicing), academy (education, term tuition paid by guardians). Role VALUES
// never change between verticals — only their labels do — so role→route and
// role→capability logic stays the same and this file drives copy, onboarding
// defaults and (later) tab/screen gating.

export type IndustryKey = "gym" | "office" | "academy";
export type OfferKindKey = "membership" | "space" | "course";
export type MoneyModeKey = "consumer_connect" | "b2b_invoice";
export type ScheduleKindKey = "classes" | "space" | "cohorts";

export type RoleKey = "owner" | "manager" | "trainer" | "front_desk" | "member";

export interface IndustryMeta {
  key: IndustryKey;
  /** Card title in the registration picker. */
  label: string;
  /** One-line tagline under the card title. */
  tagline: string;
  /** How members' money reaches the venue (Connect vs B2B invoice). */
  money: MoneyModeKey;
  /** What an "offer"/plan sells for this vertical. */
  offerKind: OfferKindKey;
  /** The schedule/booking object. */
  schedule: ScheduleKindKey;
  /** Connect onboarding is mandatory to sell to individuals. */
  requiresConnect: boolean;
  /** Org-code prefix fallback when the owner hasn't set one. */
  orgCodeFallbackPrefix: string;
  /** Enabled feature modules — gates future tab/screen visibility. */
  modules: string[];
  /** Per-role display labels for this vertical. */
  rolesLabels: Record<RoleKey, string>;
  /** The countable noun for a paying person ("member" | "seat-holder" | "student"). */
  memberNoun: string;
  /** Who actually pays (the member, or their company/guardian). */
  payerNoun: string;
  /** Short venue noun for onboarding copy ("gym" | "space" | "academy"). */
  shortNoun: string;
  /** Example venue name used as a form placeholder. */
  sampleName: string;
}

const GYM_MODULES = [
  "dashboard", "analytics", "offers", "members", "payments", "cash",
  "receipts", "tasks", "classes", "staff", "audit", "approvals",
  "payroll", "billing", "account", "settings",
];

const OFFICE_MODULES = [
  "dashboard", "analytics", "offers", "companies", "invoices", "space",
  "members", "payments", "cash", "tasks", "staff", "audit", "approvals",
  "payroll", "billing", "account", "settings",
];

const ACADEMY_MODULES = [
  "dashboard", "analytics", "offers", "courses", "attendance",
  "members", "payments", "cash", "receipts", "tasks", "staff", "audit",
  "approvals", "payroll", "billing", "account", "settings",
];

export const INDUSTRIES: Record<IndustryKey, IndustryMeta> = {
  gym: {
    key: "gym",
    label: "Gym & fitness",
    tagline: "Gyms, studios and fitness clubs",
    money: "consumer_connect",
    offerKind: "membership",
    schedule: "classes",
    requiresConnect: true,
    orgCodeFallbackPrefix: "GYM",
    modules: GYM_MODULES,
    rolesLabels: {
      owner: "Owner",
      manager: "Manager",
      trainer: "Trainer",
      front_desk: "Front desk",
      member: "Member",
    },
    memberNoun: "member",
    payerNoun: "member",
    shortNoun: "gym",
    sampleName: "Iron Pulse Boxing",
  },
  office: {
    key: "office",
    label: "Corporate offices",
    tagline: "Serviced offices & coworking space for companies",
    money: "b2b_invoice",
    offerKind: "space",
    schedule: "space",
    requiresConnect: false,
    orgCodeFallbackPrefix: "OFF",
    modules: OFFICE_MODULES,
    rolesLabels: {
      owner: "Owner",
      manager: "Manager",
      trainer: "Space manager",
      front_desk: "Reception / Concierge",
      member: "Seat-holder",
    },
    memberNoun: "seat-holder",
    payerNoun: "company",
    shortNoun: "space",
    sampleName: "Downtown Serviced Offices",
  },
  academy: {
    key: "academy",
    label: "Education academy",
    tagline: "Tutoring centres, skill academies & coaching institutes",
    money: "consumer_connect",
    offerKind: "course",
    schedule: "cohorts",
    requiresConnect: true,
    orgCodeFallbackPrefix: "ACAD",
    modules: ACADEMY_MODULES,
    rolesLabels: {
      owner: "Owner",
      manager: "Manager",
      trainer: "Teacher",
      front_desk: "Registrar",
      member: "Student",
    },
    memberNoun: "student",
    payerNoun: "guardian",
    shortNoun: "academy",
    sampleName: "Bright Minds Academy",
  },
};

/** Ordered catalog — the order registration pickers present the options in. */
export const INDUSTRY_LIST: readonly IndustryMeta[] = [
  INDUSTRIES.gym,
  INDUSTRIES.office,
  INDUSTRIES.academy,
];

const LEGACY_GYM_VALUES = new Set(["gym_fitness"]);

/** Coerce a stored/legacy value into a canonical IndustryKey (default gym). */
export function normalizeIndustryKey(value?: string | null): IndustryKey {
  const v = (value ?? "").trim().toLowerCase();
  if (LEGACY_GYM_VALUES.has(v)) return "gym";
  return v === "office" || v === "academy" ? v : "gym";
}

/** Resolve an IndustryMeta by key; unknown/empty values fall back to gym. */
export function getIndustry(key?: string | null): IndustryMeta {
  return INDUSTRIES[normalizeIndustryKey(key)];
}

/** Pluralize a simple noun ("member" → "members", "company" → "companies"). */
export function pluralize(noun: string): string {
  return /(?:[^aeiou]y|company)$/i.test(noun) && noun.endsWith("y")
    ? noun.slice(0, -1) + "ies"
    : noun + "s";
}

/** Uppercase the first letter ("academy" → "Academy"). */
export function capitalize(word: string): string {
  return word.length ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

/** The role label for a vertical, keyed by backend role value. */
export function roleLabelOf(meta: IndustryMeta, role: RoleKey): string {
  return meta.rolesLabels[role] ?? meta.rolesLabels.member;
}
