import { PageHeader } from "@/components/PageHeader";
import { Badge, Card, CardHeader, StatCard } from "@/components/ui";
import { backend } from "@/lib/backend";
import { money, titleCase } from "@/lib/format";
import type { HeadlineMetrics, SaasStatusOut, SetupChecklist } from "@/lib/types";

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
  const [metrics, checklist, saas] = await Promise.all([
    safe(backend<HeadlineMetrics>("/analytics/headline")),
    safe(backend<SetupChecklist>("/organizations/me/checklist")),
    safe(backend<SaasStatusOut>("/saas-billing/status")),
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
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Your subscription is past due — the account is read-only. Update billing to restore write access.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

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
              <li key={item.key} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    item.done
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-500 border border-gray-200"
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
