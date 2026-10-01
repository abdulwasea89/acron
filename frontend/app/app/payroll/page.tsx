"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ListToolbar } from "@/components/ListToolbar";
import { RowMenu, type RowAction } from "@/components/RowMenu";
import { Glyph } from "@/components/Glyph";
import { TABLE, THEAD_ROW, TH, TR, TD, CELL, CELL_FIRST, CELL_LAST } from "@/components/Table";
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
import { Alert, Badge, Button, EmptyState, Input, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { money, statusTone, titleCase } from "@/lib/format";
import type { MemberDirectoryItem, PayrollEntry, PayrollRun } from "@/lib/types";

/* ── Payroll ──────────────────────────────────────────────────────────────
   Two levels: the runs, and the entries inside a run. The runs are a table —
   they are a list, and a list of periods that scrolls is far easier to scan
   than a stack of panels. The entries are a detail, so they ride in a sheet
   beside the table instead of expanding under every row and pushing the rest
   of the list off screen. */

export default function PayrollPage() {
  const [runs, setRuns] = useState<PayrollRun[] | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [openRun, setOpenRun] = useState<PayrollRun | null>(null);
  const [runSearch, setRunSearch] = useState("");
  const [runStatus, setRunStatus] = useState("all");
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
      // Keep the open sheet in step with the data it is showing.
      setOpenRun((current) => (current ? runsData.find((r) => r.id === current.id) ?? null : null));
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

  const allRuns = runs ?? [];

  const runTabs = [
    { value: "all", label: "All", count: allRuns.length },
    ...Array.from(new Set(allRuns.map((r) => r.status))).map((s) => ({
      value: s,
      label: titleCase(s),
      count: allRuns.filter((r) => r.status === s).length,
    })),
  ];

  const runQ = runSearch.trim().toLowerCase();
  const filteredRuns = allRuns.filter((r) => {
    if (runStatus !== "all" && r.status !== runStatus) return false;
    if (!runQ) return true;
    return (
      r.period_start.includes(runQ) ||
      r.period_end.includes(runQ) ||
      r.status.toLowerCase().includes(runQ)
    );
  });

  return (
    <>
      <PageHeader
        title="Payroll"
        subtitle="Draft, review, finalize and pay staff for each period"
        action={
          <Button onClick={() => setShowForm(true)}>
            <Glyph className="h-4 w-4">
              <path d="M12 4.5v15m7.5-7.5h-15" />
            </Glyph>
            New payroll run
          </Button>
        }
      />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {/* Create lives in a sheet: it is about the runs below it, so the list
          stays in view while you fill the dates in. */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="[--sheet-max-w:520px]">
          <SheetHeader className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle>New payroll run</SheetTitle>
              <SheetDescription>Generates a draft with one entry per active staff member.</SheetDescription>
            </div>
          </SheetHeader>
          <RunForm
            onCreated={() => {
              setShowForm(false);
              load();
            }}
          />
        </SheetContent>
      </Sheet>

      <ListToolbar
        tabs={runTabs}
        value={runStatus}
        onChange={setRunStatus}
        search={runSearch}
        onSearch={setRunSearch}
        searchPlaceholder="Search payroll runs…"
      />

      {/* Flat workspace, not a card: rows are held by hairlines. */}
      <div className="mt-3">
        {runs === null ? (
          <Spinner label="Loading payroll runs..." />
        ) : runs.length === 0 ? (
          <EmptyState
            title="No payroll runs yet"
            hint="Create a draft for the current pay period to generate staff entries."
            action={
              <Button onClick={() => setShowForm(true)}>
                Create first payroll run
              </Button>
            }
          />
        ) : filteredRuns.length === 0 ? (
          <EmptyState title="No runs match" hint="Try a different search or status filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr className={THEAD_ROW}>
                  <th className={`${TH} ${CELL_FIRST}`}>Period</th>
                  <th className={`${TH} ${CELL}`}>Status</th>
                  <th className={`${TH} ${CELL} text-right`}>Staff</th>
                  <th className={`${TH} ${CELL} text-right`}>Gross</th>
                  <th className={`${TH} ${CELL} text-right`}>Deductions</th>
                  <th className={`${TH} ${CELL_LAST} text-right`}>Net</th>
                  <th className={`${TH} ${CELL_LAST} w-12`} />
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((run) => (
                  <tr key={run.id} className={`${TR} transition-colors hover:bg-foreground/[0.02]`}>
                    <td className={`${TD} ${CELL_FIRST} py-2.5`}>
                      <button
                        type="button"
                        onClick={() => setOpenRun(run)}
                        className="text-left font-medium text-[var(--foreground)] hover:underline"
                      >
                        {run.period_start} → {run.period_end}
                      </button>
                    </td>
                    <td className={`${TD} ${CELL} py-2.5`}>
                      <Badge tone={statusTone(run.status)}>{titleCase(run.status)}</Badge>
                    </td>
                    <td className={`${TD} ${CELL} py-2.5 text-right tabular-nums text-[var(--foreground-muted)]`}>
                      {run.entries.length}
                    </td>
                    <td className={`${TD} ${CELL} py-2.5 text-right tabular-nums text-[var(--foreground-muted)]`}>
                      {money(run.total_gross)}
                    </td>
                    <td className={`${TD} ${CELL} py-2.5 text-right tabular-nums text-[var(--foreground-muted)]`}>
                      {money(run.total_deductions)}
                    </td>
                    <td className={`${TD} ${CELL} py-2.5 text-right font-semibold tabular-nums text-[var(--foreground)]`}>
                      {money(run.total_net)}
                    </td>
                    <td className={`${TD} ${CELL_LAST} py-2.5 text-right`}>
                      <RowMenu actions={runActions(run, setOpenRun, act)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* The run's entries: a sheet, so the run list stays visible and the
          header (totals + lifecycle action) never scrolls away from you. */}
      <Sheet open={!!openRun} onOpenChange={(open) => { if (!open) setOpenRun(null); }}>
        <SheetContent className="[--sheet-max-w:720px]">
          {openRun && (
            <RunSheet
              key={openRun.id}
              run={openRun}
              staffMap={staffMap}
              onAction={act}
              onChanged={load}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/* One lifecycle action at a time — the status decides which — plus the
   destructive "delete this draft" that only a draft is allowed to offer. */
function runActions(
  run: PayrollRun,
  open: (run: PayrollRun) => void,
  act: (id: string, action: string) => void,
): RowAction[] {
  const actions: RowAction[] = [
    {
      label: "View entries",
      icon: (
        <Glyph className="h-4 w-4">
          <path d="M2.25 12S5.5 5.25 12 5.25 21.75 12 21.75 12 18.5 18.75 12 18.75 2.25 12 2.25 12Z" />
          <circle cx="12" cy="12" r="2.25" />
        </Glyph>
      ),
      onSelect: () => open(run),
    },
  ];
  if (run.status === "draft") {
    actions.push({
      label: "Lock run",
      icon: (
        <Glyph className="h-4 w-4">
          <path d="M16.5 10.5V6.75a4.5 4.5 0 1 1-9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </Glyph>
      ),
      onSelect: () => act(run.id, "lock"),
    });
  }
  if (run.status === "locked") {
    actions.push({
      label: "Finalize run",
      icon: (
        <Glyph className="h-4 w-4">
          <path d="M4.5 12.75l6 6 9-13.5" />
        </Glyph>
      ),
      onSelect: () => act(run.id, "finalize"),
    });
  }
  if (run.status === "finalized") {
    actions.push({
      label: "Mark paid",
      icon: (
        <Glyph className="h-4 w-4">
          <path d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75a.75.75 0 0 1-.75.75h-3m-2.25 0h.75c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125H3.75m0 0a1.5 1.5 0 0 1-1.5-1.5V15a1.5 1.5 0 0 1 1.5-1.5h1.5" />
        </Glyph>
      ),
      onSelect: () => act(run.id, "pay"),
    });
  }
  return actions;
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
    /* `flex` + `contents` on the form: the form itself must not be a flex
       item or it will sit beside the footer instead of filling the sheet. */
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <SheetBody className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Input label="Period start" type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
        <Input label="Period end" type="date" required value={end} onChange={(e) => setEnd(e.target.value)} />
      </SheetBody>
      <SheetFooter>
        <SheetClose asChild>
          <Button variant="secondary" type="button">Cancel</Button>
        </SheetClose>
        <Button type="submit" loading={loading}>Generate draft</Button>
      </SheetFooter>
    </form>
  );
}

function RunSheet({
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
  const lifecycle = runActions(run, () => {}, onAction).filter((a) => a.label !== "View entries");

  return (
    <form className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="flex items-start justify-between gap-4">
        <div>
          <SheetTitle>{run.period_start} → {run.period_end}</SheetTitle>
          <SheetDescription>
            Gross {money(run.total_gross)} · Deductions {money(run.total_deductions)} · Net{" "}
            <span className="font-medium text-foreground">{money(run.total_net)}</span>
          </SheetDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={statusTone(run.status)}>{titleCase(run.status)}</Badge>
          <SheetClose asChild>
            <button
              type="button"
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <Glyph className="h-4 w-4"><path d="M6 18 18 6M6 6l12 12" /></Glyph>
            </button>
          </SheetClose>
        </div>
      </SheetHeader>

      <SheetBody className="p-0">
        {run.entries.length === 0 ? (
          <div className="px-6 py-8">
            <EmptyState title="No entries" hint="This run has no staff entries." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr className={THEAD_ROW}>
                  <th className={`${TH} ${CELL_FIRST}`}>Staff</th>
                  <th className={`${TH} ${CELL}`}>Fixed</th>
                  <th className={`${TH} ${CELL}`}>Hourly</th>
                  <th className={`${TH} ${CELL}`}>Classes</th>
                  <th className={`${TH} ${CELL}`}>Commission</th>
                  <th className={`${TH} ${CELL}`}>Bonus</th>
                  <th className={`${TH} ${CELL}`}>Deductions</th>
                  <th className={`${TH} ${CELL_LAST} text-right`}>Net</th>
                  {editable && <th className={`${TH} ${CELL_LAST} text-right`}>Adjust</th>}
                </tr>
              </thead>
              <tbody>
                {run.entries.map((e) => (
                  <EntryRow key={e.id} runId={run.id} entry={e} staffMap={staffMap} editable={editable} onChanged={onChanged} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SheetBody>

      {lifecycle.length > 0 && (
        <SheetFooter>
          {lifecycle.map((a) => (
            <Button key={a.label} type="button" onClick={a.onSelect}>
              {a.label}
            </Button>
          ))}
        </SheetFooter>
      )}
    </form>
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
  entry: PayrollEntry;
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

  const columns = 8 + (editable ? 1 : 0);

  return (
    <>
      <tr className={`${TR} transition-colors hover:bg-foreground/[0.02]`}>
        <td className={`${TD} ${CELL_FIRST} py-2.5 font-medium text-[var(--foreground)]`}>
          {staffMap[entry.staff_member_id] || entry.staff_member_id.slice(0, 8)}
        </td>
        <td className={`${TD} ${CELL} py-2.5 tabular-nums`}>{money(entry.fixed)}</td>
        <td className={`${TD} ${CELL} py-2.5 tabular-nums`}>{money(entry.hourly_amount)}</td>
        <td className={`${TD} ${CELL} py-2.5 tabular-nums`}>{money(entry.class_amount)}</td>
        <td className={`${TD} ${CELL} py-2.5 tabular-nums`}>{money(entry.commission_amount)}</td>
        <td className={`${TD} ${CELL} py-2.5 tabular-nums`}>{money(entry.bonus)}</td>
        <td className={`${TD} ${CELL} py-2.5 tabular-nums`}>{money(entry.deductions)}</td>
        <td className={`${TD} ${CELL_LAST} py-2.5 text-right font-semibold tabular-nums text-[var(--foreground)]`}>
          {money(entry.net)}
        </td>
        {editable && (
          <td className={`${TD} ${CELL_LAST} py-2.5 text-right`}>
            <Button variant="ghost" onClick={() => setOpen((o) => !o)}>
              {open ? "Cancel" : "Adjust"}
            </Button>
          </td>
        )}
      </tr>
      {open && (
        <tr className={TR}>
          <td colSpan={columns} className={`${TD} ${CELL} bg-[var(--background)] p-4`}>
            {error && <div className="mb-3"><Alert>{error}</Alert></div>}
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Bonus" type="number" step="0.01" value={bonus} onChange={(e) => setBonus(e.target.value)} />
              <Input label="Deductions" type="number" step="0.01" value={deductions} onChange={(e) => setDeductions(e.target.value)} />
              <Input label="Note (required)" required value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for adjustment" />
            </div>
            <div className="mt-4">
              <Button loading={loading} disabled={!note} onClick={save}>Save adjustment</Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}