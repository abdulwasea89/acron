"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Spinner, Textarea } from "@/components/ui";
import { FieldSelect, NONE } from "@/components/FieldSelect";
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
import { RowMenu } from "@/components/RowMenu";
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
  const [inviteResult, setInviteResult] = useState<{ email: string; code: string; delivered: boolean; action: "invite" | "resend" } | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState<CompanyContractOut | null>(null);

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
          <div><div className="text-[10px] font-medium uppercase tracking-widest text-[var(--muted)]">Contact</div>
            <div className="mt-1 text-sm text-[var(--foreground)]">{c.contact_name || "—"}</div>
            {c.contact_email && <div className="text-xs text-[var(--muted)]">{c.contact_email}</div>}
            {c.contact_phone && <div className="text-xs text-[var(--muted)]">{c.contact_phone}</div>}
          </div>
          <div><div className="text-[10px] font-medium uppercase tracking-widest text-[var(--muted)]">Billing email</div>
            <div className="mt-1 text-sm text-[var(--foreground)]">{c.billing_email || "—"}</div>
          </div>
          <div><div className="text-[10px] font-medium uppercase tracking-widest text-[var(--muted)]">Tax ID</div>
            <div className="mt-1 font-mono text-sm text-[var(--foreground)]">{c.tax_id || "—"}</div>
          </div>
          <div><div className="text-[10px] font-medium uppercase tracking-widest text-[var(--muted)]">Occupancy</div>
            <div className="mt-1 tabular-nums text-sm font-semibold text-[var(--foreground)]">
              {activeHolders}<span className="font-normal text-[var(--muted)]"> / {capacity} seats</span>
            </div>
          </div>
          {c.address && <div className="sm:col-span-2"><div className="text-[10px] font-medium uppercase tracking-widest text-[var(--muted)]">Address</div>
            <div className="mt-1 text-sm text-[var(--foreground-muted)]">{c.address}</div></div>}
          {c.notes && <div className="sm:col-span-2"><div className="text-[10px] font-medium uppercase tracking-widest text-[var(--muted)]">Notes</div>
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
                          <span className="text-[10px] text-[var(--muted)]">{invoiceLabel(openInvoice.status)} INV-…{openInvoice.invoice_number.slice(-4)}</span>
                        ) : (
                          <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(async () => {
                            await api.post("/invoices/issue", { contract_id: ct.id });
                          })}>Invoice next term</Button>
                        )
                      )}
                      {ct.status === "active" && (
                        <RowMenu actions={[{ label: "End contract", variant: "destructive", onSelect: () => setConfirmEnd(ct) }]} />
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
                  setInviteResult({ email: h.email, code: res.invite_code, delivered: res.email_delivered, action: "resend" });
                  setShowInvite(true);
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

      {/* Editing the company is a form about the record above it, so it rides in a
          sheet: the contracts, seat-holders and invoices stay in view. */}
      <Sheet open={showEdit} onOpenChange={setShowEdit}>
        <SheetContent className="[--sheet-max-w:520px]">
          <SheetHeader className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle>Edit company</SheetTitle>
              <SheetDescription>Details, billing contact and address</SheetDescription>
            </div>
          </SheetHeader>
          <EditCompanyForm company={c} onDone={() => { setShowEdit(false); load(); }} />
        </SheetContent>
      </Sheet>

      {/* Signing a company onto a plan is a create task, and the plan list behind
          it is the thing you are choosing from — a sheet keeps both visible. */}
      <Sheet open={showContract} onOpenChange={setShowContract}>
        <SheetContent className="[--sheet-max-w:520px]">
          <SheetHeader className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle>New seat contract</SheetTitle>
              <SheetDescription>Sign this company onto a published space plan</SheetDescription>
            </div>
          </SheetHeader>
          <ContractForm companyId={companyId} plans={spacePlans} currency={currency} onDone={() => { setShowContract(false); load(); }} />
        </SheetContent>
      </Sheet>

      {/* Adding a seat-holder is the same shape as signing: a create form, with
          the generated invite code as its tail. */}
      <Sheet
        open={showInvite}
        onOpenChange={(open) => { if (!open) { setShowInvite(false); setInviteResult(null); } }}
      >
        <SheetContent>
          <SheetHeader className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle>Add seat-holder</SheetTitle>
              <SheetDescription>Invite by email — this company&apos;s seats cap the roster</SheetDescription>
            </div>
          </SheetHeader>
          {inviteResult ? (
            <InviteDone result={inviteResult} onDone={() => { setShowInvite(false); setInviteResult(null); load(); }} />
          ) : (
            <SeatHolderForm companyId={companyId} onSent={setInviteResult} />
          )}
        </SheetContent>
      </Sheet>

      {/* Deactivating stops future contracts, so it gets a centred AlertDialog:
          two answers, and it should stop you. */}
      <AlertDialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <AlertDialogContent>
          <AlertDialogTitle>Deactivate company</AlertDialogTitle>
          <AlertDialogDescription>
            Deactivate <strong className="text-foreground">{c.name}</strong>? Existing contracts and
            invoices stay on record, but no new contracts can be signed.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="danger" loading={busy} onClick={() => run(async () => { await api.post(`/companies/${companyId}/deactivate`); setConfirmDeactivate(false); })}>Deactivate</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ending a contract is destructive too — it stops the billing — so it
          gets the same treatment. */}
      <AlertDialog open={!!confirmEnd} onOpenChange={(open) => { if (!open) setConfirmEnd(null); }}>
        <AlertDialogContent>
          <AlertDialogTitle>End contract</AlertDialogTitle>
          <AlertDialogDescription>
            End the <strong className="text-foreground">{confirmEnd?.plan_name}</strong> contract? Future
            invoices stop; already-open invoices still need settling.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="danger" loading={busy} onClick={() => {
                const target = confirmEnd;
                if (!target) return;
                void run(async () => { await api.post(`/companies/${companyId}/contracts/${target.id}/end`); setConfirmEnd(null); });
              }}>End contract</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function InviteDone({ result, onDone }: {
  result: { email: string; code: string; delivered: boolean; action: "invite" | "resend" };
  onDone: () => void;
}) {
  const verb = result.action === "resend" ? "re-emailed" : "emailed";
  return (
    /* `flex` + the panel filling the sheet: the header above and the action
       below stay put, only the outcome scrolls. */
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetBody className="space-y-4">
        {result.delivered ? (
          <>
            <Alert tone="success">
              Invite {verb} to <strong>{result.email}</strong>. The code is in that email — they enter it
              in the app under &ldquo;Redeem invite&rdquo;.
            </Alert>
            <p className="text-xs text-[var(--muted)]">No email arrived? Check their spam folder, then use Resend.</p>
          </>
        ) : (
          <>
            <Alert tone="warning">
              The invite could not be emailed, so share this single-use code with {result.email} directly.
            </Alert>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3">
              <div className="font-mono text-base tracking-widest text-[var(--foreground)]">
                {result.code}
                <CopyButton text={result.code} />
              </div>
            </div>
          </>
        )}
      </SheetBody>
      <SheetFooter>
        <Button onClick={onDone}>Done</Button>
      </SheetFooter>
    </div>
  );
}

function SeatHolderForm({ companyId, onSent }: {
  companyId: string;
  onSent: (r: { email: string; code: string; delivered: boolean; action: "invite" | "resend" }) => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ email_delivered: boolean; invite_code: string }>(`/companies/${companyId}/seat-holders`, { email });
      onSent({ email, code: res.invite_code, delivered: res.email_delivered, action: "invite" });
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    /* `flex` + the form filling the sheet: header and footer stay put, only the
       body scrolls. */
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <SheetBody className="space-y-5">
        {error && <Alert>{error}</Alert>}
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@company.com" />
      </SheetBody>
      <SheetFooter>
        <SheetClose asChild>
          <Button type="button" variant="secondary">Cancel</Button>
        </SheetClose>
        <Button type="submit" loading={loading}>Send invite</Button>
      </SheetFooter>
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
    /* `flex` + the form filling the sheet: header and footer stay put, only the
       body scrolls. The plan picker is a Radix Select — the in-house one portals
       its listbox to <body>, which a Radix dialog makes inert. */
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <SheetBody className="space-y-5">
        {error && <Alert>{error}</Alert>}
        {!plans.length && (
          <Alert tone="warning">No published space plans. Publish one under Space plans first.</Alert>
        )}
        <FieldSelect
          label="Space plan"
          value={planId || NONE}
          onChange={(v) => setPlanId(v === NONE ? "" : v)}
        >
          <SelectItem value={NONE}>Select a space plan…</SelectItem>
          {plans.map((p) => (
            <SelectItem
              key={p.id}
              value={p.id}
              label={p.name}
            >
              {p.name} — {money(p.price, currency)}/seat · {p.spec && "term" in p.spec ? String((p.spec as Record<string, unknown>).term) : ""}
            </SelectItem>
          ))}
        </FieldSelect>
        <Input label="Seats" type="number" min="1" required value={seats} onChange={(e) => setSeats(e.target.value)} />
        <div className="text-xs text-[var(--muted)]">
          {selected ? `≈ ${money(selected.price * (parseInt(seats, 10) || 1), currency)} per term` : ""}
        </div>
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </SheetBody>
      <SheetFooter>
        <SheetClose asChild>
          <Button type="button" variant="secondary">Cancel</Button>
        </SheetClose>
        <Button type="submit" loading={loading} disabled={!planId}>Sign contract</Button>
      </SheetFooter>
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
    /* `flex` + the form filling the sheet: header and footer stay put, only the
       body scrolls. A centred modal could do the same, but a sheet keeps the
       company's contracts and invoices in view while you edit them. */
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <SheetBody className="space-y-5">
        {error && <Alert>{error}</Alert>}
        <Input label="Company name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Tax / registration ID" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
        <Input label="Billing email" type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} />
        <Input label="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        <Input label="Contact email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        <Textarea label="Address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </SheetBody>
      <SheetFooter>
        <SheetClose asChild>
          <Button type="button" variant="secondary">Cancel</Button>
        </SheetClose>
        <Button type="submit" loading={loading}>Save changes</Button>
      </SheetFooter>
    </form>
  );
}
