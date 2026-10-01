"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, EmptyState, Input, Select, Spinner } from "@/components/ui";
import { FieldSelect } from "@/components/FieldSelect";
import { SelectItem } from "@/components/ui/select";
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ListToolbar } from "@/components/ListToolbar";
import { RowMenu } from "@/components/RowMenu";
import { TABLE, THEAD_ROW, TH, TR, TD, CELL, CELL_FIRST, CELL_LAST } from "@/components/Table";
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
    if (!ready || !id || !invoices) return;
    const found = invoices.find((i) => i.id === id);
    if (!found) return;
    queueMicrotask(() => {
      setViewing(found);
      api.get<OfficeInvoicePaymentOut[]>(`/invoices/${found.id}/payments`).then(setPayments).catch(() => setPayments([]));
    });
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

      <ListToolbar
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
        search={searchQ}
        onSearch={setSearchQ}
        searchPlaceholder="Search invoices…"
      >
        <Select aria-label="Company" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} size="sm" className="w-44">
          <option value="">All companies</option>
          {companyOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </ListToolbar>

      {/* Table surface: hairline border, square corners, flat background. */}
      <div className="mt-3">
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
            <table className={TABLE}>
              <thead>
                <tr className={THEAD_ROW}>
                  <th className={`${TH} ${CELL_FIRST}`}>Invoice</th>
                  <th className={`${TH} ${CELL}`}>Company</th>
                  <th className={`${TH} ${CELL}`}>Due</th>
                  <th className={`${TH} ${CELL}`}>Status</th>
                  <th className={`${TH} ${CELL}`}>Total</th>
                  <th className={`${TH} ${CELL}`}>Paid</th>
                  <th className={`${TH} ${CELL_LAST} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className={`${TR} group transition-colors hover:bg-[var(--background)]/50`}>
                    <td className={`${TD} ${CELL_FIRST} py-2.5`}>
                      <button type="button" onClick={() => void openDetail(inv)} className="font-mono text-xs font-medium text-[var(--foreground)] hover:underline">
                        {inv.invoice_number}
                      </button>
                      <div className="mt-0.5 text-[10px] text-[var(--muted)]">issued {fmtDate(inv.issue_date)}</div>
                    </td>
                    <td className={`${TD} ${CELL} py-2.5`}>
                      <Link href={`/app/companies/${inv.company_id}`} className="text-[var(--foreground)] hover:underline">
                        {inv.company_name ?? companyName(inv.company_id)}
                      </Link>
                    </td>
                    <td className={`${TD} ${CELL} py-2.5 text-[var(--foreground-muted)]`}>{fmtDate(inv.due_date)}</td>
                    <td className={`${TD} ${CELL} py-2.5`}>
                      <Badge tone={invoiceTone(inv.status)}>{invoiceLabel(inv.status)}</Badge>
                    </td>
                    <td className={`${TD} ${CELL} py-2.5`}>
                      <span className="tabular-nums font-semibold text-[var(--foreground)]">{money(inv.total, inv.currency)}</span>
                    </td>
                    <td className={`${TD} ${CELL} py-2.5`}>
                      {inv.paid_amount > 0 ? (
                        <span className="tabular-nums text-[var(--foreground-muted)]">{money(inv.paid_amount, inv.currency)}</span>
                      ) : <span className="text-[var(--muted)]">—</span>}
                    </td>
                    <td className={`${TD} ${CELL_LAST} py-2.5 text-right`}>
                      <RowMenu
                        actions={[
                          { label: "View", onSelect: () => void openDetail(inv) },
                          ...(inv.status === "draft"
                            ? [{ label: "Send", onSelect: () => void act(inv.id, "send") }]
                            : []),
                          ...(["sent", "partial", "overdue"].includes(inv.status)
                            ? [
                                { label: "Record payment", onSelect: () => setPayFor(inv) },
                                { label: "Void", variant: "destructive" as const, onSelect: () => setConfirmVoid(inv) },
                              ]
                            : []),
                          ...(inv.status === "void"
                            ? [{ label: "Reopen", onSelect: () => void act(inv.id, "reopen") }]
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
      </div>

      {/* Detail is read-only and belongs beside the list, so it rides in a sheet
          instead of blanking the table out behind a modal. */}
      <Sheet open={!!viewing} onOpenChange={(open) => { if (!open) setViewing(null); }}>
        <SheetContent className="[--sheet-max-w:520px]">
          <SheetHeader className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <SheetTitle>{viewing?.invoice_number ?? ""}</SheetTitle>
              <SheetDescription>Invoice details</SheetDescription>
            </div>
          </SheetHeader>
          <SheetBody className="space-y-5">
            {viewing && (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <span className="block text-[var(--foreground)]">{viewing.company_name ?? "Company"}</span>
                    <span className="text-xs text-[var(--muted)]">Due {fmtDate(viewing.due_date)} · {titleCase(viewing.currency)}</span>
                  </div>
                  <Badge tone={invoiceTone(viewing.status)}>{invoiceLabel(viewing.status)}</Badge>
                </div>

                <div className="rounded-lg border border-[var(--border)]">
                  <table className={TABLE}>
                    <thead>
                      <tr className={THEAD_ROW}><th className={`${TH} ${CELL_FIRST}`}>Description</th><th className={`${TH} ${CELL_LAST} text-right`}>Amount</th></tr>
                    </thead>
                  <tbody>
                      {viewing.line_items.map((li, idx) => (
                        <tr key={idx} className={TR}>
                          <td className={`${TD} ${CELL_FIRST} py-2.5 text-[var(--foreground)]`}>{String((li as { description?: unknown }).description ?? "")}</td>
                          <td className={`${TD} ${CELL_LAST} py-2.5 text-right tabular-nums text-[var(--foreground)]`}>
                            {money(Number((li as { amount?: unknown }).amount ?? 0), viewing.currency)}
                          </td>
                        </tr>
                      ))}
                      {viewing.tax_amount > 0 && (
                        <tr className={TR}><td className={`${TD} ${CELL_FIRST} py-2.5 text-[var(--muted)]`}>Tax</td><td className={`${TD} ${CELL_LAST} py-2.5 text-right tabular-nums text-[var(--muted)]`}>{money(viewing.tax_amount, viewing.currency)}</td></tr>
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
                    <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-[var(--muted)]">Payments received</div>
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
              </>
            )}
          </SheetBody>
          <SheetFooter>
            {viewing && ["sent", "partial", "overdue"].includes(viewing.status) && (
              <Button variant="primary" onClick={() => { setViewing(null); setPayFor(viewing); }}>Record payment</Button>
            )}
            <SheetClose asChild>
              <Button type="button" variant="secondary">Close</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Record payment is a form, so it is a sheet too. */}
      <Sheet open={!!payFor} onOpenChange={(open) => { if (!open) setPayFor(null); }}>
        <SheetContent>
          <SheetHeader className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle>Record payment</SheetTitle>
              <SheetDescription>Offline settlement — bank transfer or cash</SheetDescription>
            </div>
          </SheetHeader>
          {payFor && (
            <RecordPaymentForm
              invoice={payFor}
              currency={currency}
              onDone={() => { setPayFor(null); load(); }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Voiding is destructive, so it gets a centred AlertDialog: two answers,
          and it should stop you. */}
      <AlertDialog open={!!confirmVoid} onOpenChange={(open) => { if (!open) setConfirmVoid(null); }}>
        <AlertDialogContent>
          <AlertDialogTitle>Void invoice</AlertDialogTitle>
          <AlertDialogDescription>
            Void <strong className="font-mono text-foreground">{confirmVoid?.invoice_number}</strong>? It can be
            reopened later. Invoices with payments need a refund instead.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="danger" onClick={() => { const id = confirmVoid?.id; setConfirmVoid(null); if (id) void act(id, "void"); }}>Void invoice</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    /* `flex` + the form filling the sheet: header and footer stay put, only the
       fields scroll. */
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <SheetBody className="space-y-5">
        {error && <Alert>{error}</Alert>}
        <p className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 text-sm text-[var(--foreground-muted)]">
          {invoice.invoice_number} · balance due{" "}
          <span className="tabular-nums font-semibold text-[var(--foreground)]">{money(remaining, currency)}</span>
        </p>
        <FieldSelect label="Method" value={method} onChange={setMethod}>
          <SelectItem value="bank_transfer">Bank transfer</SelectItem>
          <SelectItem value="cash">Cash</SelectItem>
        </FieldSelect>
        <div className="grid grid-cols-2 gap-4">
          <Input label={`Amount (leave blank for full)`} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input label="Paid on" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </div>
        <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Wire ref / receipt no." />
      </SheetBody>
      <SheetFooter>
        <SheetClose asChild>
          <Button type="button" variant="secondary">Cancel</Button>
        </SheetClose>
        <Button type="submit" loading={loading}>Record payment</Button>
      </SheetFooter>
    </form>
  );
}
