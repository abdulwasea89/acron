"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { useRealtimeEvent } from "@/components/Realtime";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money, statusTone, titleCase } from "@/lib/format";
import type { PaymentOut } from "@/lib/types";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentOut[] | null>(null);
  const [error, setError] = useState("");
  const [refundFor, setRefundFor] = useState<PaymentOut | null>(null);

  async function load() {
    setError("");
    try {
      setPayments(await api.get<PaymentOut[]>("/payments"));
    } catch (e) {
      setError((e as ApiError).message);
      setPayments([]);
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  useRealtimeEvent(["payment.recorded"], () => void load());

  // Only member fees (routed through the gym's Connect account) are refundable
  // here. SaaS subscription charges go through the platform account and are
  // managed in billing settings, not refunded on this screen.
  const refundable = (p: PaymentOut) =>
    p.kind === "member_fee" &&
    p.status === "succeeded" &&
    p.method === "card" &&
    p.refunded_amount < p.amount;

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="All money events for this gym — refunds are web-only"
      />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <Dialog open={!!refundFor} onClose={() => setRefundFor(null)} title="Process refund" subtitle={refundFor ? `Up to ${money(refundFor.amount - refundFor.refunded_amount, refundFor.currency)} available` : ""}>
        {refundFor && (
          <RefundForm
            payment={refundFor}
            onClose={() => setRefundFor(null)}
            onDone={() => {
              setRefundFor(null);
              load();
            }}
          />
        )}
      </Dialog>

      <Card>
        <CardHeader title="Payment history" subtitle={payments ? `${payments.length} total` : undefined} />
        {payments === null ? (
          <Spinner label="Loading payments..." />
        ) : payments.length === 0 ? (
          <EmptyState
            title="No payments yet"
            hint="Member and cash payments will appear here."
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
                  <th className="px-6 py-3.5">Kind</th>
                  <th className="px-6 py-3.5">Method</th>
                  <th className="px-6 py-3.5">Amount</th>
                  <th className="px-6 py-3.5">Refunded</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {payments.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-[var(--background)]">
                    <td className="px-6 py-4 whitespace-nowrap tabular-nums">{(p.paid_at || p.created_at).slice(0, 10)}</td>
                    <td className="px-6 py-4 text-[var(--foreground-muted)]">{titleCase(p.kind)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5">
                        {p.method === "card" && <svg className="h-4 w-4 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>}
                        {p.method === "cash" && <svg className="h-4 w-4 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                        {titleCase(p.method)}
                      </span>
                    </td>
                    <td className="px-6 py-4 tabular-nums font-medium text-[var(--foreground)]">{money(p.amount, p.currency)}</td>
                    <td className="px-6 py-4 tabular-nums text-[var(--foreground-muted)]">
                      {p.refunded_amount > 0 ? money(p.refunded_amount, p.currency) : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={statusTone(p.status)}>{titleCase(p.status)}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {refundable(p) && (
                        <Button variant="ghost" size="sm" onClick={() => setRefundFor(p)}>
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
                          Refund
                        </Button>
                      )}
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

function RefundForm({
  payment,
  onClose,
  onDone,
}: {
  payment: PaymentOut;
  onClose: () => void;
  onDone: () => void;
}) {
  const max = payment.amount - payment.refunded_amount;
  const [amount, setAmount] = useState(String(max));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/payments/refund", {
        payment_id: payment.id,
        amount: parseFloat(amount) || null,
        reason: reason || null,
      }, { "Idempotency-Key": crypto.randomUUID() });
      onDone();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
      <Input label="Amount" type="number" min="0" step="0.01" max={String(max)} value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
      <div className="sm:col-span-2 flex gap-2">
        <Button type="submit" variant="danger" loading={loading}>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
          Refund
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
