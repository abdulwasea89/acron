"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Avatar, Badge, Button, Card, CardHeader, EmptyState, Select, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money, statusTone, titleCase } from "@/lib/format";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { MemberDetailOut, MemberDirectoryItem, PendingPaymentItem } from "@/lib/types";

function roleBadge(role: string) {
  switch (role) {
    case "owner":
      return <Badge tone="warning">Owner</Badge>;
    case "manager":
      return <Badge tone="success">Manager</Badge>;
    case "trainer":
      return <Badge tone="info">Trainer</Badge>;
    case "front_desk":
      return <Badge tone="neutral">Front Desk</Badge>;
    default:
      return null;
  }
}

function pendingTone(kind: string) {
  return kind === "failed_attempt" ? ("danger" as const) : ("warning" as const);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 text-sm text-[var(--foreground)]">{children}</dd>
    </div>
  );
}

function PendingList({ items }: { items: PendingPaymentItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No pending payments"
        hint="Nothing is owed and no payment is waiting to settle."
        icon={
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        }
      />
    );
  }
  return (
    <ul className="divide-y divide-[var(--border)]">
      {items.map((p) => (
        <li key={`${p.kind}-${p.payment_id ?? p.due_at ?? p.label}`} className="flex items-center gap-3 px-5 py-4">
          <Badge tone={pendingTone(p.kind)}>{titleCase(p.kind)}</Badge>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[var(--foreground)]">{p.label}</p>
            <p className="text-xs text-[var(--muted)]">
              {p.due_at ? `Due ${new Date(p.due_at).toLocaleDateString()}` : "No due date set"}
            </p>
          </div>
          {p.amount != null && (
            <div className="text-right">
              <div className="text-sm font-semibold tabular-nums text-[var(--foreground)]">{money(p.amount, p.currency ?? "USD")}</div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function MemberDetailPage() {
  const currentUser = useCurrentUser();
  const params = useParams<{ memberId: string }>();
  const memberId = params.memberId;
  const [data, setData] = useState<MemberDetailOut | null>(null);
  const [error, setError] = useState("");

  // Assign trainer dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [trainerOptions, setTrainerOptions] = useState<MemberDirectoryItem[]>([]);
  const [trainerChoice, setTrainerChoice] = useState("");
  const [assignError, setAssignError] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  const isOwner = currentUser?.role === "owner";
  const canManage = isOwner || currentUser?.role === "manager";

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await api.get<MemberDetailOut>(`/members/${memberId}`));
    } catch (e) {
      setError((e as ApiError).message);
      setData(null);
    }
  }, [memberId]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function openAssign() {
    setAssignOpen(true);
    setTrainerChoice("");
    setAssignError("");
    try {
      setTrainerOptions(await api.get<MemberDirectoryItem[]>("/members?role=trainer"));
    } catch (e) {
      setAssignError((e as ApiError).message);
      setTrainerOptions([]);
    }
  }

  async function assignTrainer() {
    if (!trainerChoice) return;
    setAssignError("");
    setAssignLoading(true);
    try {
      await api.post(`/members/${memberId}/trainers`, { trainer_member_id: trainerChoice });
      setAssignOpen(false);
      await load();
    } catch (e) {
      setAssignError((e as ApiError).message);
    } finally {
      setAssignLoading(false);
    }
  }

  async function unassignTrainer(trainerMemberId: string) {
    setError("");
    try {
      await api.del(`/members/${memberId}/trainers/${trainerMemberId}`);
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  if (error) {
    return (
      <>
        <PageHeader title="Member" subtitle="Could not load this member." />
        <Alert>{error}</Alert>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Member" subtitle="Loading..." />
        <Spinner label="Loading member..." />
      </>
    );
  }

  const m = data.member;
  const name = m.display_name || m.full_name || m.email;
  const isStaff = m.role === "trainer" || m.role === "front_desk" || m.role === "manager" || m.role === "owner";
  const sub = data.subscription;

  return (
    <>
      <div className="mb-6">
        <Link href="/app/members" className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          Back to members
        </Link>
        <PageHeader
          title={name}
          subtitle={`${m.email} · Joined ${new Date(m.created_at).toLocaleDateString()}`}
          action={
            <div className="flex items-center gap-2">
              {roleBadge(m.role)}
              <Badge tone={statusTone(m.member_status)}>{titleCase(m.member_status)}</Badge>
            </div>
          }
        />
      </div>

      {/* Assign trainer dialog */}
      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign a trainer" subtitle={`Choose a trainer for ${name}`}>
        <div className="space-y-4">
          {assignError && <Alert>{assignError}</Alert>}
          <Select
            label="Trainer"
            value={trainerChoice}
            onChange={(e) => setTrainerChoice(e.target.value)}
            disabled={trainerOptions.length === 0}
          >
            <option value="">{trainerOptions.length === 0 ? "No trainers available" : "Select a trainer..."}</option>
            {trainerOptions.map((t) => (
              <option key={t.member_id} value={t.member_id}>
                {t.display_name || t.full_name || t.email}
              </option>
            ))}
          </Select>
          <p className="flex items-center gap-1.5 text-xs text-[var(--foreground-muted)]">
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            A member can have several trainers. Invite staff with the Trainer role to unlock this list.
          </p>
          <div className="flex gap-2 pt-2">
            <Button onClick={assignTrainer} loading={assignLoading} disabled={!trainerChoice}>Assign</Button>
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Dialog>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Member details */}
        <Card>
          <CardHeader title="Member details" subtitle="Profile and contact information" />
          <div className="flex items-center gap-3 px-5 pt-5">
            <Avatar name={name} size="lg" />
            <div className="min-w-0">
              <p className="font-medium text-[var(--foreground)]">{name}</p>
              <p className="text-xs text-[var(--muted)]">
                {m.profile_complete ? "Profile complete" : "Profile incomplete"}
              </p>
            </div>
          </div>
          <dl className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            <Field label="Email">{m.email}</Field>
            <Field label="Phone">{m.phone || "—"}</Field>
            <Field label="Role">{titleCase(m.role)}</Field>
            <Field label="Status"><Badge tone={statusTone(m.member_status)}>{titleCase(m.member_status)}</Badge></Field>
            <Field label="Trainers">
              {m.role === "member" ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {data.trainer_assignments.length ? (
                    data.trainer_assignments.map((t) => (
                      <span key={t.trainer_member_id} className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--foreground)]">
                        {t.trainer_name}
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => unassignTrainer(t.trainer_member_id)}
                            aria-label={`Unassign ${t.trainer_name}`}
                            className="text-[var(--muted)] transition-colors hover:text-[var(--danger)]"
                          >
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </span>
                    ))
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                  {canManage && (
                    <Button variant="secondary" size="sm" onClick={openAssign}>
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4.5v15m7.5-7.5h-15" /></svg>
                      Assign trainer
                    </Button>
                  )}
                </div>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Joined">{new Date(m.created_at).toLocaleDateString()}</Field>
            {isStaff && (
              <>
                <Field label="Fixed salary">
                  {m.fixed_monthly_salary > 0 ? money(m.fixed_monthly_salary) : "—"}
                </Field>
                <Field label="Hourly rate">
                  {m.hourly_rate > 0 ? money(m.hourly_rate) : "—"}
                </Field>
                <Field label="Per class">
                  {m.per_class_rate > 0 ? money(m.per_class_rate) : "—"}
                </Field>
                <Field label="Commission">
                  {m.commission_rate > 0 ? `${(m.commission_rate * 100).toFixed(0)}%` : "—"}
                </Field>
              </>
            )}
          </dl>
        </Card>

        {/* Current plan */}
        <Card>
          <CardHeader title="Current plan" subtitle="Active subscription and plan details" />
          {!sub ? (
            <EmptyState
              title="No plan yet"
              hint="This member hasn't subscribed to a plan."
              icon={
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              }
            />
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
                <div>
                  <p className="font-heading text-xl text-[var(--foreground)]">{sub.plan_name}</p>
                  <p className="text-xs text-[var(--muted)]">{titleCase(sub.billing_type)} plan</p>
                </div>
                <div className="text-right">
                  <p className="font-heading text-2xl tabular-nums text-[var(--foreground)]">{money(sub.price_snapshot, sub.currency)}</p>
                  <p className="text-xs text-[var(--muted)]">per {sub.billing_type === "one_time_pack" ? "pack" : "cycle"}</p>
                </div>
              </div>
              <dl className="grid gap-4 px-5 py-5 sm:grid-cols-2">
                <Field label="Subscription status"><Badge tone={statusTone(sub.status)}>{titleCase(sub.status)}</Badge></Field>
                <Field label="Started">{new Date(sub.started_at).toLocaleDateString()}</Field>
                {sub.current_period_end && (
                  <Field label="Valid until">{new Date(sub.current_period_end).toLocaleDateString()}</Field>
                )}
                {sub.classes_remaining != null && (
                  <Field label="Classes remaining">{sub.classes_remaining}</Field>
                )}
                {sub.grace_until && (
                  <Field label="Grace until">{new Date(sub.grace_until).toLocaleDateString()}</Field>
                )}
                {sub.cancelled_at && (
                  <Field label="Cancelled">{new Date(sub.cancelled_at).toLocaleDateString()}</Field>
                )}
              </dl>
            </>
          )}
        </Card>
      </div>

      {/* Pending payments */}
      <Card className="mt-5">
        <CardHeader title="Pending payments" subtitle="Amounts owed and unsettled attempts" />
        <PendingList items={data.pending_payments} />
      </Card>

      {/* Payment history */}
      <Card className="mt-5">
        <CardHeader title="Payment history" subtitle={data.payments.length ? `${data.payments.length} total` : "No payments yet"} />
        {data.payments.length === 0 ? (
          <EmptyState
            title="No payments yet"
            hint="Payments will appear here once this member pays."
            icon={
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Method</th>
                  <th className="px-6 py-3.5">Amount</th>
                  <th className="px-6 py-3.5">Refunded</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.payments.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-[var(--background)]">
                    <td className="px-6 py-4 whitespace-nowrap tabular-nums">{(p.paid_at || p.created_at).slice(0, 10)}</td>
                    <td className="px-6 py-4 text-[var(--foreground-muted)]">{titleCase(p.method)}</td>
                    <td className="px-6 py-4 tabular-nums font-medium text-[var(--foreground)]">{money(p.amount, p.currency)}</td>
                    <td className="px-6 py-4 tabular-nums text-[var(--foreground-muted)]">
                      {p.refunded_amount > 0 ? money(p.refunded_amount, p.currency) : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={statusTone(p.status)}>{titleCase(p.status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
