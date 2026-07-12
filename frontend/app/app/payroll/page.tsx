"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money, statusTone, titleCase } from "@/lib/format";
import type { PayrollRun } from "@/lib/types";

export default function PayrollPage() {
  const [runs, setRuns] = useState<PayrollRun[] | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setError("");
    try {
      setRuns(await api.get<PayrollRun[]>("/payroll/runs"));
    } catch (e) {
      setError((e as ApiError).message);
      setRuns([]);
    }
  }

  useEffect(() => {
    load();
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
        action={<Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Close" : "New payroll run"}</Button>}
      />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {showForm && (
        <div className="mb-6">
          <RunForm
            onCreated={() => {
              setShowForm(false);
              load();
            }}
          />
        </div>
      )}

      {runs === null ? (
        <Spinner />
      ) : runs.length === 0 ? (
        <Card>
          <EmptyState title="No payroll runs yet" hint="Create a draft for the current pay period to generate staff entries." />
        </Card>
      ) : (
        <div className="space-y-6">
          {runs.map((run) => (
            <RunCard key={run.id} run={run} onAction={act} onChanged={load} />
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
    <Card>
      <CardHeader title="New payroll run" subtitle="Generates a draft with one entry per active staff member" />
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
        {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
        <Input label="Period start" type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
        <Input label="Period end" type="date" required value={end} onChange={(e) => setEnd(e.target.value)} />
        <div className="sm:col-span-2">
          <Button type="submit" loading={loading}>Generate draft</Button>
        </div>
      </form>
    </Card>
  );
}

function RunCard({
  run,
  onAction,
  onChanged,
}: {
  run: PayrollRun;
  onAction: (id: string, action: string) => void;
  onChanged: () => void;
}) {
  const editable = run.status === "draft";
  return (
    <Card>
      <CardHeader
        title={`${run.period_start} → ${run.period_end}`}
        subtitle={`Gross ${money(run.total_gross)} · Deductions ${money(run.total_deductions)} · Net ${money(run.total_net)}`}
      />
      <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
        <Badge tone={statusTone(run.status)}>{titleCase(run.status)}</Badge>
        <div className="ml-auto flex gap-2">
          {run.status === "draft" && (
            <Button variant="secondary" onClick={() => onAction(run.id, "lock")}>Lock</Button>
          )}
          {run.status === "locked" && (
            <Button variant="secondary" onClick={() => onAction(run.id, "finalize")}>Finalize</Button>
          )}
          {run.status === "finalized" && (
            <Button onClick={() => onAction(run.id, "pay")}>Mark paid</Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr className="border-b border-[var(--border)]">
              <th className="px-5 py-3 font-medium">Staff</th>
              <th className="px-5 py-3 font-medium">Fixed</th>
              <th className="px-5 py-3 font-medium">Hourly</th>
              <th className="px-5 py-3 font-medium">Classes</th>
              <th className="px-5 py-3 font-medium">Commission</th>
              <th className="px-5 py-3 font-medium">Bonus</th>
              <th className="px-5 py-3 font-medium">Deductions</th>
              <th className="px-5 py-3 font-medium text-right">Net</th>
              {editable && <th className="px-5 py-3 font-medium text-right">Adjust</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {run.entries.map((e) => (
              <EntryRow key={e.id} runId={run.id} entry={e} editable={editable} onChanged={onChanged} />
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
  editable,
  onChanged,
}: {
  runId: string;
  entry: import("@/lib/types").PayrollEntry;
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
      <tr className="hover:bg-gray-50/60">
        <td className="px-5 py-3 font-mono text-xs">{entry.staff_member_id.slice(0, 8)}</td>
        <td className="px-5 py-3 tabular-nums">{money(entry.fixed)}</td>
        <td className="px-5 py-3 tabular-nums">{money(entry.hourly_amount)}</td>
        <td className="px-5 py-3 tabular-nums">{money(entry.class_amount)}</td>
        <td className="px-5 py-3 tabular-nums">{money(entry.commission_amount)}</td>
        <td className="px-5 py-3 tabular-nums">{money(entry.bonus)}</td>
        <td className="px-5 py-3 tabular-nums">{money(entry.deductions)}</td>
        <td className="px-5 py-3 text-right font-medium tabular-nums">{money(entry.net)}</td>
        {editable && (
          <td className="px-5 py-3 text-right">
            <Button variant="ghost" onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "Edit"}</Button>
          </td>
        )}
      </tr>
      {open && (
        <tr>
          <td colSpan={9} className="bg-gray-50/60 px-5 py-4">
            {error && <div className="mb-3"><Alert>{error}</Alert></div>}
            <div className="grid gap-3 sm:grid-cols-4">
              <Input label="Bonus" type="number" step="0.01" value={bonus} onChange={(e) => setBonus(e.target.value)} />
              <Input label="Deductions" type="number" step="0.01" value={deductions} onChange={(e) => setDeductions(e.target.value)} />
              <div className="sm:col-span-2">
                <Input label="Note (required)" required value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for adjustment" />
              </div>
            </div>
            <div className="mt-3">
              <Button loading={loading} disabled={!note} onClick={save}>Save adjustment</Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
