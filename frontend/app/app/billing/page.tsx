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
    queueMicrotask(() => void load());
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
        <Spinner label="Loading billing info..." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card hover className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--muted)]">Current tier</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xl font-bold text-[var(--foreground)]">{titleCase(status.saas_tier)}</span>
                    <Badge tone={statusTone(status.saas_status)}>{titleCase(status.saas_status)}</Badge>
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary-light)]">
                  <svg className="h-5 w-5 text-[var(--primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
                </div>
              </div>
            </Card>
            <Card hover className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--muted)]">Members</p>
                  <p className="mt-2 text-xl font-bold tabular-nums text-[var(--foreground)]">
                    {status.current_member_count}
                    {status.member_cap !== null && <span className="text-sm font-normal text-[var(--muted)]"> / {status.member_cap}</span>}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--success-bg)]">
                  <svg className="h-5 w-5 text-[var(--success)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
                </div>
              </div>
            </Card>
            <Card hover className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--muted)]">Renews</p>
                  <p className="mt-2 text-xl font-bold text-[var(--foreground)]">
                    {status.current_period_end
                      ? new Date(status.current_period_end).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-light)]">
                  <svg className="h-5 w-5 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                </div>
              </div>
            </Card>
          </div>

          <div className="mt-6">
            <Card>
              <CardHeader title="Change plan" subtitle="Upgrade is immediate; downgrade blocked if usage exceeds the lower cap" />
              <div className="grid gap-4 p-6 sm:grid-cols-3">
                {TIERS.map((tier, idx) => {
                  const isCurrent = idx === currentIdx;
                  const isUpgrade = idx > currentIdx;
                  return (
                    <div
                      key={tier}
                      className={`rounded-[var(--radius-lg)] border-2 p-5 transition-all duration-150 ${
                        isCurrent
                          ? "border-[var(--primary)] bg-[var(--primary-light)]"
                          : "border-[var(--border)] hover:border-[var(--border-strong)] hover:shadow-xs"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-[var(--foreground)]">{titleCase(tier)}</div>
                        {isCurrent && (
                          <Badge tone="info">Current</Badge>
                        )}
                      </div>
                      <div className="mt-4">
                        {!isCurrent && (
                          <Button
                            variant={isUpgrade ? "primary" : "secondary"}
                            loading={busy}
                            size="sm"
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

          <div className="mt-6">
            <Card>
              <CardHeader title="Invoice history" />
              {invoices === null ? (
                <Spinner label="Loading invoices..." />
              ) : invoices.length === 0 ? (
                <EmptyState title="No invoices yet" hint="Your invoices will appear here." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-6 py-3.5">Date</th>
                        <th className="px-6 py-3.5">Amount</th>
                        <th className="px-6 py-3.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="transition-colors hover:bg-[var(--background)]">
                          <td className="px-6 py-4">{new Date(inv.created_at).toLocaleDateString()}</td>
                          <td className="px-6 py-4 tabular-nums font-medium">{money(inv.amount, inv.currency)}</td>
                          <td className="px-6 py-4">
                            <Badge tone={statusTone(inv.status)}>{titleCase(inv.status)}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
