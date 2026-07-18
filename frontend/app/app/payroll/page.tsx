"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money, statusTone, titleCase } from "@/lib/format";
import type { MemberDirectoryItem, PayrollRun } from "@/lib/types";

export default function PayrollPage() {
  const [runs, setRuns] = useState<PayrollRun[] | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [staffMap, setStaffMap] = useState<Record<string, string>>({});

  async function load() {
    setError("");
    try {
      const [runsData, members] = await Promise.all([
        api.get<PayrollRun[]>("/payroll/runs"),
        api.get<MemberDirectoryItem[]>("/members"),
      ]);
      setRuns(runsData);
      setStaffMap(Object.fromEntries(members.map((m) => [m.member_id, m.full_name || m.email])));
    } catch (e) {
      setError((e as ApiError).message);
      setRuns([]);
    }
  }

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  async function act(id: string, action: string) {
    setError("");
    try {
      await api.post(`/payroll/runs/${id}/${action}`);
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Payroll"
        subtitle="Draft, review, finalize and pay staff for each period"
        action={
          <Button onClick={() => setShowForm((s) => !s)} variant={showForm ? "secondary" : "primary"}>
            {showForm ? (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                Close
              </>
            ) : (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                New payroll run
              </>
            )}
          </Button>
        }
      />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <Dialog open={showForm} onClose={() => setShowForm(false)} title="New payroll run" subtitle="Generates a draft with one entry per active staff member">
        <RunForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      </Dialog>

      {runs === null ? (
        <Spinner label="Loading payroll runs..." />
      ) : runs.length === 0 ? (
        <Card>
          <EmptyState
            title="No payroll runs yet"
            hint="Create a draft for the current pay period to generate staff entries."
            action={
              <Button onClick={() => setShowForm(true)} size="lg">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Create first payroll run
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {runs.map((run) => (
            <RunCard key={run.id} run={run} staffMap={staffMap} onAction={act} onChanged={load} />
          ))}
        </div>
      )}
    </>
  );
}

function RunForm({ onCreated }: { onCreated: () => void }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/payroll/runs", { period_start: start, period_end: end });
      onCreated();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
      <Input label="Period start" type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
      <Input label="Period end" type="date" required value={end} onChange={(e) => setEnd(e.target.value)} />
      <div className="sm:col-span-2">
        <Button type="submit" loading={loading}>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
          Generate draft
        </Button>
      </div>
    </form>
  );
}

function RunCard({
  run,
  staffMap,
  onAction,
  onChanged,
}: {
  run: PayrollRun;
  staffMap: Record<string, string>;
  onAction: (id: string, action: string) => void;
  onChanged: () => void;
}) {
  const editable = run.status === "draft";
  return (
    <Card>
      <CardHeader
        title={`${run.period_start} → ${run.period_end}`}
        subtitle={`Gross ${money(run.total_gross)} · Deductions ${money(run.total_deductions)} · Net ${money(run.total_net)}`}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={statusTone(run.status)}>{titleCase(run.status)}</Badge>
            <div className="flex gap-2">
              {run.status === "draft" && (
                <Button variant="secondary" size="sm" onClick={() => onAction(run.id, "lock")}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  Lock
                </Button>
              )}
              {run.status === "locked" && (
                <Button variant="secondary" size="sm" onClick={() => onAction(run.id, "finalize")}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  Finalize
                </Button>
              )}
              {run.status === "finalized" && (
                <Button size="sm" onClick={() => onAction(run.id, "pay")}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>
                  Mark paid
                </Button>
              )}
            </div>
          </div>
        }
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            <tr className="border-b border-[var(--border)]">
              <th className="px-6 py-3.5">Staff</th>
              <th className="px-6 py-3.5">Fixed</th>
              <th className="px-6 py-3.5">Hourly</th>
              <th className="px-6 py-3.5">Classes</th>
              <th className="px-6 py-3.5">Commission</th>
              <th className="px-6 py-3.5">Bonus</th>
              <th className="px-6 py-3.5">Deductions</th>
              <th className="px-6 py-3.5 text-right">Net</th>
              {editable && <th className="px-6 py-3.5 text-right">Adjust</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {run.entries.map((e) => (
              <EntryRow key={e.id} runId={run.id} entry={e} staffMap={staffMap} editable={editable} onChanged={onChanged} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function EntryRow({
  runId,
  entry,
  staffMap,
  editable,
  onChanged,
}: {
  runId: string;
  entry: import("@/lib/types").PayrollEntry;
  staffMap: Record<string, string>;
  editable: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [bonus, setBonus] = useState(String(entry.bonus));
  const [deductions, setDeductions] = useState(String(entry.deductions));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function save() {
    setError("");
    setLoading(true);
    try {
      await api.patch(`/payroll/runs/${runId}/entries/${entry.id}`, {
        bonus: parseFloat(bonus) || 0,
        deductions: parseFloat(deductions) || 0,
        note,
      });
      setOpen(false);
      onChanged();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <tr className="transition-colors hover:bg-[var(--background)]">
        <td className="px-6 py-4 font-medium text-[var(--foreground)]">{staffMap[entry.staff_member_id] || entry.staff_member_id.slice(0, 8)}</td>
        <td className="px-6 py-4 tabular-nums">{money(entry.fixed)}</td>
        <td className="px-6 py-4 tabular-nums">{money(entry.hourly_amount)}</td>
        <td className="px-6 py-4 tabular-nums">{money(entry.class_amount)}</td>
        <td className="px-6 py-4 tabular-nums">{money(entry.commission_amount)}</td>
        <td className="px-6 py-4 tabular-nums">{money(entry.bonus)}</td>
        <td className="px-6 py-4 tabular-nums">{money(entry.deductions)}</td>
        <td className="px-6 py-4 text-right font-semibold tabular-nums text-[var(--foreground)]">{money(entry.net)}</td>
        {editable && (
          <td className="px-6 py-4 text-right">
            <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
              {open ? (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  Cancel
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                  Edit
                </>
              )}
            </Button>
          </td>
        )}
      </tr>
      {open && (
        <tr>
          <td colSpan={9} className="bg-[var(--background)] px-6 py-5">
            {error && <div className="mb-3"><Alert>{error}</Alert></div>}
            <div className="grid gap-4 sm:grid-cols-4">
              <Input label="Bonus" type="number" step="0.01" value={bonus} onChange={(e) => setBonus(e.target.value)} />
              <Input label="Deductions" type="number" step="0.01" value={deductions} onChange={(e) => setDeductions(e.target.value)} />
              <div className="sm:col-span-2">
                <Input label="Note (required)" required value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for adjustment" />
              </div>
            </div>
            <div className="mt-4">
              <Button loading={loading} disabled={!note} onClick={save}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                Save adjustment
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
