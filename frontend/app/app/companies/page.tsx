"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Dialog } from "@/components/Dialog";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Spinner, Textarea } from "@/components/ui";
import { KebabMenu } from "@/components/KebabMenu";
import { useModuleGate } from "@/hooks/useModuleGate";
import { api, ApiError } from "@/lib/api";
import { money, statusTone } from "@/lib/format";
import type { CompanyListItem } from "@/lib/types";

function CompanyForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/companies", {
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
      <Input label="Company name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Northwind Ltd" />
      <Input label="Tax / registration ID" value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="DE 123456789" />
      <div className="sm:col-span-2">
        <Input label="Billing email" type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} placeholder="ap@northwind.com" />
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
        <Button type="submit" loading={loading} size="lg">Add company</Button>
      </div>
    </form>
  );
}

export default function CompaniesPage() {
  const { org, ready } = useModuleGate("companies");
  const [rows, setRows] = useState<CompanyListItem[] | null>(null);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const currency = org?.default_currency ?? "USD";

  const load = useCallback(async () => {
    setError("");
    try {
      setRows(await api.get<CompanyListItem[]>("/companies"));
    } catch (e) {
      setError((e as ApiError).message);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    if (ready) queueMicrotask(() => void load());
  }, [ready, load]);

  const seatsLabel = useMemo(() => {
    if (!rows) return null;
    const totalCap = rows.reduce((s, r) => s + r.seat_capacity, 0);
    const occupied = rows.reduce((s, r) => s + r.occupied_seats, 0);
    return `${occupied} of ${totalCap} seats`;
  }, [rows]);

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Companies"
        subtitle={rows ? `Billing tenants${seatsLabel ? ` · ${seatsLabel} occupied` : ""}` : "Billing tenants"}
        action={
          <Button onClick={() => setShowNew((s) => !s)} variant={showNew ? "secondary" : "primary"}>
            {showNew ? "Close" : "+ Add company"}
          </Button>
        }
      />

      {error && <div className="mb-5"><Alert>{error}</Alert></div>}

      <Dialog open={showNew} onClose={() => setShowNew(false)} title="Add a company" subtitle="A billing tenant that signs seat contracts" className="max-w-xl">
        <CompanyForm onDone={() => { setShowNew(false); load(); }} />
      </Dialog>

      <Card>
        <CardHeader title="Companies" subtitle={rows ? `${rows.length} on file` : undefined} />
        {rows === null ? (
          <Spinner label="Loading companies..." />
        ) : rows.length === 0 ? (
          <div className="px-5 pb-10">
            <EmptyState
              title="No companies yet"
              hint="Add your first company — then sign it onto a published space plan to bill for seats."
              action={<Button onClick={() => setShowNew(true)} size="lg">+ Add your first company</Button>}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left font-mono text-[11px] font-medium uppercase tracking-widest text-[var(--muted-foreground)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-5 py-3 font-medium">Company</th>
                  <th className="px-5 py-3 font-medium">Billing email</th>
                  <th className="px-5 py-3 font-medium">Seats</th>
                  <th className="px-5 py-3 font-medium">Outstanding</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((c) => (
                  <tr key={c.id} className="group transition-colors hover:bg-[var(--background)]/50">
                    <td className="px-5 py-3.5">
                      <Link href={`/app/companies/${c.id}`} className="font-medium text-[var(--foreground)] hover:underline">
                        {c.name}
                      </Link>
                      {c.tax_id && (
                        <span className="mt-0.5 block font-mono text-[11px] text-[var(--muted)]">{c.tax_id}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--foreground-muted)]">{c.billing_email || "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className="tabular-nums text-[var(--foreground)]">{c.occupied_seats}</span>
                      <span className="text-[var(--muted)]"> / {c.seat_capacity}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {c.outstanding_total > 0 ? (
                        <span className="tabular-nums font-semibold text-[var(--foreground)]">{money(c.outstanding_total, currency)}</span>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={c.status === "active" ? "success" : "neutral"}>{c.status}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <KebabMenu
                        actions={[
                          { label: "View", onClick: () => { window.location.href = `/app/companies/${c.id}`; } },
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
    </>
  );
}
