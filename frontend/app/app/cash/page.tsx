"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, Card, CardHeader, Input, Select, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import type { CashPaymentOut, MemberDirectoryItem, PlanOut, ReconciliationOut } from "@/lib/types";

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export default function CashPage() {
  return (
    <>
      <PageHeader
        title="Cash & offline payments"
        subtitle="Record front-desk payments confidently, then close the drawer with a clear audit trail."
      />

      <section className="mb-6 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-3 sm:p-5" aria-label="Cash workflow overview">
        <WorkflowStep number="1" title="Record payment" hint="Select the member and plan" />
        <WorkflowStep number="2" title="Activate membership" hint="Receipt is emailed automatically" />
        <WorkflowStep number="3" title="Reconcile daily" hint="Flag discrepancies before close" />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <LogPayment />
        <Reconcile />
      </div>
    </>
  );
}

function WorkflowStep({ number, title, hint }: { number: string; title: string; hint: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-[var(--primary-foreground)]">{number}</span>
      <div>
        <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
        <p className="text-xs text-[var(--foreground-muted)]">{hint}</p>
      </div>
    </div>
  );
}

function LogPayment() {
  const [members, setMembers] = useState<MemberDirectoryItem[] | null>(null);
  const [plans, setPlans] = useState<PlanOut[]>([]);
  const [memberId, setMemberId] = useState("");
  const [planId, setPlanId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<CashPaymentOut | null>(null);
  const [loading, setLoading] = useState(false);

  const memberOptions = useMemo(() => members?.filter((member) => member.role === "member") ?? [], [members]);
  const selectedMember = memberOptions.find((member) => member.member_id === memberId);
  const selectedPlan = plans.find((plan) => plan.id === planId);

  useEffect(() => {
    async function loadFormOptions() {
      try {
        const [loadedMembers, loadedPlans] = await Promise.all([
          api.get<MemberDirectoryItem[]>("/members"),
          api.get<PlanOut[]>("/plans"),
        ]);
        setMembers(loadedMembers);
        setPlans(loadedPlans);
      } catch (caught) {
        setError((caught as ApiError).message);
        setMembers([]);
      }
    }

    void loadFormOptions();
  }, []);

  function pickPlan(id: string) {
    setPlanId(id);
    const plan = plans.find((item) => item.id === id);
    if (plan) setAmount(String(plan.price));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      setError("Enter a payment amount greater than zero.");
      return;
    }

    setError("");
    setResult(null);
    setLoading(true);
    try {
      const output = await api.post<CashPaymentOut>("/cash/log", {
        member_id: memberId,
        plan_id: planId,
        amount: paymentAmount,
        method,
        note: note.trim() || null,
      });
      setResult(output);
      setMemberId("");
      setPlanId("");
      setAmount("");
      setNote("");
    } catch (caught) {
      setError((caught as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Log a payment" subtitle="Activate a member and send their payment receipt in one step" action={<Badge tone="info">Front desk</Badge>} />
      {members === null ? (
        <Spinner label="Loading members and plans…" />
      ) : (
        <form onSubmit={submit} className="grid gap-5 p-5 sm:p-6">
          {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
          {result && (
            <Alert tone="success" onDismiss={() => setResult(null)}>
              <span className="font-semibold">Payment recorded.</span> {money(result.amount)} was logged and the membership is now {result.member_status}.
            </Alert>
          )}

          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">Payment details</p>
            <div className="mt-4 grid gap-4">
              <Select label="Member" required value={memberId} onChange={(event) => setMemberId(event.target.value)}>
                <option value="">Choose a member…</option>
                {memberOptions.map((member) => (
                  <option key={member.member_id} value={member.member_id}>
                    {member.full_name || member.email} · {member.member_status}
                  </option>
                ))}
              </Select>
              {selectedMember && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--primary-light)] bg-[var(--surface)] px-3.5 py-3 text-sm">
                  <span className="min-w-0 truncate font-medium text-[var(--foreground)]">{selectedMember.full_name || selectedMember.email}</span>
                  <Badge tone={selectedMember.member_status === "active" ? "success" : "warning"}>{selectedMember.member_status}</Badge>
                </div>
              )}
              <Select label="Membership plan" required value={planId} onChange={(event) => pickPlan(event.target.value)}>
                <option value="">Choose a plan…</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · {money(plan.price, plan.currency)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Amount received" type="number" min="0.01" step="0.01" inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} hint={selectedPlan ? `Plan price: ${money(selectedPlan.price, selectedPlan.currency)}` : "Enter the amount actually received."} />
            <Select label="Payment method" value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="mobile_wallet">Mobile wallet</option>
            </Select>
          </div>
          <Input label="Internal note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reference number or handover detail" hint="Visible to your team, not the member." />

          <div className="flex flex-col-reverse gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-[var(--foreground-muted)]">The member is activated immediately. Confirm the amount before saving.</p>
            <Button type="submit" loading={loading} disabled={!memberId || !planId} className="w-full sm:w-auto">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Record payment
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function Reconcile() {
  const [businessDate, setBusinessDate] = useState(localDate);
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ReconciliationOut | null>(null);
  const [loading, setLoading] = useState(false);
  const hasDiscrepancy = result ? Math.abs(result.discrepancy) > 0.009 : false;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const countedTotal = Number(counted);
    if (!Number.isFinite(countedTotal) || countedTotal < 0) {
      setError("Enter the cash total counted in the drawer.");
      return;
    }

    setError("");
    setResult(null);
    setLoading(true);
    try {
      const output = await api.post<ReconciliationOut>("/cash/reconcile", {
        business_date: businessDate,
        counted_total: countedTotal,
        notes: notes.trim() || null,
      });
      setResult(output);
    } catch (caught) {
      setError((caught as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden xl:sticky xl:top-6">
      <CardHeader title="Close the drawer" subtitle="Reconcile each business day before handover" action={<Badge tone="warning">Daily control</Badge>} />
      <form onSubmit={submit} className="grid gap-5 p-5 sm:p-6">
        {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}
        <div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3.5 text-sm text-[var(--warning)]">
          <p className="font-semibold">Count physical cash first</p>
          <p className="mt-1 text-xs leading-5 text-[var(--warning)]">We compare your count with cash payments recorded for this date and preserve any difference in the audit trail.</p>
        </div>
        <Input label="Business date" type="date" required value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} />
        <Input label="Cash counted" type="number" min="0" step="0.01" inputMode="decimal" required value={counted} onChange={(event) => setCounted(event.target.value)} placeholder="0.00" hint="Enter the actual amount in the cash drawer." />
        <Input label="Reconciliation notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional handover or discrepancy context" />
        <Button type="submit" loading={loading} className="w-full">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>
          Save reconciliation
        </Button>

        {result && (
          <section className={`rounded-xl border p-4 ${hasDiscrepancy ? "border-[var(--danger-border)] bg-[var(--danger-bg)]" : "border-[var(--success-border)] bg-[var(--success-bg)]"}`} aria-live="polite">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`font-semibold ${hasDiscrepancy ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>{hasDiscrepancy ? "Discrepancy recorded" : "Drawer balanced"}</p>
                <p className={`mt-0.5 text-xs ${hasDiscrepancy ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>Business date: {result.business_date}</p>
              </div>
              <Badge tone={hasDiscrepancy ? "danger" : "success"}>{hasDiscrepancy ? "Review needed" : "Matched"}</Badge>
            </div>
            <dl className="mt-4 space-y-2.5 border-y border-current/10 py-3 text-sm">
              <AmountRow label="Recorded cash" value={money(result.system_total)} />
              <AmountRow label="Cash counted" value={money(result.counted_total)} />
              <AmountRow label="Difference" value={money(result.discrepancy)} emphasis />
            </dl>
            {result.alert_triggered && <p className="mt-3 text-xs font-medium text-[var(--danger)]">Owner alerted: this is the third discrepancy recorded within 30 days.</p>}
          </section>
        )}
      </form>
    </Card>
  );
}

function AmountRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={emphasis ? "font-semibold" : "text-[var(--foreground-muted)]"}>{label}</dt>
      <dd className={`tabular-nums ${emphasis ? "font-bold" : "font-medium"}`}>{value}</dd>
    </div>
  );
}
