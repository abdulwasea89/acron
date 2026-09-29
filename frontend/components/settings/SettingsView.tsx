"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { LiveIndicator } from "@/components/Realtime";
import { Alert, Badge, Button, Input, Select, Spinner } from "@/components/ui";
import { getIndustry } from "@/lib/industries";
import { api, ApiError } from "@/lib/api";
import { fmtDate, gymStatusLabel, statusTone, titleCase } from "@/lib/format";
import type { AdminSessionInfo, HeadlineMetrics, InvoiceSettings, OrganizationOut } from "@/lib/types";

/* Notion-style settings: a left section rail and a right pane of rows, each a
   label + description on the left and a control on the right, separated by
   hairlines. Edits are staged and committed by ONE global Save bar; nothing is
   written until you press it. */

interface Baseline {
  name: string;
  enrollment: string;
  gymStatus: string;
  invoice: InvoiceSettings | null;
}

/** Row labels per section, so the rail search can match the things inside. */
const SECTION_KEYWORDS: Record<string, string[]> = {
  organization: [
    "name", "code", "industry", "status", "currency", "timezone", "plan",
    "subscription", "member", "mfa", "created",
  ],
  preferences: ["theme", "connection", "enrollment"],
  invoice: ["legal", "tax", "vat", "address", "payment terms"],
  payments: ["stripe", "connect", "payments"],
  sessions: ["sessions", "devices", "login"],
  security: ["rotate", "code", "security"],
};

/** Rail icons. */
const NAV_ICON: Record<string, string> = {
  building: "M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21",
  sliders: "M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75",
  doc: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  card: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z",
  shield: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
  lock: "M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z",
};

export function SettingsView() {
  const [org, setOrg] = useState<OrganizationOut | null>(null);
  const [metrics, setMetrics] = useState<HeadlineMetrics | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("organization");

  // Editable state.
  const [name, setName] = useState("");
  const [enrollment, setEnrollment] = useState("open");
  const [gymStatus, setGymStatus] = useState("open");
  const [invoice, setInvoice] = useState<InvoiceSettings | null>(null);
  // The values as last loaded, to detect unsaved changes and to discard.
  const [baseline, setBaseline] = useState<Baseline | null>(null);

  async function load() {
    setError("");
    try {
      const o = await api.get<OrganizationOut>("/organizations/me");
      setOrg(o);
      // Headline metrics are secondary: a failure must not block settings.
      const m = await api
        .get<HeadlineMetrics>("/analytics/headline")
        .catch(() => null);
      setMetrics(m);
      const inv = o.industry === "office"
        ? await api.get<InvoiceSettings>("/organizations/me/invoice-settings")
        : null;
      setName(o.name);
      setEnrollment(o.enrollment_mode);
      setGymStatus(o.gym_status);
      setInvoice(inv);
      setBaseline({
        name: o.name,
        enrollment: o.enrollment_mode,
        gymStatus: o.gym_status,
        invoice: inv,
      });
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  const dirty = useMemo(() => {
    if (!baseline) return false;
    return (
      name.trim() !== baseline.name ||
      enrollment !== baseline.enrollment ||
      gymStatus !== baseline.gymStatus ||
      JSON.stringify(invoice) !== JSON.stringify(baseline.invoice)
    );
  }, [baseline, name, enrollment, gymStatus, invoice]);

  async function saveAll() {
    if (!org || !baseline) return;
    setError("");
    setNotice("");
    setSaving(true);
    const failures: string[] = [];

    const attempt = async (label: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (e) {
        failures.push(`${label}: ${(e as ApiError).message}`);
      }
    };

    if (name.trim() !== baseline.name) {
      await attempt("Name", () =>
        api.patch("/organizations/me/name", { name: name.trim() }),
      );
    }
    if (enrollment !== baseline.enrollment) {
      await attempt("Enrollment", () =>
        api.patch("/organizations/me/enrollment", { enrollment_mode: enrollment }),
      );
    }
    if (gymStatus !== baseline.gymStatus) {
      await attempt("Status", () =>
        api.patch("/organizations/me/gym-status", { gym_status: gymStatus }),
      );
    }
    if (invoice && JSON.stringify(invoice) !== JSON.stringify(baseline.invoice)) {
      await attempt("Invoice details", () =>
        api.put("/organizations/me/invoice-settings", {
          legal_name: invoice.legal_name || null,
          address: invoice.address || null,
          tax_id: invoice.tax_id || null,
          payment_terms_days: invoice.payment_terms_days,
        }),
      );
    }

    await load();
    setSaving(false);
    if (failures.length) setError(failures.join(" · "));
    else setNotice("Settings saved.");
  }

  function discard() {
    if (!baseline) return;
    setName(baseline.name);
    setEnrollment(baseline.enrollment);
    setGymStatus(baseline.gymStatus);
    setInvoice(baseline.invoice);
    setError("");
    setNotice("");
  }

  async function connectStripe() {
    setError("");
    try {
      const res = await api.post<{ onboarding_url: string }>("/organizations/me/connect");
      window.open(res.onboarding_url, "_blank");
      setNotice("Stripe onboarding started in a new tab.");
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function rotateCode() {
    setError("");
    setNotice("");
    if (!confirm("Rotate the org code? The old code stops working immediately and member sessions are revoked.")) return;
    try {
      const res = await api.post<{ org_code: string }>("/organizations/me/rotate-code");
      setNotice(`New org code: ${res.org_code}`);
      load();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  function setInv<K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) {
    setInvoice((v) => (v ? { ...v, [key]: value } : v));
  }

  if (org === null && !error) return <Spinner label="Loading settings..." />;

  const industry = getIndustry(org?.industry);

  // Grouped rail (Notion settings modal): Account / Preferences / Billing / Security.
  const navGroups = org
    ? [
        { label: "Account", items: [{ id: "organization", label: "Organization", icon: NAV_ICON.building }] },
        { label: "Preferences", items: [{ id: "preferences", label: "Preferences", icon: NAV_ICON.sliders }] },
        {
          label: "Billing",
          items: [
            ...(invoice ? [{ id: "invoice", label: "Invoice details", icon: NAV_ICON.doc }] : []),
            ...(org.industry !== "office" ? [{ id: "payments", label: "Payments", icon: NAV_ICON.card }] : []),
          ],
        },
        {
          label: "Security",
          items: [
            { id: "sessions", label: "Sessions", icon: NAV_ICON.shield },
            { id: "security", label: "Security", icon: NAV_ICON.lock },
          ],
        },
      ]
    : [];

  const q = query.trim().toLowerCase();
  const matches = (item: { id: string; label: string }) =>
    !q ||
    item.label.toLowerCase().includes(q) ||
    (SECTION_KEYWORDS[item.id] ?? []).some((k) => k.includes(q));
  const visibleGroups = navGroups
    .map((g) => ({ ...g, items: g.items.filter(matches) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex h-full flex-col">
      {error && <div className="mb-4 shrink-0"><Alert>{error}</Alert></div>}
      {notice && <div className="mb-4 shrink-0 animate-slide-down"><Alert tone="success">{notice}</Alert></div>}

      {org && (
        <div className="flex min-h-0 flex-1 gap-10">
          {/* Section rail (Notion settings modal). */}
          <nav className="w-56 shrink-0 overflow-y-auto pr-1">
            <div className="relative mb-3">
              <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search settings"
                aria-label="Search settings"
                className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] pl-8 pr-2 text-[13px] text-foreground placeholder:text-muted-foreground transition-colors hover:border-foreground/20 focus:border-foreground/30 focus:outline-none"
              />
            </div>
            {visibleGroups.length === 0 && (
              <p className="px-2 py-1.5 text-[13px] text-muted-foreground">No matches</p>
            )}
            {visibleGroups.map((g) => (
              <div key={g.label} className="mb-3">
                <p className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">{g.label}</p>
                <div className="space-y-0.5">
                  {g.items.map((item) => {
                    const isActive = active === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActive(item.id)}
                        className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
                          isActive
                            ? "bg-foreground/[0.06] font-medium text-foreground"
                            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                        }`}
                      >
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d={item.icon} />
                        </svg>
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* The active page. */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <Section id="organization" title="Organization" hidden={active !== "organization"}>
              <Row label="Name" description="Your organization's display name">
                <Input size="sm" value={name} onChange={(e) => setName(e.target.value)} placeholder={org.name} />
              </Row>
              <Row label="Organization code" description="Share this with members so they can join">
                <ReadValue>{org.org_code}</ReadValue>
              </Row>
              <Row label="Industry" description="The vertical this workspace runs">
                <ReadValue>{industry.label}</ReadValue>
              </Row>
              <Row label="Status" description="Whether the venue is currently open">
                <Select size="sm" value={gymStatus} onChange={(e) => setGymStatus(e.target.value)}>
                  <option value="open">{gymStatusLabel("open")}</option>
                  <option value="closed">{gymStatusLabel("closed")}</option>
                  <option value="half_day">{gymStatusLabel("half_day")}</option>
                </Select>
              </Row>
              <Row label="Default currency" description="Used for all amounts in this workspace">
                <ReadValue>{org.default_currency}</ReadValue>
              </Row>
              <Row label="Timezone" description="Dates and reports are shown in this zone">
                <ReadValue>{org.timezone}</ReadValue>
              </Row>
              <Row label="Plan" description="Your SaaS tier">
                <ReadValue>{titleCase(org.saas_tier)}</ReadValue>
              </Row>
              <Row label="Subscription" description="Billing status of the plan">
                <Badge tone={statusTone(org.saas_status)}>{titleCase(org.saas_status)}</Badge>
              </Row>
              <Row label="Member cap" description="Seat limit for your current plan">
                <ReadValue>{org.member_cap ?? "Unlimited"}</ReadValue>
              </Row>
              <Row label="Active members" description="Members with an active membership">
                <ReadValue>{metrics?.active_members ?? "—"}</ReadValue>
              </Row>
              <Row label="MFA required" description="Two-factor enforced for all admins">
                <ReadValue>{org.mfa_required ? "Yes" : "No"}</ReadValue>
              </Row>
              <Row label="Created" description="When this workspace was set up">
                <ReadValue>{fmtDate(org.created_at)}</ReadValue>
              </Row>
            </Section>

            <Section id="preferences" title="Preferences" hidden={active !== "preferences"}>
              <Row label="Theme" description="How Acron looks on this device">
                <ThemePicker />
              </Row>
              <Row label="Connection" description="Live data sync status">
                <LiveIndicator />
              </Row>
              <Row
                label="Enrollment mode"
                description="Controls how new members can join your organization"
              >
                <Select size="sm" value={enrollment} onChange={(e) => setEnrollment(e.target.value)}>
                  <option value="open">Open</option>
                  <option value="approved">Approved</option>
                  <option value="invite_only">Invite-only</option>
                </Select>
              </Row>
            </Section>

            {invoice && (
              <Section id="invoice" title="Invoice details" hidden={active !== "invoice"}>
                <Row label="Legal name" description="Printed on invoices to companies">
                  <Input size="sm" value={invoice.legal_name ?? ""} onChange={(e) => setInv("legal_name", e.target.value)} placeholder={org.name} />
                </Row>
                <Row label="Tax / VAT ID" description="Shown on issued invoices">
                  <Input size="sm" value={invoice.tax_id ?? ""} onChange={(e) => setInv("tax_id", e.target.value)} placeholder="e.g. US-12-3456789" />
                </Row>
                <Row label="Billing address" description="Where invoices are addressed">
                  <Input size="sm" value={invoice.address ?? ""} onChange={(e) => setInv("address", e.target.value)} placeholder="Billing address on the invoice" />
                </Row>
                <Row label="Payment terms" description="When company invoices are due">
                  <Select
                    size="sm"
                    value={String(invoice.payment_terms_days ?? 0)}
                    onChange={(e) => setInv("payment_terms_days", parseInt(e.target.value, 10))}
                  >
                    <option value="0">Due on receipt</option>
                    <option value="7">Net 7</option>
                    <option value="14">Net 14</option>
                    <option value="30">Net 30</option>
                    <option value="60">Net 60</option>
                  </Select>
                </Row>
              </Section>
            )}

            {org.industry !== "office" && (
              <Section id="payments" title="Payments" hidden={active !== "payments"}>
                <Row
                  label="Stripe Connect"
                  description="Member fees flow directly into your bank account"
                >
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone(org.stripe_connect_status)}>
                      {titleCase(org.stripe_connect_status)}
                    </Badge>
                    <Button variant="secondary" onClick={connectStripe}>
                      {org.stripe_connect_status === "active" ? "Manage" : "Connect"}
                    </Button>
                  </div>
                </Row>
              </Section>
            )}

            <Section id="sessions" title="Sessions" hidden={active !== "sessions"}>
              <SessionsSection />
            </Section>

            <Section id="security" title="Security" hidden={active !== "security"}>
              <Row
                label="Rotate organization code"
                description="Invalidates the current code everywhere and revokes member sessions authenticated with it."
              >
                <div className="flex justify-end">
                  <Button variant="danger" onClick={rotateCode}>
                    Rotate code
                  </Button>
                </div>
              </Row>
            </Section>
            </div>

            {/* One global Save for every staged edit. */}
            <div className="mt-6 flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
              <p className="text-[13px] text-muted-foreground">
                {dirty ? "You have unsaved changes." : "All changes saved."}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={discard} disabled={!dirty || saving}>
                  Discard
                </Button>
                <Button onClick={saveAll} loading={saving} disabled={!dirty}>
                  Save changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** A settings page: a heading and hairline-separated rows. Only the active
 *  page is shown (the dialog is paged, like Notion). */
function Section({
  id,
  title,
  hidden = false,
  children,
}: {
  id: string;
  title: string;
  hidden?: boolean;
  children: React.ReactNode;
}) {
  if (hidden) return null;
  return (
    <section id={`settings-${id}`} className="scroll-mt-8">
      <h2 className="mb-1 font-heading text-lg text-foreground">{title}</h2>
      <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">{children}</div>
    </section>
  );
}

/** One Notion-style preference row: label + description left, control pinned
 *  to the far right edge so every row's control lines up in one column, flush
 *  with the Save bar below. */
function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        {description && <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{description}</p>}
      </div>
      <div className="w-full shrink-0 sm:w-72">{children}</div>
    </div>
  );
}

/** Read-only value in a row. */
function ReadValue({ children }: { children: React.ReactNode }) {
  return <span className="block truncate text-sm text-muted-foreground sm:text-right">{children}</span>;
}

/* Theme picker: buttons that call setTheme directly, mirroring the header
   toggle so choosing a theme always takes effect. A swatch makes each option
   readable at a glance. */
const THEMES = [
  { value: "system", label: "System", swatch: "conic-gradient(from 90deg, #fafafa, #1a1a1a)" },
  { value: "notion", label: "Notion", swatch: "linear-gradient(135deg, #ffffff 40%, #2383e2)" },
  { value: "light", label: "Light", swatch: "#faf7f2" },
  { value: "midnight", label: "Midnight", swatch: "oklch(0.16 0.012 165)" },
  { value: "dark", label: "Dark", swatch: "oklch(0.17 0.006 90)" },
  { value: "solarized", label: "Solarized", swatch: "#fdf6e3" },
  { value: "oled", label: "OLED", swatch: "#000000" },
] as const;

function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // Hydration guard: the resolved theme is only known client-side.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <div className="grid w-full grid-cols-2 gap-1.5">
      {THEMES.map((o) => {
        const active = mounted && theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setTheme(o.value)}
            aria-pressed={active}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-left text-[13px] transition-colors ${
              active
                ? "border-foreground/25 bg-foreground/[0.06] font-medium text-foreground"
                : "border-[var(--border)] text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            }`}
          >
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 rounded-full border border-foreground/20"
              style={{ background: o.swatch }}
            />
            <span className="flex-1 truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Active sessions, with revoke — shown inline in the settings dialog rather
 *  than on a separate page. */
function SessionsSection() {
  const [sessions, setSessions] = useState<AdminSessionInfo[] | null>(null);
  const [error, setError] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);
  const [ownerView, setOwnerView] = useState(true);

  const load = useCallback(async () => {
    setError("");
    try {
      setSessions(await api.get<AdminSessionInfo[]>("/auth/admin/sessions"));
      setOwnerView(true);
    } catch (e) {
      if ((e as ApiError).status === 403) {
        try {
          setSessions(await api.get<AdminSessionInfo[]>("/auth/sessions"));
          setOwnerView(false);
        } catch {
          setSessions([]);
        }
      } else {
        setSessions([]);
      }
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function revoke(id: string) {
    setRevoking(id);
    setError("");
    try {
      await api.del(`/auth/admin/sessions/${id}`);
      setSessions((prev) => prev?.map((s) => (s.id === id ? { ...s, revoked: true } : s)) ?? null);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setRevoking(null);
    }
  }

  if (sessions === null) {
    return <p className="py-3 text-sm text-muted-foreground">Loading…</p>;
  }
  if (sessions.length === 0) {
    return <p className="py-3 text-sm text-muted-foreground">No active sessions.</p>;
  }
  return (
    <div>
      {error && <p className="py-2 text-[13px] text-[var(--danger)]">{error}</p>}
      {sessions.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">
              {s.device_type || s.os || "Unknown device"}
              {s.current ? " · This device" : ""}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {ownerView ? `${s.user_email} · ` : ""}
              {s.ip_address ?? "—"} · {s.last_activity_at ? new Date(s.last_activity_at).toLocaleString() : "—"}
            </p>
          </div>
          <Button
            size="sm"
            variant={s.revoked ? "secondary" : "danger"}
            disabled={s.revoked || revoking === s.id}
            onClick={() => revoke(s.id)}
          >
            {s.revoked ? "Revoked" : "Revoke"}
          </Button>
        </div>
      ))}
    </div>
  );
}
