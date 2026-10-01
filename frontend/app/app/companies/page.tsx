"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, EmptyState, Input, Spinner, Textarea } from "@/components/ui";
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
import { ListToolbar } from "@/components/ListToolbar";
import { RowMenu } from "@/components/RowMenu";
import { TABLE, THEAD_ROW, TH, TR, TD, CELL, CELL_FIRST, CELL_LAST } from "@/components/Table";
import { useModuleGate } from "@/hooks/useModuleGate";
import { api, ApiError } from "@/lib/api";
import { money, titleCase } from "@/lib/format";
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
    /* `flex` + the form filling the sheet: the header above and the actions
       below stay put, only the fields scroll. A centred modal could do the
       same, but a sheet keeps the company list in view while you fill it in. */
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <SheetBody className="space-y-5">
        {error && <Alert>{error}</Alert>}
        <Input label="Company name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Northwind Ltd" />
        <Input label="Tax / registration ID" value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="DE 123456789" />
        <Input label="Billing email" type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} placeholder="ap@northwind.com" />
        <Input label="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        <Input label="Contact email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        <Textarea label="Address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </SheetBody>
      <SheetFooter>
        <SheetClose asChild>
          <Button type="button" variant="secondary">Cancel</Button>
        </SheetClose>
        <Button type="submit" loading={loading}>Add company</Button>
      </SheetFooter>
    </form>
  );
}

export default function CompaniesPage() {
  const { org, ready } = useModuleGate("companies");
  const [rows, setRows] = useState<CompanyListItem[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
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

  const all = rows ?? [];

  const tabs = [
    { value: "all", label: "All", count: all.length },
    ...Array.from(new Set(all.map((c) => c.status))).map((s) => ({
      value: s,
      label: titleCase(s),
      count: all.filter((c) => c.status === s).length,
    })),
  ];

  const q = search.trim().toLowerCase();
  const filtered = all.filter((c) => {
    if (status !== "all" && c.status !== status) return false;
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.billing_email ?? "").toLowerCase().includes(q) ||
      (c.contact_email ?? "").toLowerCase().includes(q) ||
      (c.tax_id ?? "").toLowerCase().includes(q)
    );
  });

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

      {/* Create lives in a sheet: it is about the companies below it, so the
          list stays in view while you fill the form in. */}
      <Sheet open={showNew} onOpenChange={setShowNew}>
        <SheetContent className="[--sheet-max-w:520px]">
          <SheetHeader className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle>Add a company</SheetTitle>
              <SheetDescription>A billing tenant that signs seat contracts</SheetDescription>
            </div>
          </SheetHeader>
          <CompanyForm onDone={() => { setShowNew(false); load(); }} />
        </SheetContent>
      </Sheet>

      <ListToolbar
        tabs={tabs}
        value={status}
        onChange={setStatus}
        search={search}
        onSearch={(v) => setSearch(v)}
        searchPlaceholder="Search companies…"
      />

      {/* Table surface: hairline border, square corners, flat background. */}
      <div className="mt-3">
        {rows === null ? (
          <Spinner label="Loading companies..." />
        ) : filtered.length === 0 ? (
          <div className="px-5 pb-10">
            <EmptyState
              title={all.length === 0 ? "No companies yet" : "No companies match"}
              hint={
                all.length === 0
                  ? "Add your first company — then sign it onto a published space plan to bill for seats."
                  : "Try a different search or status filter."
              }
              action={
                all.length === 0
                  ? <Button onClick={() => setShowNew(true)}>+ Add your first company</Button>
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr className={THEAD_ROW}>
                  <th className={`${TH} ${CELL_FIRST}`}>Company</th>
                  <th className={`${TH} ${CELL}`}>Billing email</th>
                  <th className={`${TH} ${CELL}`}>Seats</th>
                  <th className={`${TH} ${CELL}`}>Outstanding</th>
                  <th className={`${TH} ${CELL}`}>Status</th>
                  <th className={`${TH} ${CELL_LAST} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className={`${TR} group transition-colors hover:bg-[var(--background)]/50`}>
                    <td className={`${TD} ${CELL_FIRST} py-2.5`}>
                      <Link href={`/app/companies/${c.id}`} className="font-medium text-[var(--foreground)] hover:underline">
                        {c.name}
                      </Link>
                      {c.tax_id && (
                        <span className="mt-0.5 block font-mono text-[10px] text-[var(--muted)]">{c.tax_id}</span>
                      )}
                    </td>
                    <td className={`${TD} ${CELL} py-2.5 text-[var(--foreground-muted)]`}>{c.billing_email || "—"}</td>
                    <td className={`${TD} ${CELL} py-2.5`}>
                      <span className="tabular-nums text-[var(--foreground)]">{c.occupied_seats}</span>
                      <span className="text-[var(--muted)]"> / {c.seat_capacity}</span>
                    </td>
                    <td className={`${TD} ${CELL} py-2.5`}>
                      {c.outstanding_total > 0 ? (
                        <span className="tabular-nums font-semibold text-[var(--foreground)]">{money(c.outstanding_total, currency)}</span>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className={`${TD} ${CELL} py-2.5`}>
                      <Badge tone={c.status === "active" ? "success" : "neutral"}>{c.status}</Badge>
                    </td>
                    <td className={`${TD} ${CELL_LAST} py-2.5 text-right`}>
                      <RowMenu
                        actions={[
                          { label: "View", onSelect: () => { window.location.href = `/app/companies/${c.id}`; } },
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
    </>
  );
}
