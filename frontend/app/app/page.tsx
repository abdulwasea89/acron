import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Badge, Card, CardHeader, StatCard } from "@/components/ui";
import { backend } from "@/lib/backend";
import {
  fmtDate,
  fmtDateTime,
  gymStatusLabel,
  gymStatusTone,
  money,
  statusTone,
  titleCase,
} from "@/lib/format";
import type {
  HeadlineMetrics,
  OrganizationOut,
  PaymentOut,
  ProfileOut,
  SaasStatusOut,
  SetupChecklist,
} from "@/lib/types";

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

type Tone = "neutral" | "success" | "danger" | "warning" | "info";

type ChecklistFlag = Exclude<keyof SetupChecklist, "steps">;

const CHECKLIST_LABELS: Record<ChecklistFlag, string> = {
  gym_registered: "Gym registered",
  saas_active: "SaaS plan active",
  stripe_connected: "Connect Stripe (member payments)",
  plan_published: "Publish a membership plan",
  enrollment_configured: "Configure enrollment mode",
  staff_invited: "Invite your staff",
  office_configured: "Set office statuses & leave types",
  member_signup_unblocked: "Member signup unblocked",
};

/** Where each onboarding step sends you. Unknown codes fall back to Settings. */
const STEP_HREF: Record<string, string> = {
  gym_registered: "/app/settings",
  saas_active: "/app/billing",
  stripe_connected: "/app/settings",
  plan_published: "/app/plans",
  enrollment_configured: "/app/settings",
  staff_invited: "/app/staff",
  office_configured: "/app/settings",
  member_signup_unblocked: "/app/members",
  offer: "/app/plans",
  enroll: "/app/settings",
  people: "/app/staff",
  companies: "/app/companies",
  courses: "/app/courses",
  done: "/app",
};

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  members: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
  revenue: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  checkin: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  approvals: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z",
  seats: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z",
  percent: "M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6zM13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z",
  invoice: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
} as const;

function ProgressBar({ value, tone = "brand" }: { value: number; tone?: "brand" | "success" }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.08]">
      <div
        className={`h-full rounded-full ${tone === "success" ? "bg-success" : "bg-brand"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** One label/value row used inside the plan card. */
function PlanRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-[13px] font-medium text-foreground">{children}</span>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
  accent,
  href,
}: {
  label: string;
  value: string;
  icon: string;
  accent?: boolean;
  href: string;
}) {
  return (
    <Link href={href} className="group block">
      <StatCard
        joined
        accent={accent}
        label={label}
        value={value}
        icon={<Icon d={icon} className="h-4 w-4" />}
        className="h-full transition-colors group-hover:bg-foreground/[0.03]"
      />
    </Link>
  );
}

function ActivityRow({ p, currency }: { p: PaymentOut; currency: string }) {
  const refunded = p.refunded_amount > 0;
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-foreground/[0.05] text-[11px] font-medium uppercase text-muted-foreground">
        {p.method.slice(0, 2)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">{titleCase(p.method)}</p>
        <p className="truncate text-[12px] text-muted-foreground">
          {titleCase(p.kind)} · {fmtDateTime(p.paid_at ?? p.created_at)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[13px] font-medium tabular-nums text-foreground">
          {money(p.amount, p.currency || currency)}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {refunded ? `-${money(p.refunded_amount, p.currency || currency)} refunded` : titleCase(p.status)}
        </p>
      </div>
    </li>
  );
}

export default async function DashboardPage() {
  const [metrics, checklist, saas, org, payments, profile] = await Promise.all([
    safe(backend<HeadlineMetrics>("/analytics/headline")),
    safe(backend<SetupChecklist>("/organizations/me/checklist")),
    safe(backend<SaasStatusOut>("/saas-billing/status")),
    safe(backend<OrganizationOut>("/organizations/me")),
    safe(backend<PaymentOut[]>("/payments")),
    safe(backend<ProfileOut>("/auth/me/profile")),
  ]);

  const currency = org?.default_currency ?? "USD";
  const industry = org?.industry ?? "gym";
  const isOffice = industry === "office";
  const isAcademy = industry === "academy";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] ?? null;
  const greeting = firstName ? `Welcome back, ${firstName}` : "Dashboard";

  // ── KPI strip ───────────────────────────────────────────────────────────
  const stats: { label: string; value: string; icon: string; href: string; accent?: boolean }[] =
    isOffice
      ? [
          { label: "Seats occupied", value: metrics ? String(metrics.occupied_seats ?? 0) : "—", icon: ICONS.seats, href: "/app/members" },
          { label: "Occupancy", value: metrics ? `${Math.round(metrics.occupancy_pct ?? 0)}%` : "—", icon: ICONS.percent, href: "/app/space", accent: true },
          { label: "Monthly space revenue", value: metrics ? money(metrics.space_mrr ?? 0, currency) : "—", icon: ICONS.revenue, href: "/app/payments" },
          { label: "Outstanding invoices", value: metrics ? money(metrics.outstanding_invoices ?? 0, currency) : "—", icon: ICONS.invoice, href: "/app/invoices" },
        ]
      : [
          { label: "Active members", value: metrics ? String(metrics.active_members) : "—", icon: ICONS.members, href: "/app/members" },
          { label: "Today's revenue", value: metrics ? money(metrics.today_revenue, currency) : "—", icon: ICONS.revenue, href: "/app/payments", accent: true },
          { label: "Check-ins today", value: metrics ? String(metrics.today_check_ins) : "—", icon: ICONS.checkin, href: "/app/classes" },
          { label: "Pending approvals", value: metrics ? String(metrics.pending_approvals) : "—", icon: ICONS.approvals, href: "/app/approvals" },
        ];

  // ── Setup checklist ─────────────────────────────────────────────────────
  const checklistItems = (checklist?.steps?.length
    ? checklist.steps.map((s) => ({ key: s.code, label: s.label, done: s.done }))
    : checklist
      ? (Object.keys(CHECKLIST_LABELS) as ChecklistFlag[]).map((k) => ({
          key: k,
          label: CHECKLIST_LABELS[k],
          done: checklist[k],
        }))
      : []) as { key: string; label: string; done: boolean }[];

  const totalSteps = checklistItems.length;
  const remaining = checklistItems.filter((i) => !i.done).length;
  const doneSteps = totalSteps - remaining;
  const setupPct = totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0;
  const nextStep = checklistItems.find((i) => !i.done) ?? null;

  const allSetCopy = isOffice
    ? "All set — your space is fully configured."
    : isAcademy
      ? "All set — your academy is fully configured."
      : "All set — your gym is fully configured.";

  // ── Needs attention ─────────────────────────────────────────────────────
  const attention: { label: string; value: string; href: string; tone: Tone }[] = [];
  if (metrics?.pending_receipts) {
    attention.push({ label: "Receipts to review", value: String(metrics.pending_receipts), href: "/app/receipts", tone: "warning" });
  }
  if (metrics?.pending_approvals) {
    attention.push({ label: "Approvals pending", value: String(metrics.pending_approvals), href: "/app/approvals", tone: "warning" });
  }
  if (isOffice && (metrics?.outstanding_invoices ?? 0) > 0) {
    attention.push({ label: "Outstanding invoices", value: money(metrics!.outstanding_invoices ?? 0, currency), href: "/app/invoices", tone: "danger" });
  }
  if (remaining > 0) {
    attention.push({ label: "Setup steps left", value: String(remaining), href: "#setup", tone: "info" });
  }

  // ── Quick actions ───────────────────────────────────────────────────────
  const quickActions: { label: string; href: string; icon: string }[] = isOffice
    ? [
        { label: "Add a company", href: "/app/companies", icon: ICONS.members },
        { label: "Create a space plan", href: "/app/plans", icon: ICONS.invoice },
        { label: "Issue an invoice", href: "/app/invoices", icon: ICONS.invoice },
      ]
    : isAcademy
      ? [
          { label: "Create a course", href: "/app/courses", icon: ICONS.invoice },
          { label: "Publish a fee plan", href: "/app/plans", icon: ICONS.revenue },
          { label: "Add a student", href: "/app/members", icon: ICONS.members },
        ]
      : [
          { label: "Invite a member", href: "/app/members", icon: ICONS.members },
          { label: "Create a plan", href: "/app/plans", icon: ICONS.revenue },
          { label: "Log a cash payment", href: "/app/cash", icon: ICONS.invoice },
        ];

  const recent = (payments ?? []).slice(0, 5);

  const memberCapPct =
    saas?.member_cap && saas.member_cap > 0
      ? Math.min(100, Math.round((saas.current_member_count / saas.member_cap) * 100))
      : null;

  const saasBadgeTone: Tone = saas?.read_only
    ? "danger"
    : saas?.saas_status === "past_due" || saas?.saas_status === "suspended"
      ? "warning"
      : statusTone(saas?.saas_status ?? "active");

  return (
    <>
      <PageHeader
        title={greeting}
        subtitle={`${org?.name ?? "Your workspace"} · ${today}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {org && <Badge tone={gymStatusTone(org.gym_status)}>{gymStatusLabel(org.gym_status)}</Badge>}
            {saas && (
              <Badge tone={saasBadgeTone}>
                {titleCase(saas.saas_tier)} · {titleCase(saas.saas_status)}
              </Badge>
            )}
          </div>
        }
      />

      {/* ── Subscription alerts ─────────────────────────────────────────── */}
      {saas?.saas_status === "past_due" && !saas.read_only && (
        <div className="mb-4 rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          <strong>Payment failed.</strong>{" "}
          {saas.retry_count > 0 ? `Stripe retry #${saas.retry_count} failed. ` : ""}
          Update your card in{" "}
          <Link href="/app/billing" className="font-medium underline">Billing</Link> to avoid interruption.
        </div>
      )}
      {saas?.read_only && (
        <div className="mb-4 rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          <strong>Account is read-only.</strong> Update billing to restore full access.
        </div>
      )}
      {saas?.saas_status === "suspended" && (
        <div className="mb-4 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 text-sm text-[var(--warning)]">
          <strong>Account suspended.</strong> Contact support to reactivate your workspace.
        </div>
      )}

      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-px overflow-hidden border border-foreground/10 bg-[var(--border)] lg:grid-cols-4">
        {stats.map((s) => (
          <StatTile key={s.label} label={s.label} value={s.value} icon={s.icon} href={s.href} accent={s.accent} />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div className="space-y-6 lg:contents lg:space-y-0">
          {/* Setup checklist */}
          <Card className="scroll-mt-6 lg:col-span-2 lg:row-start-1">
            <span id="setup" />
            <CardHeader
              title="Setup checklist"
              subtitle={
                remaining === 0
                  ? allSetCopy
                  : `${remaining} item${remaining === 1 ? "" : "s"} left before you're fully live.`
              }
              action={
                <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
                  {doneSteps}/{totalSteps}
                </span>
              }
            />
            <div className="px-5 pt-4">
              <ProgressBar value={setupPct} tone={remaining === 0 ? "success" : "brand"} />
            </div>
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {checklistItems.length === 0 && (
                <li className="px-5 py-4 text-sm text-muted-foreground">Could not load checklist.</li>
              )}
              {checklistItems.map((item, i) => {
                const isNext = nextStep?.key === item.key;
                return (
                  <li
                    key={item.key}
                    className={`flex items-center gap-3 px-5 py-3 transition-colors ${isNext ? "bg-brand/[0.04]" : "hover:bg-foreground/[0.03]"}`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        item.done
                          ? "bg-[var(--success-bg)] text-[var(--success)]"
                          : isNext
                            ? "bg-brand text-brand-foreground"
                            : "border border-[var(--border)] bg-[var(--surface)] text-muted-foreground"
                      }`}
                    >
                      {item.done ? (
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className={`flex-1 text-[13px] ${item.done ? "text-muted-foreground line-through" : isNext ? "font-medium text-foreground" : "text-foreground"}`}>
                      {item.label}
                    </span>
                    {!item.done && (
                      <Link
                        href={STEP_HREF[item.key] ?? "/app/settings"}
                        className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-brand hover:underline"
                      >
                        {isNext ? "Start" : "Open"}
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Recent activity */}
          <Card className="lg:col-span-2 lg:row-start-2">
            <CardHeader
              title="Recent activity"
              subtitle="Latest payments in this workspace"
              action={
                <Link href="/app/payments" className="text-[12px] font-medium text-brand hover:underline">
                  View all
                </Link>
              }
            />
            {recent.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                No payments recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {recent.map((p) => (
                  <ActivityRow key={p.id} p={p} currency={currency} />
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* ── Right column ────────────────────────────────────────────────── */}
        <div className="space-y-6 lg:contents lg:space-y-0">
          {/* Plan & usage */}
          <Card className="flex flex-col lg:col-start-3 lg:row-start-1">
            <CardHeader
              title="Your plan"
              action={
                <Link href="/app/billing" className="text-[12px] font-medium text-brand hover:underline">
                  Manage
                </Link>
              }
            />
            <div className="flex flex-1 flex-col justify-between gap-6 px-5 py-5">
              <div>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className="text-[13px] text-muted-foreground">Members</span>
                  <span className="text-[13px] font-medium tabular-nums text-foreground">
                    {saas ? `${saas.current_member_count}${saas.member_cap ? ` / ${saas.member_cap}` : ""}` : "—"}
                  </span>
                </div>
                {memberCapPct !== null ? (
                  <ProgressBar value={memberCapPct} />
                ) : (
                  <p className="text-[11px] text-muted-foreground">Unlimited members</p>
                )}
              </div>
              <div className="space-y-3 border-t border-[var(--border)] pt-4">
                <PlanRow label="Tier">{saas ? titleCase(saas.saas_tier) : "—"}</PlanRow>
                <PlanRow label="Status">
                  <Badge tone={saasBadgeTone}>{saas ? titleCase(saas.saas_status) : "—"}</Badge>
                </PlanRow>
                <PlanRow label="Renews">{saas?.current_period_end ? fmtDate(saas.current_period_end) : "—"}</PlanRow>
              </div>
            </div>
          </Card>

          {/* Needs attention */}
          <Card className="lg:col-start-3 lg:row-start-2">
            <CardHeader title="Needs attention" />
            {attention.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--success-bg)] text-[var(--success)]">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                </span>
                <p className="text-[13px] text-muted-foreground">You&apos;re all caught up.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {attention.map((a) => (
                  <li key={a.label}>
                    <Link
                      href={a.href}
                      className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-foreground/[0.03]"
                    >
                      <span className="text-[13px] text-foreground">{a.label}</span>
                      <span className="flex items-center gap-2">
                        <Badge tone={a.tone}>{a.value}</Badge>
                        <svg className="h-3.5 w-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Quick actions */}
          <Card className="overflow-hidden lg:col-span-3 lg:row-start-3">
            <CardHeader title="Quick actions" />
            <div className="grid grid-cols-2 gap-px bg-[var(--border)] sm:grid-cols-3">
              {quickActions.map((q) => (
                <Link
                  key={q.href}
                  href={q.href}
                  className="group flex flex-col gap-3 bg-card p-4 transition-colors hover:bg-foreground/[0.03]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground/[0.05] text-muted-foreground transition-colors group-hover:bg-brand/10 group-hover:text-brand">
                    <Icon d={q.icon} className="h-4 w-4" />
                  </span>
                  <span className="text-[13px] font-medium leading-snug text-foreground">{q.label}</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
