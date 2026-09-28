"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { PageHeader } from "@/components/PageHeader";
import { LiveIndicator } from "@/components/Realtime";
import { Alert, Badge, Button, Input, Select, Spinner } from "@/components/ui";
import { getIndustry } from "@/lib/industries";
import { api, ApiError } from "@/lib/api";
import { fmtDate, gymStatusLabel, statusTone, titleCase } from "@/lib/format";
import type { HeadlineMetrics, InvoiceSettings, OrganizationOut } from "@/lib/types";

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

export default function SettingsPage() {
  const [org, setOrg] = useState<OrganizationOut | null>(null);
  const [metrics, setMetrics] = useState<HeadlineMetrics | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

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

  const sections = org
    ? [
        { id: "organization", label: "Organization" },
        { id: "preferences", label: "Preferences" },
        ...(invoice ? [{ id: "invoice", label: "Invoice details" }] : []),
        ...(org.industry !== "office" ? [{ id: "payments", label: "Payments" }] : []),
        { id: "sessions", label: "Sessions" },
        { id: "security", label: "Security" },
      ]
    : [];

  function jump(id: string) {
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <PageHeader title="Settings" subtitle={`${titleCase(industry.shortNoun)} configuration & security`} />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {notice && <div className="mb-4 animate-slide-down"><Alert tone="success">{notice}</Alert></div>}

      {org && (
        <div className="flex gap-10">
          {/* Section rail (Notion settings modal). */}
          <nav className="hidden w-44 shrink-0 lg:block">
            <ul className="sticky top-8 space-y-0.5">
              {sections.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => jump(s.id)}
                    className="w-full rounded-md px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Preference panes. */}
          <div className="min-w-0 max-w-2xl flex-1">
            <Section id="organization" title="Organization">
              <Row label="Name" description="Your organization's display name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={org.name} />
              </Row>
              <Row label="Organization code" description="Share this with members so they can join">
                <ReadValue>{org.org_code}</ReadValue>
              </Row>
              <Row label="Industry" description="The vertical this workspace runs">
                <ReadValue>{industry.label}</ReadValue>
              </Row>
              <Row label="Status" description="Whether the venue is currently open">
                <Select value={gymStatus} onChange={(e) => setGymStatus(e.target.value)}>
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

            <Section id="preferences" title="Preferences">
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
                <Select value={enrollment} onChange={(e) => setEnrollment(e.target.value)}>
                  <option value="open">Open</option>
                  <option value="approved">Approved</option>
                  <option value="invite_only">Invite-only</option>
                </Select>
              </Row>
            </Section>

            {invoice && (
              <Section id="invoice" title="Invoice details">
                <Row label="Legal name" description="Printed on invoices to companies">
                  <Input value={invoice.legal_name ?? ""} onChange={(e) => setInv("legal_name", e.target.value)} placeholder={org.name} />
                </Row>
                <Row label="Tax / VAT ID" description="Shown on issued invoices">
                  <Input value={invoice.tax_id ?? ""} onChange={(e) => setInv("tax_id", e.target.value)} placeholder="e.g. US-12-3456789" />
                </Row>
                <Row label="Billing address" description="Where invoices are addressed">
                  <Input value={invoice.address ?? ""} onChange={(e) => setInv("address", e.target.value)} placeholder="Billing address on the invoice" />
                </Row>
                <Row label="Payment terms" description="When company invoices are due">
                  <Select
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
              <Section id="payments" title="Payments">
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

            <Section id="sessions" title="Sessions">
              <Row label="Active sessions" description="See and revoke devices logged into this account">
                <a
                  href="/app/settings/sessions"
                  className="inline-flex h-9 items-center rounded-md border border-foreground/15 px-4 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
                >
                  View sessions
                </a>
              </Row>
            </Section>

            <Section id="security" title="Security">
              <Row
                label="Rotate organization code"
                description="Invalidates the current code everywhere and revokes member sessions authenticated with it."
              >
                <Button variant="danger" onClick={rotateCode}>
                  Rotate code
                </Button>
              </Row>
            </Section>

            {/* One global Save for every staged edit on the page. */}
            <div className="sticky bottom-4 z-10 mt-8 flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-lg shadow-black/5">
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
    </>
  );
}

/** A settings pane: a heading and hairline-separated rows. */
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={`settings-${id}`} className="mb-10 scroll-mt-8">
      <h2 className="mb-1 font-heading text-lg text-foreground">{title}</h2>
      <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">{children}</div>
    </section>
  );
}

/** One Notion-style preference row: label + description left, control right. */
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
      <div className="w-full shrink-0 sm:w-80">{children}</div>
    </div>
  );
}

/** Read-only value in a row. */
function ReadValue({ children }: { children: React.ReactNode }) {
  return <span className="block truncate text-sm text-muted-foreground">{children}</span>;
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
            className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-[13px] transition-colors ${
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
