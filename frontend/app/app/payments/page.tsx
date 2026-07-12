"use client";

import { useEffect, useState } from "react";
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
    load();
  }, []);

  const refundable = (p: PaymentOut) =>
    p.status === "succeeded" && p.method === "card" && p.refunded_amount < p.amount;

  return (
    <>
      <PageHeader title="Payments" subtitle="All money events for this gym — refunds are web-only" />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {refundFor && (
        <div className="mb-6">
          <RefundForm
            payment={refundFor}
            onClose={() => setRefundFor(null)}
            onDone={() => {
              setRefundFor(null);
              load();
            }}
          />
        </div>
      )}

      <Card>
        <CardHeader title="Payment history" subtitle={payments ? `${payments.length} total` : undefined} />
        {payments === null ? (
          <Spinner />
        ) : payments.length === 0 ? (
          <EmptyState title="No payments yet" hint="Member and cash payments will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Kind</th>
                  <th className="px-5 py-3 font-medium">Method</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Refunded</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/60">
                    <td className="px-5 py-3 whitespace-nowrap">{(p.paid_at || p.created_at).slice(0, 10)}</td>
                    <td className="px-5 py-3">{titleCase(p.kind)}</td>
                    <td className="px-5 py-3">{titleCase(p.method)}</td>
                    <td className="px-5 py-3 tabular-nums">{money(p.amount, p.currency)}</td>
                    <td className="px-5 py-3 tabular-nums">
                      {p.refunded_amount > 0 ? money(p.refunded_amount, p.currency) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone(p.status)}>{titleCase(p.status)}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {refundable(p) && (
                        <Button variant="ghost" onClick={() => setRefundFor(p)}>Refund</Button>
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
      });
      onDone();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Process refund" subtitle={`Up to ${money(max, payment.currency)} available`} />
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
        {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
        <Input label="Amount" type="number" min="0" step="0.01" max={String(max)} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
        <div className="sm:col-span-2 flex gap-2">
          <Button type="submit" variant="danger" loading={loading}>Refund</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
