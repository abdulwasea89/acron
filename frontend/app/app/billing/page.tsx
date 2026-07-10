"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money, statusTone, titleCase } from "@/lib/format";
import type { InvoiceOut, SaasStatusOut } from "@/lib/types";

const TIERS = ["starter", "pro", "enterprise"];

export default function BillingPage() {
  const [status, setStatus] = useState<SaasStatusOut | null>(null);
  const [invoices, setInvoices] = useState<InvoiceOut[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setError("");
    try {
      const [s, inv] = await Promise.all([
        api.get<SaasStatusOut>("/saas-billing/status"),
        api.get<InvoiceOut[]>("/saas-billing/invoices"),
      ]);
      setStatus(s);
      setInvoices(inv);
    } catch (e) {
      setError((e as ApiError).message);
      setInvoices([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function changeTier(tier: string, direction: "upgrade" | "downgrade") {
    setError("");
    setBusy(true);
    try {
      await api.post(`/saas-billing/${direction}`, { tier });
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const currentIdx = status ? TIERS.indexOf(status.saas_tier) : -1;

  return (
    <>
      <PageHeader title="Billing" subtitle="Your platform subscription & invoices" />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {status === null ? (
        <Spinner />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <div className="text-sm text-[var(--muted)]">Current tier</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xl font-semibold">{titleCase(status.saas_tier)}</span>
                <Badge tone={statusTone(status.saas_status)}>{titleCase(status.saas_status)}</Badge>
              </div>
            </Card>
            <Card className="p-5">
              <div className="text-sm text-[var(--muted)]">Members</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">
                {status.current_member_count}
                {status.member_cap !== null && <span className="text-[var(--muted)]"> / {status.member_cap}</span>}
              </div>
            </Card>
            <Card className="p-5">
              <div className="text-sm text-[var(--muted)]">Renews</div>
              <div className="mt-1 text-xl font-semibold">
                {status.current_period_end
                  ? new Date(status.current_period_end).toLocaleDateString()
                  : "—"}
              </div>
            </Card>
          </div>

          <div className="mb-6">
            <Card>
              <CardHeader title="Change plan" subtitle="Upgrade is immediate; downgrade blocked if usage exceeds the lower cap" />
              <div className="grid gap-3 p-5 sm:grid-cols-3">
                {TIERS.map((tier, idx) => {
                  const isCurrent = idx === currentIdx;
                  const isUpgrade = idx > currentIdx;
                  return (
                    <div
                      key={tier}
                      className={`rounded-lg border p-4 ${isCurrent ? "border-[var(--primary)] ring-2 ring-[var(--ring)]" : "border-[var(--border)]"}`}
                    >
                      <div className="text-sm font-semibold">{titleCase(tier)}</div>
                      <div className="mt-3">
                        {isCurrent ? (
                          <Badge>Current</Badge>
                        ) : (
                          <Button
                            variant="secondary"
                            loading={busy}
                            onClick={() => changeTier(tier, isUpgrade ? "upgrade" : "downgrade")}
                          >
                            {isUpgrade ? "Upgrade" : "Downgrade"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Invoice history" />
            {invoices === null ? (
              <Spinner />
            ) : invoices.length === 0 ? (
              <EmptyState title="No invoices yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                    <tr className="border-b border-[var(--border)]">
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">Amount</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="px-5 py-3">{new Date(inv.created_at).toLocaleDateString()}</td>
                        <td className="px-5 py-3 tabular-nums">{money(inv.amount, inv.currency)}</td>
                        <td className="px-5 py-3">
                          <Badge tone={statusTone(inv.status)}>{titleCase(inv.status)}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
