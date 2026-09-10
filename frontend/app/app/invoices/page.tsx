"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Dialog } from "@/components/Dialog";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, Card, CardHeader, CategoryTabs, EmptyState, Input, Select, Spinner } from "@/components/ui";
import { KebabMenu } from "@/components/KebabMenu";
import { useModuleGate } from "@/hooks/useModuleGate";
import { api, ApiError } from "@/lib/api";
import { fmtDate, invoiceLabel, invoiceTone, money, titleCase } from "@/lib/format";
import type { CompanyListItem, OfficeInvoiceOut, OfficeInvoicePaymentOut } from "@/lib/types";

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><Spinner /></div>}>
      <InvoicesContent />
    </Suspense>
  );
}

function InvoicesContent() {
  const search = useSearchParams();
  const { org, ready } = useModuleGate("invoices");
  const currency = org?.default_currency ?? "USD";

  const [invoices, setInvoices] = useState<OfficeInvoiceOut[] | null>(null);
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState(search?.get("company_id") ?? "");
  const [searchQ, setSearchQ] = useState("");

  const [viewing, setViewing] = useState<OfficeInvoiceOut | null>(null);
  const [payments, setPayments] = useState<OfficeInvoicePaymentOut[] | null>(null);
  const [payFor, setPayFor] = useState<OfficeInvoiceOut | null>(null);
  const [confirmVoid, setConfirmVoid] = useState<OfficeInvoiceOut | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (companyFilter) params.set("company_id", companyFilter);
      const qs = params.toString();
      const [inv, comp] = await Promise.all([
        api.get<OfficeInvoiceOut[]>(`/invoices${qs ? `?${qs}` : ""}`),
        api.get<CompanyListItem[]>("/companies"),
      ]);
      setInvoices(inv);
      setCompanies(comp);
    } catch (e) {
      setError((e as ApiError).message);
      setInvoices([]);
    }
  }, [statusFilter, companyFilter]);

  useEffect(() => {
    if (ready) queueMicrotask(() => void load());
  }, [ready, load]);

  // Deep-link ?invoice=<id> from a company page opens that invoice's detail.
  useEffect(() => {
    const id = search?.get("invoice");
    if (ready && id && invoices) {
      const found = invoices.find((i) => i.id === id);
      if (found) {
        setViewing(found);
        api.get<OfficeInvoicePaymentOut[]>(`/invoices/${found.id}/payments`).then(setPayments).catch(() => setPayments([]));
      }
    }
  }, [ready, search, invoices]);

  async function act(id: string, action: string) {
    setError("");
    try {
      await api.post(`/invoices/${id}/${action}`);
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function openDetail(inv: OfficeInvoiceOut) {
    setViewing(inv);
    setPayments(null);
    api.get<OfficeInvoicePaymentOut[]>(`/invoices/${inv.id}/payments`).then(setPayments).catch(() => setPayments([]));
  }

  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? id;

  const filtered = useMemo(() => {
    if (invoices === null) return null;
    const q = searchQ.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((i) => i.invoice_number.toLowerCase().includes(q) || (i.company_name ?? "").toLowerCase().includes(q));
  }, [invoices, searchQ]);

  const companyOptions = useMemo(() => {
    // Companies that have any invoice, plus everything if a filter is applied.
    const withInvoices = new Set(invoices?.map((i) => i.company_id) ?? []);
    return companies.filter((c) => companyFilter || withInvoices.has(c.id));
  }, [companies, invoices, companyFilter]);

  if (!ready) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Spinner /></div>;
  }

  return (
    <>
      <PageHeader title="Invoices" subtitle={invoices ? `${invoices.length} shown` : "B2B invoices to companies"} />

      {error && <div className="mb-5"><Alert>{error}</Alert></div>}

      <Card>
        <CardHeader title="Invoices" subtitle={invoices ? `${filtered?.length ?? 0} results` : undefined} />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 px-5 pb-5 pt-4">
          {/* Fixed-width track: 7 statuses overflow on purpose and scroll horizontally. */}
          <div className="w-full sm:w-auto sm:max-w-[26rem]">
            <CategoryTabs
              tabs={[
                { value: "all", label: "All" },
                { value: "draft", label: "Draft" },
                { value: "sent", label: "Sent" },
                { value: "partial", label: "Part paid" },
                { value: "overdue", label: "Overdue" },
                { value: "paid", label: "Paid" },
                { value: "void", label: "Void" },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </div>
          <Select aria-label="Company" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} size="sm" className="w-52">
            <option value="">All companies</option>
            {companyOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div className="relative ml-auto w-full max-w-xs">
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search invoice # or company..."
              className="w-full rounded-full border border-foreground/20 bg-transparent h-[38px] px-4 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-colors hover:border-foreground/35 focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
        </div>

        {filtered === null ? (
          <Spinner label="Loading invoices..." />
        ) : filtered.length === 0 ? (
          <div className="px-5 pb-10">
            <EmptyState
              title={invoices?.length === 0 ? "No invoices yet" : "No matching invoices"}
              hint={invoices?.length === 0 ? "Signing a company onto a space plan drafts the first invoice automatically." : "Try a different filter or search."}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left font-mono text-[11px] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-5 py-3 font-medium">Invoice</th>
                  <th className="px-5 py-3 font-medium">Company</th>
                  <th className="px-5 py-3 font-medium">Due</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Total</th>
                  <th className="px-5 py-3 font-medium">Paid</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="group transition-colors hover:bg-[var(--background)]/50">
                    <td className="px-5 py-3.5">
                      <button type="button" onClick={() => void openDetail(inv)} className="font-mono text-xs font-medium text-[var(--foreground)] hover:underline">
                        {inv.invoice_number}
                      </button>
                      <div className="mt-0.5 text-[11px] text-[var(--muted)]">issued {fmtDate(inv.issue_date)}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link href={`/app/companies/${inv.company_id}`} className="text-[var(--foreground)] hover:underline">
                        {inv.company_name ?? companyName(inv.company_id)}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-[var(--foreground-muted)]">{fmtDate(inv.due_date)}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={invoiceTone(inv.status)}>{invoiceLabel(inv.status)}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="tabular-nums font-semibold text-[var(--foreground)]">{money(inv.total, inv.currency)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {inv.paid_amount > 0 ? (
                        <span className="tabular-nums text-[var(--foreground-muted)]">{money(inv.paid_amount, inv.currency)}</span>
                      ) : <span className="text-[var(--muted)]">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <KebabMenu
                        actions={[
                          { label: "View", onClick: () => void openDetail(inv) },
                          ...(inv.status === "draft"
                            ? [{ label: "Send", onClick: () => void act(inv.id, "send") }]
                            : []),
                          ...(["sent", "partial", "overdue"].includes(inv.status)
                            ? [
                                { label: "Record payment", onClick: () => setPayFor(inv) },
                                { label: "Void", danger: true, onClick: () => setConfirmVoid(inv) },
                              ]
                            : []),
                          ...(inv.status === "void"
                            ? [{ label: "Reopen", onClick: () => void act(inv.id, "reopen") }]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title={viewing?.invoice_number ?? ""} subtitle="Invoice details" className="max-w-xl">
        {viewing && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="block text-[var(--foreground)]">{viewing.company_name ?? "Company"}</span>
                <span className="text-xs text-[var(--muted)]">Due {fmtDate(viewing.due_date)} · {titleCase(viewing.currency)}</span>
              </div>
              <Badge tone={invoiceTone(viewing.status)}>{invoiceLabel(viewing.status)}</Badge>
            </div>

            <div className="rounded-lg border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--border)] text-left font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
                  <tr><th className="px-4 py-2 font-medium">Description</th><th className="px-4 py-2 text-right font-medium">Amount</th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {viewing.line_items.map((li, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2.5 text-[var(--foreground)]">{String((li as { description?: unknown }).description ?? "")}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[var(--foreground)]">
                        {money(Number((li as { amount?: unknown }).amount ?? 0), viewing.currency)}
                      </td>
                    </tr>
                  ))}
                  {viewing.tax_amount > 0 && (
                    <tr><td className="px-4 py-2 text-[var(--muted)]">Tax</td><td className="px-4 py-2 text-right tabular-nums text-[var(--muted)]">{money(viewing.tax_amount, viewing.currency)}</td></tr>
                  )}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
                <span className="text-xs font-medium uppercase tracking-widest text-[var(--muted)]">Total</span>
                <span className="tabular-nums text-base font-bold text-[var(--foreground)]">{money(viewing.total, viewing.currency)}</span>
              </div>
            </div>

            {payments && payments.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-medium uppercase tracking-widest text-[var(--muted)]">Payments received</div>
                <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                  {payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
                      <span className="text-[var(--foreground-muted)]">
                        {titleCase(p.method)} · {fmtDate(p.paid_at)}
                      </span>
                      <span className="tabular-nums font-semibold text-[var(--foreground)]">{money(p.amount, p.currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
              {["sent", "partial", "overdue"].includes(viewing.status) && (
                <Button variant="primary" onClick={() => { setViewing(null); setPayFor(viewing); }}>Record payment</Button>
              )}
              <Button variant="ghost" onClick={() => setViewing(null)}>Close</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Record payment dialog */}
      <Dialog open={!!payFor} onClose={() => setPayFor(null)} title="Record payment" subtitle="Offline settlement — bank transfer or cash" className="max-w-md">
        {payFor && (
          <RecordPaymentForm
            invoice={payFor}
            currency={currency}
            onDone={() => { setPayFor(null); load(); }}
          />
        )}
      </Dialog>

      {/* Void confirm */}
      <Dialog open={!!confirmVoid} onClose={() => setConfirmVoid(null)} title="Void invoice" className="max-w-sm">
        <p className="mb-6 text-sm text-[var(--foreground-muted)]">
          Void <strong className="font-mono text-[var(--foreground)]">{confirmVoid?.invoice_number}</strong>? It can be reopened later. Invoices with payments need a refund instead.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmVoid(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => { const id = confirmVoid?.id; setConfirmVoid(null); if (id) void act(id, "void"); }}>Void invoice</Button>
        </div>
      </Dialog>
    </>
  );
}

function RecordPaymentForm({ invoice, currency, onDone }: {
  invoice: OfficeInvoiceOut; currency: string; onDone: () => void;
}) {
  const [method, setMethod] = useState("bank_transfer");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const remaining = Math.max(0, invoice.total - invoice.paid_amount);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post(
        `/invoices/${invoice.id}/record-payment`,
        {
          method,
          amount: amount === "" ? null : parseFloat(amount),
          paid_on: paidOn || null,
          note: note || null,
        },
        { "Idempotency-Key": crypto.randomUUID() },
      );
      onDone();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <Alert>{error}</Alert>}
      <p className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 text-sm text-[var(--foreground-muted)]">
        {invoice.invoice_number} · balance due{" "}
        <span className="tabular-nums font-semibold text-[var(--foreground)]">{money(remaining, currency)}</span>
      </p>
      <Select label="Method" value={method} onChange={(e) => setMethod(e.target.value)}>
        <option value="bank_transfer">Bank transfer</option>
        <option value="cash">Cash</option>
      </Select>
      <div className="grid grid-cols-2 gap-4">
        <Input label={`Amount (leave blank for full)`} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input label="Paid on" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
      </div>
      <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Wire ref / receipt no." />
      <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-5">
        <Button type="submit" loading={loading} size="lg">Record payment</Button>
      </div>
    </form>
  );
}
