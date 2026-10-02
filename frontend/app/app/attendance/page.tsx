"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Spinner,
  StatCard,
} from "@/components/ui";
import { LiveIndicator, useRealtimeEvent } from "@/components/Realtime";
import { QrScanner } from "@/components/attendance/QrScanner";
import { useModuleGate } from "@/hooks/useModuleGate";
import { api, ApiError } from "@/lib/api";
import { titleCase } from "@/lib/format";
import type {
  AttendanceMember,
  AttendanceOut,
  AttendanceSummary,
  CheckInOut,
} from "@/lib/types";

/* ─── Attendance console (#18) ───
   The front desk's check-in surface. Search (or scan) → check in → the visit is
   logged and its status-on-check-in flags (dues, expired, birthday, slipping)
   surface immediately so the desk can act. Today's feed is live over the
   WebSocket, so a second desk / a member's app shows up here without refresh. */

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "active") return "success";
  if (status === "grace" || status === "pending_payment") return "warning";
  if (status === "expired" || status === "banned") return "danger";
  return "neutral";
}

/** Flags shown after a check-in: what the desk should notice about this member. */
function flagsFor(res: CheckInOut): { label: string; tone: "success" | "warning" | "danger" | "info" }[] {
  const out: { label: string; tone: "success" | "warning" | "danger" | "info" }[] = [];
  if (res.payment_due) out.push({ label: "Payment due", tone: "danger" });
  else if (res.membership_status !== "active") out.push({ label: titleCase(res.membership_status), tone: "warning" });
  if (res.birthday_today) out.push({ label: "Birthday today", tone: "info" });
  if (res.at_risk) out.push({ label: "Slipping — no visit in 14d", tone: "warning" });
  return out;
}

/** Accept `acron:member:<id>` or a bare member id from a scanned code. */
function parseMemberId(text: string): string {
  const trimmed = text.trim();
  const prefix = "acron:member:";
  return trimmed.startsWith(prefix) ? trimmed.slice(prefix.length) : trimmed;
}

function clock(iso: string): string {
  return new Date(iso + "Z").toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function relTime(iso: string, now: number): string {
  const s = Math.max(0, Math.floor((now - new Date(iso + "Z").getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso + "Z").toLocaleDateString();
}

const METHOD_ICON: Record<string, string> = {
  manual: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 1115 0v.75H4.5v-.75z",
  qr: "M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 12h10",
  app: "M7 3h10a1 1 0 011 1v16a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm5 14h.01",
  card: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z",
  biometric: "M12 11c0 3.517-1.009 6.799-2.753 9.571M12 3a9 9 0 019 9M3 12a9 9 0 019-9M15.9 5.5c.7.6 1.3 1.3 1.7 2.1M12 15a3 3 0 100-6 3 3 0 000 6z",
};

export default function AttendancePage() {
  const { ready } = useModuleGate("attendance");

  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [today, setToday] = useState<AttendanceOut[] | null>(null);
  const [results, setResults] = useState<AttendanceMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [lastCheckIn, setLastCheckIn] = useState<{ name: string; res: CheckInOut } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const searchRef = useRef<HTMLInputElement>(null);

  const loadToday = useCallback(async () => {
    try {
      setToday(await api.get<AttendanceOut[]>("/attendance/today"));
    } catch (e) {
      setError((e as ApiError).message);
      setToday([]);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await api.get<AttendanceSummary>("/attendance/summary"));
    } catch {
      /* summary is secondary; the console still works without it */
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadToday();
      void loadSummary();
    });
  }, [loadToday, loadSummary]);

  // Debounced server-side member search (name/email/phone). Gated by
  // TAKE_ATTENDANCE so front desk — the primary user — can read it.
  useEffect(() => {
    const term = query.trim();
    if (term === "") {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = setTimeout(async () => {
      try {
        setResults(await api.get<AttendanceMember[]>(`/attendance/members?q=${encodeURIComponent(term)}`));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => clearTimeout(id);
  }, [query]);

  // Keep relative timestamps honest.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useRealtimeEvent(["attendance.checked_in"], () => {
    void loadToday();
    void loadSummary();
  });

  const checkIn = useCallback(
    async (memberId: string, name: string, method: "manual" | "qr") => {
      setBusyId(memberId);
      setError("");
      try {
        const res = await api.post<CheckInOut>(
          "/attendance/check-in",
          { member_id: memberId, method },
          { "Idempotency-Key": crypto.randomUUID() },
        );
        setLastCheckIn({ name: res.member_name || name, res });
        setQuery("");
        searchRef.current?.focus();
        void loadToday();
        void loadSummary();
      } catch (e) {
        setError((e as ApiError).message);
      } finally {
        setBusyId(null);
      }
    },
    [loadToday, loadSummary],
  );

  const onScan = useCallback(
    async (text: string) => {
      setScanning(false);
      const memberId = parseMemberId(text);
      if (/^[0-9a-f]{16,}$/i.test(memberId)) {
        await checkIn(memberId, "", "qr");
      } else {
        setError("That QR code is not a member code for this gym.");
      }
    },
    [checkIn],
  );

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      const top = results[0];
      void checkIn(top.member_id, top.member_name || top.member_email, "manual");
    } else if (e.key === "Escape") {
      setQuery("");
    }
  }

  if (!ready) return <Spinner label="Loading check-in…" />;

  return (
    <>
      <PageHeader
        title="Check-in"
        subtitle="Log member visits and see who needs attention today"
        action={<LiveIndicator />}
      />

      {error && (
        <div className="mb-4">
          <Alert onDismiss={() => setError("")}>{error}</Alert>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Check-ins today" value={String(summary?.today_count ?? "—")} accent />
        <StatCard label="Unique members" value={String(summary?.unique_today ?? "—")} />
        <StatCard label="7-day daily avg" value={summary ? summary.avg_last_7_days.toFixed(1) : "—"} />
        <StatCard
          label="Slipping · 14d"
          value={String(summary?.dormant_members ?? "—")}
          hint="Active members with no visit in 14 days"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* ── Check-in ───────────────────────────────────────────────── */}
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="relative border-b border-foreground/10 bg-gradient-to-b from-brand/[0.06] to-transparent px-5 py-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Front desk
              </p>
              <h2 className="mt-0.5 text-[15px] font-semibold text-foreground">Who&apos;s arriving?</h2>
            </div>

            <div className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <Input
                  ref={searchRef}
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onSearchKey}
                  placeholder="Name, email or phone…"
                  aria-label="Search members to check in"
                  prefix={<SearchIcon className="h-4 w-4" />}
                  className="!h-11 !text-[15px]"
                />
                <Button
                  variant="secondary"
                  onClick={() => setScanning(true)}
                  className="!h-11 shrink-0 px-4"
                >
                  <ScanIcon className="h-4 w-4" />
                  Scan
                </Button>
              </div>

              {query.trim() === "" ? (
                <p className="px-0.5 text-[12px] text-muted-foreground">
                  Start typing a name, email or phone. Press{" "}
                  <kbd className="rounded border border-foreground/15 bg-secondary px-1 font-mono text-[10px]">Enter</kbd>{" "}
                  to check in the top match.
                </p>
              ) : searching && results.length === 0 ? (
                <p className="flex items-center gap-2 px-0.5 text-[12px] text-muted-foreground">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/60" />
                  Searching…
                </p>
              ) : results.length === 0 ? (
                <p className="px-0.5 text-[12px] text-muted-foreground">No one matches “{query}”.</p>
              ) : (
                <ul className="-mx-2 space-y-0.5">
                  {results.map((m, i) => (
                    <li key={m.member_id}>
                      <button
                        type="button"
                        disabled={busyId === m.member_id}
                        onClick={() =>
                          checkIn(m.member_id, m.member_name || m.member_email, "manual")
                        }
                        className="group flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-foreground/[0.04] disabled:opacity-50"
                      >
                        <Avatar name={m.member_name || m.member_email} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[13px] font-medium text-foreground">
                              {m.member_name || "—"}
                            </span>
                            <Badge tone={statusTone(m.member_status)} size="sm">
                              {titleCase(m.member_status)}
                            </Badge>
                          </span>
                          <span className="truncate text-[11px] text-muted-foreground">
                            {m.member_email}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100">
                          {i === 0 && <kbd className="font-mono text-[10px] text-muted-foreground">↵</kbd>}
                          <CheckIcon className="h-4 w-4" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {lastCheckIn && (
            <CheckInReceipt
              name={lastCheckIn.name}
              res={lastCheckIn.res}
              onDismiss={() => setLastCheckIn(null)}
            />
          )}
        </div>

        {/* ── Today ──────────────────────────────────────────────────── */}
        <Card className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-foreground/10 px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Today</h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {today ? `${today.length} visit${today.length === 1 ? "" : "s"} logged` : "Loading…"}
              </p>
            </div>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-foreground/10 bg-surface px-3">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Live</span>
            </span>
          </div>

          {today === null ? (
            <div className="p-5">
              <Spinner label="Loading today’s check-ins…" />
            </div>
          ) : today.length === 0 ? (
            <EmptyState
              title="No check-ins yet today"
              hint="Visits logged here or scanned from the app will appear in real time."
            />
          ) : (
            <ul className="max-h-[calc(100vh-22rem)] divide-y divide-foreground/10 overflow-y-auto">
              {today.map((a) => (
                <li key={a.id} className="flex animate-slide-up items-center gap-3 px-5 py-3">
                  <Avatar name={a.member_name || "?"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{a.member_name || "—"}</p>
                    <p className="text-[11px] text-muted-foreground">{clock(a.checked_in_at)}</p>
                  </div>
                  <Badge tone="neutral" size="sm">
                    <span className="inline-flex items-center gap-1">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d={METHOD_ICON[a.method] ?? METHOD_ICON.manual} />
                      </svg>
                      {titleCase(a.method)}
                    </span>
                  </Badge>
                  <span className="w-16 text-right text-[11px] tabular-nums text-muted-foreground">
                    {relTime(a.checked_in_at, now)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {scanning && <QrScanner onResult={onScan} onClose={() => setScanning(false)} />}
    </>
  );
}

/* The check-in "receipt": who, when, and what the desk should notice. */
function CheckInReceipt({
  name,
  res,
  onDismiss,
}: {
  name: string;
  res: CheckInOut;
  onDismiss: () => void;
}) {
  const flags = flagsFor(res);
  return (
    <Card className="animate-slide-up overflow-hidden border-success-border">
      <div className="flex items-start gap-3 bg-success-bg px-5 py-4">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-white">
          <CheckIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground">
            Checked in {name || res.member_name || "member"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {clock(res.checked_in_at)} · {titleCase(res.method)} ·{" "}
            {res.visits_today === 1 ? "first visit today" : `visit #${res.visits_today} today`}
          </p>
          {flags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {flags.map((f) => (
                <Badge key={f.label} tone={f.tone} size="sm">{f.label}</Badge>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </Card>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
    </svg>
  );
}

function ScanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 12h10" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
