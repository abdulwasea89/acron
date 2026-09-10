"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Dialog } from "@/components/Dialog";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Select, Spinner, Textarea } from "@/components/ui";
import { KebabMenu } from "@/components/KebabMenu";
import { useModuleGate } from "@/hooks/useModuleGate";
import { api, ApiError } from "@/lib/api";
import { fmtDate, invoiceLabel, invoiceTone, money, titleCase } from "@/lib/format";
import type {
  CompanyContractOut, CompanyDetailOut, CompanyOut, OfficeInvoiceOut, PlanOut, SeatHolderOut,
} from "@/lib/types";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard?.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
      className="ml-2 rounded-full border border-[var(--border)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] hover:text-[var(--foreground)]"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const companyId = params?.id ?? "";
  const { org, ready } = useModuleGate("companies");
  const currency = org?.default_currency ?? "USD";

  const [detail, setDetail] = useState<CompanyDetailOut | null>(null);
  const [invoices, setInvoices] = useState<OfficeInvoiceOut[]>([]);
  const [plans, setPlans] = useState<PlanOut[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ email: string; code: string } | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState<CompanyContractOut | null>(null);
  const confirmEndRef = useRef<CompanyContractOut | null>(null);
  confirmEndRef.current = confirmEnd;

  const load = useCallback(async () => {
    setError("");
    try {
      const [d, inv, pl] = await Promise.all([
        api.get<CompanyDetailOut>(`/companies/${companyId}`),
        api.get<OfficeInvoiceOut[]>(`/invoices?company_id=${companyId}`),
        api.get<PlanOut[]>("/plans"),
      ]);
      setDetail(d);
      setInvoices(inv);
      setPlans(pl);
    } catch (e) {
      setError((e as ApiError).message);
      setDetail(null);
    }
  }, [companyId]);

  useEffect(() => {
    if (ready && companyId) queueMicrotask(() => void load());
  }, [ready, companyId, load]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const spacePlans = plans.filter((p) => p.status === "published" && p.offer_kind === "space");

  // Occupancy across the company's active contracts.
  const activeContracts = detail?.contracts.filter((c) => c.status === "active") ?? [];
  const capacity = activeContracts.reduce((s, c) => s + c.seats, 0);
  const activeHolders = detail?.seat_holders.filter((h) => h.member_status === "active").length ?? 0;

  if (!ready) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Spinner /></div>;
  }
  if (!detail) {
    return (
      <>
        <PageHeader title="Company" subtitle="Not found" />
        {error && <Alert>{error}</Alert>}
        <Link href="/app/companies" className="text-sm text-[var(--primary)] hover:underline">← Back to companies</Link>
      </>
    );
  }
  const c = detail.company;

  return (
    <>
      <PageHeader
        title={c.name}
        subtitle={`Added ${fmtDate(c.created_at)}`}
        action={
          <div className="flex items-center gap-2">
            <Link href="/app/companies" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">← Companies</Link>
            <Button variant="secondary" onClick={() => setShowEdit(true)}>Edit</Button>
            {c.status === "active" && (
              <Button variant="danger" onClick={() => setConfirmDeactivate(true)}>Deactivate</Button>
            )}
          </div>
        }
      />

      {error && <div className="mb-5"><Alert>{error}</Alert></div>}

      {/* Meta */}
      <Card className="mb-5">
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4">
          <div><div className="text-[11px] font-medium uppercase tracking-widest text-[var(--muted)]">Contact</div>
            <div className="mt-1 text-sm text-[var(--foreground)]">{c.contact_name || "—"}</div>
            {c.contact_email && <div className="text-xs text-[var(--muted)]">{c.contact_email}</div>}
            {c.contact_phone && <div className="text-xs text-[var(--muted)]">{c.contact_phone}</div>}
          </div>
          <div><div className="text-[11px] font-medium uppercase tracking-widest text-[var(--muted)]">Billing email</div>
            <div className="mt-1 text-sm text-[var(--foreground)]">{c.billing_email || "—"}</div>
          </div>
          <div><div className="text-[11px] font-medium uppercase tracking-widest text-[var(--muted)]">Tax ID</div>
            <div className="mt-1 font-mono text-sm text-[var(--foreground)]">{c.tax_id || "—"}</div>
          </div>
          <div><div className="text-[11px] font-medium uppercase tracking-widest text-[var(--muted)]">Occupancy</div>
            <div className="mt-1 tabular-nums text-sm font-semibold text-[var(--foreground)]">
              {activeHolders}<span className="font-normal text-[var(--muted)]"> / {capacity} seats</span>
            </div>
          </div>
          {c.address && <div className="sm:col-span-2"><div className="text-[11px] font-medium uppercase tracking-widest text-[var(--muted)]">Address</div>
            <div className="mt-1 text-sm text-[var(--foreground-muted)]">{c.address}</div></div>}
          {c.notes && <div className="sm:col-span-2"><div className="text-[11px] font-medium uppercase tracking-widest text-[var(--muted)]">Notes</div>
            <div className="mt-1 text-sm text-[var(--foreground-muted)]">{c.notes}</div></div>}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Seat contracts */}
        <Card>
          <CardHeader
            title="Seat contracts"
            subtitle={detail.contracts.length ? `${detail.contracts.length} on record` : "Sign a company onto a space plan"}
            action={<Button size="sm" variant={spacePlans.length ? "primary" : "secondary"} disabled={!spacePlans.length} onClick={() => setShowContract(true)}>+ New contract</Button>}
          />
          {!spacePlans.length && (
            <p className="px-5 pb-4 text-xs text-[var(--warning)]">
              No published space plans. Publish one under <a href="/app/plans" className="underline">Space plans</a> first.
            </p>
          )}
          {detail.contracts.length === 0 ? (
            <div className="px-5 pb-8">
              <EmptyState title="No contracts yet" hint="Sign this company onto a space plan to start billing seats." />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {detail.contracts.map((ct) => {
                const openInvoice = invoices.find((i) => i.contract_id === ct.id && ["draft", "sent", "partial", "overdue"].includes(i.status));
                return (
                  <li key={ct.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-[var(--foreground)]">{ct.plan_name}</span>
                        <Badge tone={ct.status === "active" ? "success" : "neutral"}>{ct.status}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">
                        {ct.seats} seat{ct.seats === 1 ? "" : "s"} × {money(ct.price_per_seat, ct.currency)} · {titleCase(ct.term)} · next {fmtDate(ct.next_billing_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {ct.status === "active" && (
                        openInvoice ? (
                          <span className="text-[11px] text-[var(--muted)]">{invoiceLabel(openInvoice.status)} INV-…{openInvoice.invoice_number.slice(-4)}</span>
                        ) : (
                          <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(async () => {
                            await api.post("/invoices/issue", { contract_id: ct.id });
                          })}>Invoice next term</Button>
                        )
                      )}
                      {ct.status === "active" && (
                        <KebabMenu actions={[{ label: "End contract", danger: true, onClick: () => setConfirmEnd(ct) }]} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Seat-holders */}
        <Card>
          <CardHeader
            title="Seat-holders"
            subtitle={detail.seat_holders.length ? `${activeHolders} active of ${detail.seat_holders.length}` : "Invite people under this company"}
            action={<Button size="sm" variant="primary" disabled={!capacity} onClick={() => { setInviteResult(null); setShowInvite(true); }}>+ Add seat-holder</Button>}
          />
          {!capacity && (
            <p className="px-5 pb-4 text-xs text-[var(--muted)]">Add an active contract before inviting seat-holders.</p>
          )}
          {detail.seat_holders.length === 0 ? (
            <div className="px-5 pb-8">
              <EmptyState title="No seat-holders yet" hint="Invite by email — each redeem goes straight to active (no payment step)." />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {detail.seat_holders.map((h) => (
                <SeatHolderRow key={h.member_id} holder={h} onResend={() => run(async () => {
                  const res = await api.post<{ email_delivered: boolean; invite_code: string }>(`/companies/${companyId}/seat-holders/${h.member_id}/resend`);
                  if (!res.email_delivered && res.invite_code) setInviteResult({ email: h.email, code: res.invite_code });
                })} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Invoices for this company */}
      <div className="mt-5">
        <Card>
          <CardHeader title="Invoices" subtitle={`${invoices.length} for this company`} action={
            <Link href={`/app/invoices?company_id=${companyId}`} className="text-sm text-[var(--primary)] hover:underline">Open invoices →</Link>
          } />
          {invoices.length === 0 ? (
            <div className="px-5 pb-8">
              <EmptyState title="No invoices" hint="Sign a contract and the first invoice is drafted automatically." />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {invoices.slice(0, 8).map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <Link href={`/app/invoices?invoice=${inv.id}`} className="font-mono text-xs font-medium text-[var(--foreground)] hover:underline">{inv.invoice_number}</Link>
                    <span className="ml-2 text-xs text-[var(--foreground-muted)]">due {fmtDate(inv.due_date)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums text-sm font-semibold text-[var(--foreground)]">{money(inv.total, inv.currency)}</span>
                    <Badge tone={invoiceTone(inv.status)}>{invoiceLabel(inv.status)}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Dialogs */}
      <Dialog open={showEdit} onClose={() => setShowEdit(false)} title="Edit company" className="max-w-xl">
        <EditCompanyForm company={c} onDone={() => { setShowEdit(false); load(); }} />
      </Dialog>

      <Dialog open={showContract} onClose={() => setShowContract(false)} title="New seat contract" subtitle="Sign this company onto a published space plan" className="max-w-xl">
        <ContractForm companyId={companyId} plans={spacePlans} currency={currency} onDone={() => { setShowContract(false); load(); }} />
      </Dialog>

      <Dialog open={showInvite} onClose={() => { setShowInvite(false); setInviteResult(null); }} title="Add seat-holder" subtitle="Invite by email — this company's seats cap the roster" className="max-w-md">
        {inviteResult ? (
          <InviteDone result={inviteResult} onDone={() => { setShowInvite(false); setInviteResult(null); load(); }} />
        ) : (
          <SeatHolderForm companyId={companyId} onSent={(email, code) => setInviteResult({ email, code })} />
        )}
      </Dialog>

      <Dialog open={confirmDeactivate} onClose={() => setConfirmDeactivate(false)} title="Deactivate company" className="max-w-sm">
        <p className="mb-6 text-sm text-[var(--foreground-muted)]">
          Deactivate <strong className="text-[var(--foreground)]">{c.name}</strong>? Existing contracts and invoices stay on record, but no new contracts can be signed.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDeactivate(false)}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={() => run(async () => { await api.post(`/companies/${companyId}/deactivate`); setConfirmDeactivate(false); })}>Deactivate</Button>
        </div>
      </Dialog>

      <Dialog open={!!confirmEnd} onClose={() => setConfirmEnd(null)} title="End contract" className="max-w-sm">
        <p className="mb-6 text-sm text-[var(--foreground-muted)]">
          End the <strong className="text-[var(--foreground)]">{confirmEndRef.current?.plan_name}</strong> contract? Future invoices stop; already-open invoices still need settling.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmEnd(null)}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={() => {
            const target = confirmEndRef.current;
            if (!target) return;
            void run(async () => { await api.post(`/companies/${companyId}/contracts/${target.id}/end`); setConfirmEnd(null); });
          }}>End contract</Button>
        </div>
      </Dialog>
    </>
  );
}

function SeatHolderRow({ holder, onResend }: { holder: SeatHolderOut; onResend: () => void }) {
  return (
    <li className="flex items-center justify-between gap-2 px-5 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--background)] text-xs font-bold text-[var(--muted)]">
          {(holder.display_name || holder.email).slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm text-[var(--foreground)]">{holder.full_name || holder.email}</div>
          {holder.full_name && <div className="truncate text-xs text-[var(--muted)]">{holder.email}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={holder.member_status === "active" ? "success" : holder.member_status === "invited" ? "warning" : "neutral"}>
          {holder.member_status === "active" ? "Active" : titleCase(holder.member_status)}
        </Badge>
        {holder.member_status !== "active" && (
          <button type="button" onClick={onResend} className="text-xs text-[var(--primary)] hover:underline">
            Resend
          </button>
        )}
      </div>
    </li>
  );
}

function InviteDone({ result, onDone }: { result: { email: string; code: string }; onDone: () => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--foreground-muted)]">
        Invite sent to <strong className="text-[var(--foreground)]">{result.email}</strong>. They&apos;ll need the code below (shown because email delivery is off in this environment).
      </p>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3">
        <div className="font-mono text-base tracking-widest text-[var(--foreground)]">{result.code}<CopyButton text={result.code} /></div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="primary" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

function SeatHolderForm({ companyId, onSent }: { companyId: string; onSent: (email: string, code: string) => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ email_delivered: boolean; invite_code: string }>(`/companies/${companyId}/seat-holders`, { email });
      if (!res.email_delivered && res.invite_code) onSent(email, res.invite_code);
      else onSent(email, "");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <Alert>{error}</Alert>}
      <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@company.com" />
      <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-5">
        <Button type="submit" loading={loading} size="lg">Send invite</Button>
      </div>
    </form>
  );
}

function ContractForm({ companyId, plans, currency, onDone }: {
  companyId: string; plans: PlanOut[]; currency: string; onDone: () => void;
}) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [seats, setSeats] = useState("1");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selected = plans.find((p) => p.id === planId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post(`/companies/${companyId}/contracts`, {
        plan_id: planId,
        seats: parseInt(seats, 10) || 1,
        notes: notes || null,
      });
      onDone();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
      {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
      {!plans.length && (
        <div className="sm:col-span-2">
          <Alert tone="warning">No published space plans. Publish one under Space plans first.</Alert>
        </div>
      )}
      <div className="sm:col-span-2">
        <Select label="Space plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {money(p.price, currency)}/seat · {p.spec && "term" in p.spec ? String((p.spec as Record<string, unknown>).term) : ""}</option>)}
        </Select>
      </div>
      <Input label="Seats" type="number" min="1" required value={seats} onChange={(e) => setSeats(e.target.value)} />
      <div className="flex items-end pb-2 text-xs text-[var(--muted)]">
        {selected ? `≈ ${money(selected.price * (parseInt(seats, 10) || 1), currency)} per term` : ""}
      </div>
      <div className="sm:col-span-2">
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <div className="sm:col-span-2 flex justify-end gap-2 border-t border-[var(--border)] pt-5">
        <Button type="submit" loading={loading} size="lg" disabled={!planId}>Sign contract</Button>
      </div>
    </form>
  );
}

function EditCompanyForm({ company, onDone }: { company: CompanyOut; onDone: () => void }) {
  const [name, setName] = useState(company.name);
  const [contactName, setContactName] = useState(company.contact_name ?? "");
  const [contactEmail, setContactEmail] = useState(company.contact_email ?? "");
  const [billingEmail, setBillingEmail] = useState(company.billing_email ?? "");
  const [taxId, setTaxId] = useState(company.tax_id ?? "");
  const [address, setAddress] = useState(company.address ?? "");
  const [notes, setNotes] = useState(company.notes ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.patch(`/companies/${company.id}`, {
        name,
        contact_name: contactName || null,
        contact_email: contactEmail || null,
        billing_email: billingEmail || null,
        tax_id: taxId || null,
        address: address || null,
        notes: notes || null,
      });
      onDone();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
      {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
      <Input label="Company name" required value={name} onChange={(e) => setName(e.target.value)} />
      <Input label="Tax / registration ID" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
      <div className="sm:col-span-2">
        <Input label="Billing email" type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} />
      </div>
      <Input label="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
      <Input label="Contact email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
      <div className="sm:col-span-2">
        <Textarea label="Address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
      </div>
      <div className="sm:col-span-2">
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <div className="sm:col-span-2 flex justify-end gap-2 border-t border-[var(--border)] pt-5">
        <Button type="submit" loading={loading} size="lg">Save changes</Button>
      </div>
    </form>
  );
}
