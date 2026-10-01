"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, EmptyState, Spinner } from "@/components/ui";
import { ListToolbar } from "@/components/ListToolbar";
import { ReadValue, Row, Section, SectionBody, SubHeading } from "@/components/settings/primitives";
import { api, ApiError } from "@/lib/api";
import { money, statusTone, titleCase } from "@/lib/format";
import type { InvoiceOut, SaasStatusOut } from "@/lib/types";

const TIERS = ["starter", "pro", "enterprise"];

export default function BillingPage({ embedded = false }: { embedded?: boolean }) {
  const [status, setStatus] = useState<SaasStatusOut | null>(null);
  const [invoices, setInvoices] = useState<InvoiceOut[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("all");

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

  const allInvoices = invoices ?? [];

  const invoiceTabs = [
    { value: "all", label: "All", count: allInvoices.length },
    ...Array.from(new Set(allInvoices.map((i) => i.status))).map((s) => ({
      value: s,
      label: titleCase(s),
      count: allInvoices.filter((i) => i.status === s).length,
    })),
  ];

  const invoiceQ = invoiceSearch.trim().toLowerCase();
  const filteredInvoices = allInvoices.filter((i) => {
    if (invoiceStatus !== "all" && i.status !== invoiceStatus) return false;
    if (!invoiceQ) return true;
    return i.status.toLowerCase().includes(invoiceQ) || new Date(i.created_at).toLocaleDateString().toLowerCase().includes(invoiceQ);
  });

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

  const body = status && (
    <>
      <Row label="Current tier" description="Your SaaS plan">
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm font-medium text-foreground">{titleCase(status.saas_tier)}</span>
          <Badge tone={statusTone(status.saas_status)}>{titleCase(status.saas_status)}</Badge>
        </div>
      </Row>
      <Row label="Members" description="Active members against your seat cap">
        <ReadValue>
          {status.current_member_count}
          {status.member_cap !== null ? ` / ${status.member_cap}` : " / Unlimited"}
        </ReadValue>
      </Row>
      <Row label="Renews" description="Next billing date">
        <ReadValue>
          {status.current_period_end ? new Date(status.current_period_end).toLocaleDateString() : "—"}
        </ReadValue>
      </Row>

      {status.saas_status === "past_due" && (
        <Row
          label="Payment failed"
          description={
            status.retry_count > 0
              ? `Stripe has retried ${status.retry_count} time${status.retry_count === 1 ? "" : "s"}. Grace ends ${status.grace_until ? new Date(status.grace_until).toLocaleDateString() : "soon"}.`
              : "Update your card to resume normal service."
          }
        >
          <div className="flex justify-end">
            <Button
              variant="secondary"
              onClick={() => alert("Configure your payment method (Stripe customer portal integration pending).")}
            >
              Update card
            </Button>
          </div>
        </Row>
      )}
      {status.saas_status === "read_only" && (
        <Row label="Read-only mode" description="Write access is blocked until the subscription is renewed.">
          <div className="flex justify-end"><Badge tone="warning">Limited</Badge></div>
        </Row>
      )}
      {status.saas_status === "suspended" && (
        <Row label="Account suspended" description="Contact support to restore access.">
          <div className="flex justify-end"><Badge tone="danger">Suspended</Badge></div>
        </Row>
      )}
      {status.saas_status === "cancelled" && (
        <Row label="Subscription cancelled" description="Your data is archived at the end of the retention period.">
          <div className="flex justify-end"><Badge tone="neutral">Cancelled</Badge></div>
        </Row>
      )}

      <div className="pt-4">
        <SubHeading>Change plan</SubHeading>
        <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
          Upgrade is immediate; downgrade is blocked if usage exceeds the lower cap.
        </p>
      </div>
      {TIERS.map((tier, idx) => {
        const isCurrent = idx === currentIdx;
        const isUpgrade = idx > currentIdx;
        return (
          <Row
            key={tier}
            label={titleCase(tier)}
            description={isCurrent ? "Your current plan" : isUpgrade ? "Move up to unlock more" : "Move down to a smaller cap"}
          >
            <div className="flex justify-end">
              {isCurrent ? (
                <Badge tone="info">Current</Badge>
              ) : (
                <Button
                  variant={isUpgrade ? "primary" : "secondary"}
                  loading={busy}
                  onClick={() => changeTier(tier, isUpgrade ? "upgrade" : "downgrade")}
                >
                  {isUpgrade ? "Upgrade" : "Downgrade"}
                </Button>
              )}
            </div>
          </Row>
        );
      })}

      <div className="py-4">
        <SubHeading>Invoices</SubHeading>
        <ListToolbar
          tabs={invoiceTabs}
          value={invoiceStatus}
          onChange={setInvoiceStatus}
          search={invoiceSearch}
          onSearch={setInvoiceSearch}
          searchPlaceholder="Search invoices…"
        />
        {/* Table surface: hairline border, square corners, flat background. */}
        <div className="mt-3 border border-foreground/10 bg-card">
          {invoices === null ? (
            <Spinner label="Loading invoices..." />
          ) : filteredInvoices.length === 0 ? (
            <EmptyState
              title="No invoices yet"
              hint={
                invoices.length === 0
                  ? "Your invoices will appear here."
                  : "No invoices match the current filter."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left font-mono text-[10px] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">
                  <tr className="border-b border-foreground/10">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/[0.06]">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="transition-colors hover:bg-[var(--background)]">
                      <td className="px-5 py-3.5">{new Date(inv.created_at).toLocaleDateString()}</td>
                      <td className="px-5 py-3.5 tabular-nums font-medium">{money(inv.amount, inv.currency)}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={statusTone(inv.status)}>{titleCase(inv.status)}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <a
                          href={`/api/download/saas-billing/invoices/${inv.id}/pdf`}
                          download
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                          PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (embedded) {
    return (
      <>
        {error && <div className="mb-4"><Alert>{error}</Alert></div>}
        {status === null ? (
          <Spinner label="Loading billing info..." />
        ) : (
          <Section id="billing" title="Subscription" description="Your platform plan and invoices">
            {body}
          </Section>
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader title="Billing" subtitle="Your platform subscription & invoices" />
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {status === null ? (
        <Spinner label="Loading billing info..." />
      ) : (
        <SectionBody>{body}</SectionBody>
      )}
    </>
  );
}
