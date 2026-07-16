import { PageHeader } from "@/components/PageHeader";
import { Badge, Card, CardHeader, StatCard } from "@/components/ui";
import { backend } from "@/lib/backend";
import { gymStatusLabel, gymStatusTone, money, titleCase } from "@/lib/format";
import type { HeadlineMetrics, OrganizationOut, SaasStatusOut, SetupChecklist } from "@/lib/types";

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

const CHECKLIST_LABELS: Record<keyof SetupChecklist, string> = {
  gym_registered: "Gym registered",
  saas_active: "SaaS plan active",
  stripe_connected: "Connect Stripe (member payments)",
  plan_published: "Publish a membership plan",
  enrollment_configured: "Configure enrollment mode",
  staff_invited: "Invite your staff",
  office_configured: "Set office statuses & leave types",
  member_signup_unblocked: "Member signup unblocked",
};

export default async function DashboardPage() {
  const [metrics, checklist, saas, org] = await Promise.all([
    safe(backend<HeadlineMetrics>("/analytics/headline")),
    safe(backend<SetupChecklist>("/organizations/me/checklist")),
    safe(backend<SaasStatusOut>("/saas-billing/status")),
    safe(backend<OrganizationOut>("/organizations/me")),
  ]);

  const stats = [
    { label: "Active members", value: metrics ? String(metrics.active_members) : "—" },
    { label: "Today's revenue", value: metrics ? money(metrics.today_revenue, "USD") : "—" },
    { label: "Check-ins today", value: metrics ? String(metrics.today_check_ins) : "—" },
    { label: "Pending approvals", value: metrics ? String(metrics.pending_approvals) : "—" },
  ];

  const checklistItems = checklist
    ? (Object.keys(CHECKLIST_LABELS) as (keyof SetupChecklist)[]).map((k) => ({
        key: k,
        label: CHECKLIST_LABELS[k],
        done: checklist[k],
      }))
    : [];
  const remaining = checklistItems.filter((i) => !i.done).length;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Today at a glance"
        action={
          saas ? (
            <Badge tone={saas.read_only ? "danger" : "success"}>
              {titleCase(saas.saas_tier)} · {titleCase(saas.saas_status)}
            </Badge>
          ) : null
        }
      />

      {saas?.read_only && (
        <div className="mb-6 rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          Your subscription is past due — the account is read-only. Update billing to restore write access.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

      {org && (
        <div className="mt-6">
          <GymStatusCard status={org.gym_status} />
        </div>
      )}

      <div className="mt-6">
        <Card>
          <CardHeader
            title="Setup checklist"
            subtitle={
              remaining === 0
                ? "All set — your gym is fully configured."
                : `${remaining} item${remaining === 1 ? "" : "s"} left before you're fully live.`
            }
          />
          <ul className="divide-y divide-[var(--border)]">
            {checklistItems.length === 0 && (
              <li className="px-5 py-4 text-sm text-[var(--muted)]">Could not load checklist.</li>
            )}
            {checklistItems.map((item, i) => (
              <li key={item.key} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--background)] transition-colors">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    item.done
                      ? "bg-[var(--success-bg)] text-[var(--success)]"
                      : "bg-[var(--background)] text-[var(--foreground-muted)] border border-[var(--border)]"
                  }`}
                >
                  {item.done ? (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className={`text-sm ${item.done ? "text-[var(--muted)] line-through" : "text-[var(--foreground)] font-medium"}`}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function GymStatusCard({ status }: { status: string }) {
  const tone = gymStatusTone(status);
  const iconBg =
    tone === "success" ? "bg-[var(--success-bg)] text-[var(--success)]" :
    tone === "danger" ? "bg-[var(--danger-bg)] text-[var(--danger)]" :
    "bg-[var(--warning-bg)] text-[var(--warning)]";
  return (
    <Card hover className="overflow-hidden">
      <div className="flex items-center gap-5 p-5">
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${iconBg}`}>
          {status === "open" && (
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12" />
            </svg>
          )}
          {status === "closed" && (
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          )}
          {status === "half_day" && (
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-[19px] leading-tight text-[var(--foreground)]">{gymStatusLabel(status)}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {status === "open" && "Your gym is open and accepting members."}
            {status === "closed" && "Your gym is closed and not accepting anyone."}
            {status === "half_day" && "Your gym is operating on limited hours today."}
          </p>
        </div>
        <Badge tone={tone as "success" | "danger" | "warning"}>{gymStatusLabel(status)}</Badge>
      </div>
    </Card>
  );
}
