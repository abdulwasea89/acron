"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Spinner,
  StatCard,
} from "@/components/ui";
import { LiveIndicator, useRealtimeEvent } from "@/components/Realtime";
import { useModuleGate } from "@/hooks/useModuleGate";
import { api, ApiError } from "@/lib/api";
import { money, titleCase } from "@/lib/format";
import type { AttendanceMember, FrontDeskSummary, LockerOut, VisitorOut } from "@/lib/types";

/* ─── Front desk: walk-ins, day passes, guest log & lockers (#22) ───
   The desk's second surface after check-in: log a non-member (day pass takes
   payment into the ledger), check them out, and run the locker register. */

const KINDS = ["walk_in", "day_pass", "guest", "trial", "other"] as const;
const KIND_TONE: Record<string, "info" | "success" | "warning" | "neutral"> = {
  day_pass: "success",
  guest: "info",
  trial: "warning",
  walk_in: "neutral",
  other: "neutral",
};

function clock(iso: string): string {
  return new Date(iso + "Z").toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const selectCls =
  "h-9 w-full cursor-pointer rounded-md border border-foreground/20 bg-card px-2.5 text-[13px] text-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export default function FrontDeskPage() {
  const { ready } = useModuleGate("visitors");

  const [summary, setSummary] = useState<FrontDeskSummary | null>(null);
  const [visitors, setVisitors] = useState<VisitorOut[] | null>(null);
  const [lockers, setLockers] = useState<LockerOut[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Add-visitor form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("walk_in");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [hostQuery, setHostQuery] = useState("");
  const [hostResults, setHostResults] = useState<AttendanceMember[]>([]);
  const [host, setHost] = useState<AttendanceMember | null>(null);

  // Add-locker form
  const [newLocker, setNewLocker] = useState("");
  // Per-locker holder input
  const [holders, setHolders] = useState<Record<string, string>>({});

  const loadVisitors = useCallback(async () => {
    try {
      setVisitors(await api.get<VisitorOut[]>("/front-desk/visitors"));
    } catch (e) {
      setError((e as ApiError).message);
      setVisitors([]);
    }
  }, []);
  const loadLockers = useCallback(async () => {
    try {
      setLockers(await api.get<LockerOut[]>("/front-desk/lockers"));
    } catch {
      setLockers([]);
    }
  }, []);
  const loadSummary = useCallback(async () => {
    try {
      setSummary(await api.get<FrontDeskSummary>("/front-desk/summary"));
    } catch {
      /* secondary */
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadVisitors();
      void loadLockers();
      void loadSummary();
    });
  }, [loadVisitors, loadLockers, loadSummary]);

  useRealtimeEvent(["visitor.changed"], () => {
    void loadVisitors();
    void loadLockers();
    void loadSummary();
  });

  // Debounced host search (uses the check-in member search; front desk can read it).
  useEffect(() => {
    const term = hostQuery.trim();
    if (!term) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const rows = await api.get<AttendanceMember[]>(`/attendance/members?q=${encodeURIComponent(term)}`);
        if (!cancelled) setHostResults(rows);
      } catch {
        if (!cancelled) setHostResults([]);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [hostQuery]);

  function onHostQueryChange(value: string) {
    setHost(null);
    setHostQuery(value);
    if (!value.trim()) setHostResults([]);
  }

  async function logVisitor(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy("log");
    setError("");
    try {
      await api.post(
        "/front-desk/visitors",
        {
          name: name.trim(),
          phone: phone.trim() || null,
          kind,
          amount: kind === "day_pass" ? parseFloat(amount) || 0 : 0,
          method: kind === "day_pass" && parseFloat(amount) > 0 ? method : null,
          host_member_id: kind === "guest" && host ? host.member_id : null,
        },
        { "Idempotency-Key": crypto.randomUUID() },
      );
      setName("");
      setPhone("");
      setAmount("");
      setHost(null);
      setHostQuery("");
      void loadVisitors();
      void loadSummary();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  }

  async function checkOut(id: string) {
    setBusy(id);
    try {
      await api.post(`/front-desk/visitors/${id}/check-out`);
      void loadVisitors();
      void loadSummary();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  }

  async function addLocker(e: React.FormEvent) {
    e.preventDefault();
    if (!newLocker.trim()) return;
    setBusy("locker");
    setError("");
    try {
      await api.post("/front-desk/lockers", { number: newLocker.trim() });
      setNewLocker("");
      void loadLockers();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  }

  async function assignLocker(id: string) {
    const holder = (holders[id] ?? "").trim();
    if (!holder) return;
    setBusy(id);
    setError("");
    try {
      await api.post(`/front-desk/lockers/${id}/assign`, { holder_label: holder });
      setHolders((h) => ({ ...h, [id]: "" }));
      void loadLockers();
      void loadSummary();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  }

  async function releaseLocker(id: string) {
    setBusy(id);
    try {
      await api.post(`/front-desk/lockers/${id}/release`);
      void loadLockers();
      void loadSummary();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  }

  if (!ready) return <Spinner label="Loading front desk…" />;

  const showAmount = kind === "day_pass";

  return (
    <>
      <PageHeader title="Walk-ins" subtitle="Day passes, guest log and lockers" action={<LiveIndicator />} />

      {error && (
        <div className="mb-4">
          <Alert onDismiss={() => setError("")}>{error}</Alert>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Visitors today" value={String(summary?.visitors_today ?? "—")} accent />
        <StatCard label="Inside now" value={String(summary?.inside_now ?? "—")} />
        <StatCard label="Day-pass revenue" value={summary ? money(summary.day_pass_revenue) : "—"} />
        <StatCard
          label="Lockers busy"
          value={summary ? `${summary.lockers_occupied}/${summary.lockers_total}` : "—"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* Log a visitor */}
        <Card>
          <CardHeader title="Log a visitor" subtitle="Day passes take payment at the desk" />
          <form onSubmit={logVisitor} className="space-y-3 p-5">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
              <label className="block">
                <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Type</span>
                <select className={selectCls} value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])}>
                  {KINDS.map((k) => <option key={k} value={k}>{titleCase(k)}</option>)}
                </select>
              </label>
            </div>

            {showAmount && (
              <div className="grid grid-cols-2 gap-3">
                <Input label="Amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                <label className="block">
                  <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Method</span>
                  <select className={selectCls} value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="mobile_wallet">Mobile wallet</option>
                  </select>
                </label>
              </div>
            )}

            {kind === "guest" && (
              <div>
                <Input
                  label="Host member (optional)"
                  value={host ? (host.member_name || host.member_email) : hostQuery}
                  onChange={(e) => onHostQueryChange(e.target.value)}
                  placeholder="Search the member hosting them…"
                />
                {!host && hostResults.length > 0 && (
                  <ul className="mt-1 overflow-hidden rounded-md border border-foreground/10">
                    {hostResults.slice(0, 5).map((m) => (
                      <li key={m.member_id}>
                        <button
                          type="button"
                          onClick={() => { setHost(m); setHostResults([]); }}
                          className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-foreground/[0.04]"
                        >
                          {m.member_name || m.member_email}
                          <span className="truncate text-[11px] text-muted-foreground">{m.member_email}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <Button type="submit" loading={busy === "log"} disabled={!name.trim()}>Log visitor</Button>
          </form>
        </Card>

        {/* Guest log + lockers */}
        <div className="space-y-5">
          <Card className="flex flex-col overflow-hidden">
            <CardHeader
              title="Guest log"
              subtitle={visitors ? `${visitors.length} today` : "Loading…"}
            />
            {visitors === null ? (
              <div className="p-5"><Spinner label="Loading visitors…" /></div>
            ) : visitors.length === 0 ? (
              <EmptyState title="No visitors yet" hint="Log a walk-in or day pass to see them here." />
            ) : (
              <ul className="divide-y divide-foreground/[0.06]">
                {visitors.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={v.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-[13px] font-medium text-foreground">{v.name}</span>
                        <Badge tone={KIND_TONE[v.kind] ?? "neutral"} size="sm">{titleCase(v.kind)}</Badge>
                        {v.paid && v.amount > 0 && <Badge tone="success" size="sm">{money(v.amount)}</Badge>}
                        {v.host_name && <span className="text-[11px] text-muted-foreground">guest of {v.host_name}</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        In {clock(v.checked_in_at)}
                        {v.checked_out_at ? ` · out ${clock(v.checked_out_at)}` : " · inside"}
                        {v.locker_number ? ` · locker ${v.locker_number}` : ""}
                      </p>
                    </div>
                    {v.checked_out_at ? (
                      <Badge tone="neutral" size="sm">Out</Badge>
                    ) : (
                      <Button variant="secondary" disabled={busy === v.id} onClick={() => checkOut(v.id)}>
                        Check out
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Lockers */}
          <Card>
            <CardHeader title="Lockers" subtitle="Assign and release the register" />
            <form onSubmit={addLocker} className="flex items-end gap-2 px-5 pt-4">
              <Input label="Add locker" value={newLocker} onChange={(e) => setNewLocker(e.target.value)} placeholder="Number" className="w-32" />
              <Button type="submit" variant="secondary" loading={busy === "locker"} disabled={!newLocker.trim()}>Add</Button>
            </form>
            <div className="p-5">
              {lockers === null ? (
                <Spinner label="Loading lockers…" />
              ) : lockers.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">No lockers registered yet.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {lockers.map((l) => (
                    <li
                      key={l.id}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                        l.status === "occupied" ? "border-warning-border bg-warning-bg" : "border-foreground/10"
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-foreground/[0.06] font-mono text-[12px] font-semibold text-foreground">
                        {l.number}
                      </span>
                      {l.status === "occupied" ? (
                        <>
                          <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{l.holder_label}</span>
                          <Button variant="ghost" disabled={busy === l.id} onClick={() => releaseLocker(l.id)}>Release</Button>
                        </>
                      ) : (
                        <>
                          <input
                            value={holders[l.id] ?? ""}
                            onChange={(e) => setHolders((h) => ({ ...h, [l.id]: e.target.value }))}
                            placeholder="Holder"
                            className="h-7 min-w-0 flex-1 rounded-md border border-foreground/15 bg-card px-2 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none"
                          />
                          <Button variant="ghost" disabled={busy === l.id || !(holders[l.id] ?? "").trim()} onClick={() => assignLocker(l.id)}>
                            Assign
                          </Button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
