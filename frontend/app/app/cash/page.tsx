"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Avatar, Badge, Button, Card, CardHeader, Input, Select, Spinner } from "@/components/ui";
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

/* ─── Member Combobox ─── */

function MemberCombobox({ members, value, onChange }: { members: MemberDirectoryItem[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = members.find((m) => m.member_id === value);

  const filtered = useMemo(
    () => members.filter((m) => {
      const q = query.toLowerCase();
      const name = (m.full_name ?? "").toLowerCase();
      return name.includes(q) || m.email.toLowerCase().includes(q);
    }).slice(0, 30),
    [members, query],
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(member: MemberDirectoryItem) {
    onChange(member.member_id);
    setOpen(false);
    setQuery("");
  }

  if (selected) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">Member</p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={selected.full_name || selected.email} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--foreground)]">{selected.full_name || selected.email}</p>
              <p className="truncate text-xs text-[var(--foreground-muted)]">{selected.email}</p>
            </div>
            <Badge tone={selected.member_status === "active" ? "success" : "warning"}>{selected.member_status}</Badge>
          </div>
          <button
            type="button"
            onClick={() => { onChange(""); setQuery(""); }}
            className="shrink-0 rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-[var(--foreground)]"
            title="Change member"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">Member</p>
      <input
        ref={inputRef}
        type="text"
        required
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search member by name or email…"
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none transition-colors focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)]"
      />
      {open && query.length > 0 && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg">
          {filtered.map((m) => (
            <button
              key={m.member_id}
              type="button"
              onClick={() => select(m)}
              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--background)]"
            >
              <Avatar name={m.full_name || m.email} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--foreground)]">{m.full_name || m.email}</p>
                <p className="truncate text-xs text-[var(--foreground-muted)]">{m.email}</p>
              </div>
              <Badge tone={m.member_status === "active" ? "success" : "warning"}>{m.member_status}</Badge>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3.5 py-3 text-sm text-[var(--muted)]">No members found</p>
          )}
        </div>
      )}
      {open && query.length > 0 && filtered.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-sm text-[var(--foreground-muted)] shadow-lg">
          No members match &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}

/* ─── Payment Method Card ─── */

const METHOD_ICONS: Record<string, string> = {
  cash: "M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  bank_transfer: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z",
  mobile_wallet: "M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3",
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  mobile_wallet: "Mobile wallet",
};

function MethodCard({ value, selected, onSelect }: { value: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-1 items-center gap-2 rounded-lg border-2 px-3 py-2 transition-all ${
        selected
          ? "border-[var(--primary)] bg-[var(--primary-light)]"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--background)]"
      }`}
    >
      <svg className={`h-4 w-4 shrink-0 ${selected ? "text-[var(--primary)]" : "text-[var(--muted)]"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={METHOD_ICONS[value]} />
      </svg>
      <span className={`text-[11px] font-semibold leading-none ${selected ? "text-[var(--primary)]" : "text-[var(--foreground-muted)]"}`}>
        {METHOD_LABELS[value]}
      </span>
    </button>
  );
}

/* ─── Plan Card ─── */

function PlanCard({ plan, selected, onSelect }: { plan: PlanOut; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center justify-between gap-4 rounded-xl border-2 p-4 text-left transition-all ${
        selected
          ? "border-[var(--primary)] bg-[var(--primary-light)] shadow-sm"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--background)]"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${selected ? "text-[var(--foreground)]" : "text-[var(--foreground)]"}`}>{plan.name}</p>
        {plan.public_description && (
          <p className="mt-0.5 truncate text-xs text-[var(--foreground-muted)]">{plan.public_description}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className={`text-base font-bold ${selected ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>
          {money(plan.price, plan.currency)}
        </p>
        <Badge tone="neutral">{plan.billing_type.replace(/_/g, " ")}</Badge>
      </div>
    </button>
  );
}

/* ─── Success Panel ─── */

function SuccessPanel({ result, onDismiss }: { result: CashPaymentOut; onDismiss: () => void }) {
  return (
    <div className="animate-fade-in rounded-xl border border-[var(--success-border)] bg-[var(--success-bg)] p-5 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success)]/10">
        <svg className="h-6 w-6 text-[var(--success)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-lg font-semibold text-[var(--foreground)]">Payment recorded</p>
      <p className="mt-1 text-sm text-[var(--foreground-muted)]">
        <span className="font-semibold text-[var(--foreground)]">{money(result.amount)}</span> logged · Membership is <span className="font-semibold text-[var(--success)] capitalize">{result.member_status}</span>
      </p>
      {result.receipt_pdf_url && (
        <a
          href={result.receipt_pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--primary)] hover:underline"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download receipt
        </a>
      )}
      <button
        type="button"
        onClick={onDismiss}
        className="mt-4 text-xs font-medium text-[var(--muted)] underline underline-offset-2 hover:text-[var(--foreground)]"
      >
        Record another payment
      </button>
    </div>
  );
}

/* ─── LogPayment ─── */

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

  const memberOptions = useMemo(() => members?.filter((m) => m.role === "member") ?? [], [members]);
  const selectedPlan = plans.find((p) => p.id === planId);

  useEffect(() => {
    async function load() {
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
    }
    void load();
  }, []);

  function selectPlan(id: string) {
    setPlanId(id);
    const plan = plans.find((p) => p.id === id);
    if (plan) setAmount(String(plan.price));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { setError("Enter a valid amount."); return; }

    setError("");
    setResult(null);
    setLoading(true);
    try {
      const out = await api.post<CashPaymentOut>("/cash/log", {
        member_id: memberId, plan_id: planId, amount: amt, method, note: note.trim() || null,
      });
      setResult(out);
      setMemberId(""); setPlanId(""); setAmount(""); setNote("");
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  const methods = ["cash", "bank_transfer", "mobile_wallet"];

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Log a payment"
        subtitle="Activate a member and send their payment receipt in one step"
        action={<Badge tone="info">Front desk</Badge>}
      />

      {members === null ? (
        <Spinner label="Loading members and plans…" />
      ) : result ? (
        <div className="p-5 sm:p-6">
          <SuccessPanel result={result} onDismiss={() => setResult(null)} />
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-6 p-5 sm:p-6">
          {error && <Alert onDismiss={() => setError("")}>{error}</Alert>}

          {/* Step 1: Find member */}
          <div>
            <MemberCombobox members={memberOptions} value={memberId} onChange={setMemberId} />
          </div>

          {/* Step 2: Pick plan */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">Membership plan</p>
            <div className="grid gap-2.5">
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} selected={planId === plan.id} onSelect={() => selectPlan(plan.id)} />
              ))}
            </div>
          </div>

          {/* Step 3: Amount + Method */}
          <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
            <Input
              label="Amount received"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              hint={selectedPlan ? `Plan price: ${money(selectedPlan.price, selectedPlan.currency)}` : "Enter the amount actually received."}
              className="text-lg font-semibold tabular-nums [&_input]:text-lg [&_input]:font-semibold"
            />
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-muted)]">Method</p>
              <div className="flex gap-2">
                {methods.map((m) => (
                  <MethodCard key={m} value={m} selected={method === m} onSelect={() => setMethod(m)} />
                ))}
              </div>
            </div>
          </div>

          {/* Step 4: Note */}
          <Input
            label="Internal note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reference number or handover detail"
            hint="Visible to your team, not the member."
          />

          {/* Submit */}
          <div className="flex flex-col-reverse gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-[var(--foreground-muted)]">
              The member is activated immediately. Confirm the amount before saving.
            </p>
            <Button type="submit" loading={loading} disabled={!memberId || !planId} className="w-full sm:w-auto">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Record payment
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

/* ─── Reconcile ─── */

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
        <Input label="Business date" type="date" required value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
        <Input label="Cash counted" type="number" min="0" step="0.01" inputMode="decimal" required value={counted} onChange={(e) => setCounted(e.target.value)} placeholder="0.00" hint="Enter the actual amount in the cash drawer." />
        <Input label="Reconciliation notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional handover or discrepancy context" />
        <Button type="submit" loading={loading} className="w-full">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
          </svg>
          Save reconciliation
        </Button>

        {result && (
          <section
            className={`animate-fade-in rounded-xl border p-4 ${hasDiscrepancy ? "border-[var(--danger-border)] bg-[var(--danger-bg)]" : "border-[var(--success-border)] bg-[var(--success-bg)]"}`}
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`font-semibold ${hasDiscrepancy ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>
                  {hasDiscrepancy ? "Discrepancy recorded" : "Drawer balanced"}
                </p>
                <p className={`mt-0.5 text-xs ${hasDiscrepancy ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>
                  Business date: {result.business_date}
                </p>
              </div>
              <Badge tone={hasDiscrepancy ? "danger" : "success"}>
                {hasDiscrepancy ? "Review needed" : "Matched"}
              </Badge>
            </div>
            <dl className="mt-4 space-y-2.5 border-y border-current/10 py-3 text-sm">
              <AmountRow label="Recorded cash" value={money(result.system_total)} />
              <AmountRow label="Cash counted" value={money(result.counted_total)} />
              <AmountRow label="Difference" value={money(result.discrepancy)} emphasis />
            </dl>
            {result.alert_triggered && (
              <p className="mt-3 text-xs font-medium text-[var(--danger)]">
                Owner alerted: this is the third discrepancy recorded within 30 days.
              </p>
            )}
          </section>
        )}
      </form>
    </Card>
  );
}

/* ─── Small helpers ─── */

function AmountRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={emphasis ? "font-semibold text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}>{label}</dt>
      <dd className={`tabular-nums ${emphasis ? "font-bold text-[var(--foreground)]" : "font-medium"}`}>{value}</dd>
    </div>
  );
}
