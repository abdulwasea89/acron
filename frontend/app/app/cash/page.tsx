"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, Card, CardHeader, Input, Select, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import type { CashPaymentOut, MemberDirectoryItem, PlanOut, ReconciliationOut } from "@/lib/types";

export default function CashPage() {
  return (
    <>
      <PageHeader
        title="Cash & offline payments"
        subtitle="Log payments taken at the front desk, then reconcile the drawer at end of day"
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <LogPayment />
        <Reconcile />
      </div>
    </>
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

  useEffect(() => {
    (async () => {
      try {
        const [m, p] = await Promise.all([
          api.get<MemberDirectoryItem[]>("/members"),
          api.get<PlanOut[]>("/plans"),
        ]);
        setMembers(m);
        setPlans(p);
      } catch (e) {
        setError((e as ApiError).message);
        setMembers([]);
      }
    })();
  }, []);

  // Default the amount to the chosen plan's price for convenience.
  function pickPlan(id: string) {
    setPlanId(id);
    const plan = plans.find((p) => p.id === id);
    if (plan && !amount) setAmount(String(plan.price));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const out = await api.post<CashPaymentOut>("/cash/log", {
        member_id: memberId,
        plan_id: planId,
        amount: parseFloat(amount) || 0,
        method,
        note: note || null,
      });
      setResult(out);
      setAmount("");
      setNote("");
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Log a payment" subtitle="Activates the member and emails a receipt" />
      {members === null ? (
        <Spinner />
      ) : (
        <form onSubmit={submit} className="grid gap-4 p-5">
          {error && <Alert>{error}</Alert>}
          {result && (
            <Alert tone="success">
              Logged {money(result.amount)} — member is now {result.member_status}.
            </Alert>
          )}
          <Select label="Member" required value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">Select a member…</option>
            {members
              .filter((m) => m.role === "member")
              .map((m) => (
                <option key={m.member_id} value={m.member_id}>
                  {m.full_name || m.email} ({m.member_status})
                </option>
              ))}
          </Select>
          <Select label="Plan" required value={planId} onChange={(e) => pickPlan(e.target.value)}>
            <option value="">Select a plan…</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {money(p.price, p.currency)}
              </option>
            ))}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Amount" type="number" min="0" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Select label="Method" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="mobile_wallet">Mobile wallet</option>
            </Select>
          </div>
          <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reference, who took it, etc." />
          <Button type="submit" loading={loading} disabled={!memberId || !planId}>Log payment</Button>
        </form>
      )}
    </Card>
  );
}

function Reconcile() {
  const today = new Date().toISOString().slice(0, 10);
  const [businessDate, setBusinessDate] = useState(today);
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ReconciliationOut | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const out = await api.post<ReconciliationOut>("/cash/reconcile", {
        business_date: businessDate,
        counted_total: parseFloat(counted) || 0,
        notes: notes || null,
      });
      setResult(out);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader title="End-of-day reconciliation" subtitle="Count the drawer against what was logged" />
      <form onSubmit={submit} className="grid gap-4 p-5">
        {error && <Alert>{error}</Alert>}
        <Input label="Business date" type="date" required value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
        <Input label="Counted total" type="number" min="0" step="0.01" required value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="Actual cash counted" />
        <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button type="submit" loading={loading}>Reconcile</Button>

        {result && (
          <div className="mt-2 rounded-lg border border-[var(--border)] p-4 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-[var(--muted)]">System total</span>
              <span className="tabular-nums">{money(result.system_total)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[var(--muted)]">Counted total</span>
              <span className="tabular-nums">{money(result.counted_total)}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--border)] py-1 font-medium">
              <span>Discrepancy</span>
              <span className={`tabular-nums ${result.discrepancy !== 0 ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>
                {money(result.discrepancy)}
              </span>
            </div>
            {result.alert_triggered && (
              <div className="mt-2">
                <Badge tone="danger">Owner alerted — 3+ discrepancies in 30 days</Badge>
              </div>
            )}
          </div>
        )}
      </form>
    </Card>
  );
}
