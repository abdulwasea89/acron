"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { QrScanner } from "@/components/attendance/QrScanner";
import { useModuleGate } from "@/hooks/useModuleGate";
import { api, ApiError } from "@/lib/api";
import { money, titleCase } from "@/lib/format";
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
   WebSocket, so a second desk / a member's app shows up here without refresh.

   Offline (#23): the roster is cached, so search works with no network, and
   check-ins are queued locally and flushed to /attendance/sync on reconnect. */

const ROSTER_KEY = "acron.attendance.roster";
const QUEUE_KEY = "acron.attendance.queue";

type QueuedCheckin = {
  id: string;
  member_id: string;
  name: string;
  method: "manual" | "qr";
  checked_in_at: string;   // naive UTC, "YYYY-MM-DDTHH:MM:SS"
  idempotency_key: string;
};

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "active") return "success";
  if (status === "grace" || status === "pending_payment") return "warning";
  if (status === "expired" || status === "banned") return "danger";
  return "neutral";
}

/** Flags shown after a check-in: what the desk should notice about this member. */
type StatusLike = {
  payment_due?: boolean;
  amount_due?: number | null;
  currency?: string | null;
  birthday_today?: boolean;
  at_risk?: boolean;
  days_since_last_visit?: number | null;
};

/** The status-on-check-in badges (#19): dues (with amount), birthday, slipping. */
function StatusBadges({ item }: { item: StatusLike }) {
  return (
    <>
      {item.payment_due && (
        <Badge tone="danger" size="sm">
          {item.amount_due != null
            ? `Due ${money(item.amount_due, item.currency ?? "USD")}`
            : "Dues owed"}
        </Badge>
      )}
      {item.birthday_today && <Badge tone="info" size="sm">Birthday</Badge>}
      {item.at_risk && <Badge tone="warning" size="sm">Slipping</Badge>}
    </>
  );
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

/* Icons for the KPI strip, matching the dashboard's stat-tile language. */
const METRIC_ICON = {
  checkin: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  members:
    "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
  average:
    "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  slipping: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
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

  // Offline (#23): cached roster, a local queue, and the current connectivity.
  const [online, setOnline] = useState(true);
  const [roster, setRoster] = useState<AttendanceMember[]>([]);
  const [queue, setQueue] = useState<QueuedCheckin[]>([]);
  const [syncing, setSyncing] = useState(false);

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

  // Cache the roster so offline search still works; load any queued check-ins.
  useEffect(() => {
    queueMicrotask(() => {
      setRoster(loadJSON<AttendanceMember[]>(ROSTER_KEY, []));
      setQueue(loadJSON<QueuedCheckin[]>(QUEUE_KEY, []));
      setOnline(navigator.onLine);
    });
  }, []);

  const refreshRoster = useCallback(async () => {
    try {
      const rows = await api.get<AttendanceMember[]>("/attendance/roster");
      setRoster(rows);
      localStorage.setItem(ROSTER_KEY, JSON.stringify(rows));
    } catch {
      /* keep the cached roster */
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refreshRoster());
  }, [refreshRoster]);

  const flush = useCallback(
    async (items: QueuedCheckin[]) => {
      if (items.length === 0) return;
      setSyncing(true);
      try {
        const res = await api.post<{ results: { id: string; status: string }[] }>(
          "/attendance/sync",
          {
            items: items.map((q) => ({
              id: q.id,
              member_id: q.member_id,
              method: q.method,
              checked_in_at: q.checked_in_at,
              idempotency_key: q.idempotency_key,
            })),
          },
        );
        const okIds = new Set(res.results.filter((r) => r.status === "synced").map((r) => r.id));
        setQueue((prev) => {
          const remaining = prev.filter((q) => !okIds.has(q.id));
          localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
          return remaining;
        });
        void loadToday();
        void loadSummary();
      } catch {
        setOnline(false); // still offline; retry on the next 'online'
      } finally {
        setSyncing(false);
      }
    },
    [loadToday, loadSummary],
  );

  // Flush leftovers on mount, and whenever connectivity returns.
  useEffect(() => {
    queueMicrotask(() => {
      if (navigator.onLine) {
        const pending = loadJSON<QueuedCheckin[]>(QUEUE_KEY, []);
        if (pending.length) void flush(pending);
      }
    });
  }, [flush]);

  useEffect(() => {
    const up = () => {
      setOnline(true);
      void flush(loadJSON<QueuedCheckin[]>(QUEUE_KEY, []));
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [flush]);

  // Debounced server-side member search (name/email/phone). Gated by
  // TAKE_ATTENDANCE so front desk — the primary user — can read it. The
  // immediate search/clear states are set in the input handler, so the effect
  // only owns the async fetch.
  useEffect(() => {
    const term = query.trim();
    if (term === "" || !online) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const rows = await api.get<AttendanceMember[]>(`/attendance/members?q=${encodeURIComponent(term)}`);
        if (!cancelled) setResults(rows);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query, online]);

  function onQueryChange(value: string) {
    setQuery(value);
    if (value.trim() === "") {
      setResults([]);
      setSearching(false);
    } else {
      setSearching(online);
    }
  }

  // Keep relative timestamps honest.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // `/` anywhere jumps the cursor into the check-in bar — the front desk lives
  // on the keyboard, so the primary action is always one keystroke away.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement | null)?.isContentEditable;
      if (typing) return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useRealtimeEvent(["attendance.checked_in"], () => {
    void loadToday();
    void loadSummary();
  });

  const checkIn = useCallback(
    async (memberId: string, name: string, method: "manual" | "qr") => {
      setBusyId(memberId);
      setError("");
      const idem = crypto.randomUUID();

      const enqueue = () => {
        const item: QueuedCheckin = {
          id: crypto.randomUUID(),
          member_id: memberId,
          name,
          method,
          checked_in_at: new Date().toISOString().slice(0, 19),
          idempotency_key: idem,
        };
        setQueue((prev) => {
          const next = [...prev, item];
          localStorage.setItem(QUEUE_KEY, JSON.stringify(next));
          return next;
        });
        setQuery("");
        setResults([]);
        setSearching(false);
        searchRef.current?.focus();
      };

      if (!online) {
        enqueue();
        setBusyId(null);
        return;
      }
      try {
        const res = await api.post<CheckInOut>(
          "/attendance/check-in",
          { member_id: memberId, method },
          { "Idempotency-Key": idem },
        );
        setLastCheckIn({ name: res.member_name || name, res });
        setQuery("");
        setResults([]);
        setSearching(false);
        searchRef.current?.focus();
        void loadToday();
        void loadSummary();
      } catch (e) {
        if (e instanceof ApiError) {
          setError(e.message);
        } else {
          // Network failure — drop offline and queue the visit.
          setOnline(false);
          enqueue();
        }
      } finally {
        setBusyId(null);
      }
    },
    [online, loadToday, loadSummary],
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

  // Offline search runs over the cached roster; online uses the server results.
  const offlineResults = useMemo(() => {
    const t = query.trim().toLowerCase();
    if (!t) return [];
    return roster
      .filter(
        (m) =>
          (m.member_name ?? "").toLowerCase().includes(t) ||
          m.member_email.toLowerCase().includes(t) ||
          (m.phone ?? "").includes(query.trim()),
      )
      .slice(0, 8);
  }, [query, roster]);
  const shown = online ? results : offlineResults;

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && shown.length > 0) {
      e.preventDefault();
      const top = shown[0];
      void checkIn(top.member_id, top.member_name || top.member_email, "manual");
    } else if (e.key === "Escape") {
      onQueryChange("");
    }
  }

  if (!ready) return <Spinner label="Loading check-in…" />;

  const hasQuery = query.trim() !== "";

  return (
    <>
      <PageHeader
        title="Check-in"
        subtitle="The front desk's live console — log arrivals and act on who needs attention."
        action={<LiveIndicator />}
      />

      {error && (
        <div className="mb-4">
          <Alert onDismiss={() => setError("")}>{error}</Alert>
        </div>
      )}

      {(!online || queue.length > 0) && (
        <div className="mb-4">
          <Alert tone={online ? "warning" : "info"}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {online
                  ? `${queue.length} check-in${queue.length === 1 ? "" : "s"} waiting to sync.`
                  : `Offline — ${queue.length} check-in${queue.length === 1 ? "" : "s"} queued. Search still works; visits sync when you reconnect.`}
              </span>
              {online && queue.length > 0 && (
                <Button
                  variant="secondary"
                  loading={syncing}
                  onClick={() => flush(loadJSON<QueuedCheckin[]>(QUEUE_KEY, []))}
                >
                  Sync now
                </Button>
              )}
            </div>
          </Alert>
        </div>
      )}

      {/* KPI strip — one surface, hairline-separated cells (matches the dashboard). */}
      <div className="mb-5 grid grid-cols-1 gap-px overflow-hidden border border-foreground/10 bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          joined
          accent
          label="Check-ins today"
          value={String(summary?.today_count ?? "—")}
          icon={<MetricIcon d={METRIC_ICON.checkin} />}
        />
        <StatCard
          joined
          label="Unique members"
          value={String(summary?.unique_today ?? "—")}
          icon={<MetricIcon d={METRIC_ICON.members} />}
        />
        <StatCard
          joined
          label="7-day daily avg"
          value={summary ? summary.avg_last_7_days.toFixed(1) : "—"}
          icon={<MetricIcon d={METRIC_ICON.average} />}
        />
        <StatCard
          joined
          label="Slipping · 14d"
          value={String(summary?.dormant_members ?? "—")}
          hint="Active members with no visit in 14 days"
          icon={<MetricIcon d={METRIC_ICON.slipping} />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ── Check-in command bar ───────────────────────────────────── */}
        <div className="space-y-5 lg:col-span-2">
          <Card className="overflow-hidden">
            {/* Stage: the desk's whole job, given the top of the page. */}
            <div className="relative border-b border-foreground/10 px-5 py-4">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-brand/[0.06] to-transparent"
                aria-hidden="true"
              />
              <h2 className="relative text-lg font-semibold leading-tight tracking-tight text-foreground sm:text-xl">
                Who&rsquo;s arriving?
              </h2>

              <div className="relative mt-3">
                <Input
                  ref={searchRef}
                  autoFocus
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  onKeyDown={onSearchKey}
                  placeholder="Search name, email or phone…"
                  aria-label="Search members to check in"
                  prefix={<SearchIcon className="h-4 w-4" />}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setScanning(true)}
                      aria-label="Scan member QR code"
                      title="Scan QR code"
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                    >
                      <ScanIcon className="h-4 w-4" />
                    </button>
                  }
                />
              </div>

              <div className="relative mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <Hint k="Enter">check in top match</Hint>
                <Hint k="/">focus search</Hint>
              </div>
            </div>

            {/* Results / idle */}
            <div className="p-2">
              {!hasQuery ? (
                <div className="flex items-center gap-2.5 px-3 py-3 text-[12px] text-muted-foreground">
                  <SearchIcon className="h-3.5 w-3.5 shrink-0" />
                  Start typing to find a member — or scan their QR code.
                </div>
              ) : searching && shown.length === 0 ? (
                <div className="flex items-center gap-2.5 px-3 py-3 text-[12px] text-muted-foreground">
                  <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/60" />
                  Searching…
                </div>
              ) : shown.length === 0 ? (
                <div className="px-3 py-3 text-[12px] text-muted-foreground">
                  No one matches “{query}”. Try an email or phone number.
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {shown.map((m, i) => (
                    <li key={m.member_id}>
                      <button
                        type="button"
                        disabled={busyId === m.member_id}
                        onClick={() =>
                          checkIn(m.member_id, m.member_name || m.member_email, "manual")
                        }
                        className="group flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-foreground/[0.04] focus-visible:bg-foreground/[0.04] focus-visible:outline-none disabled:opacity-50"
                      >
                        <Avatar name={m.member_name || m.member_email} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-[13px] font-medium text-foreground">
                              {m.member_name || "—"}
                            </span>
                            <Badge tone={statusTone(m.member_status)} size="sm">
                              {titleCase(m.member_status)}
                            </Badge>
                            <StatusBadges item={m} />
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                            {m.member_email}
                          </span>
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          {i === 0 && (
                            <kbd className="rounded border border-foreground/15 bg-secondary px-1 font-mono text-[10px] text-muted-foreground">
                              ↵
                            </kbd>
                          )}
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
        <Card className="flex flex-col overflow-hidden lg:col-span-1">
          <CardHeader
            title="Today"
            subtitle={
              today ? `${today.length} visit${today.length === 1 ? "" : "s"} logged` : "Loading…"
            }
            action={
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-foreground/10 bg-surface px-3">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Live</span>
              </span>
            }
          />

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
            <ul className="max-h-[calc(100vh-22rem)] divide-y divide-[var(--border)] overflow-y-auto">
              {today.map((a) => (
                <li
                  key={a.id}
                  className="flex animate-slide-up items-center gap-3 px-5 py-2.5 transition-colors hover:bg-foreground/[0.03]"
                >
                  <Avatar name={a.member_name || "?"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {a.member_name || "—"}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d={METHOD_ICON[a.method] ?? METHOD_ICON.manual} />
                        </svg>
                        {titleCase(a.method)} · {clock(a.checked_in_at)}
                      </span>
                      <StatusBadges item={a} />
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
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
  const who = name || res.member_name || "member";
  const showBadges = res.payment_due || res.birthday_today || res.at_risk;
  return (
    <Card className="animate-slide-up overflow-hidden border-success-border">
      <div className="flex items-start gap-3.5 bg-success-bg px-5 py-4">
        <span className="relative shrink-0">
          <Avatar name={who} size="md" />
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--success-bg)] bg-success text-white">
            <CheckIcon className="h-3 w-3" />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-foreground">Checked in {who}</p>
          {res.hint && (
            <p className="mt-1 text-[12.5px] font-medium text-foreground/90">{res.hint}</p>
          )}
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {clock(res.checked_in_at)} · {titleCase(res.method)} ·{" "}
            {res.visits_today === 1 ? "first visit today" : `visit #${res.visits_today} today`}
          </p>
          {showBadges && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusBadges item={res} />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </Card>
  );
}

/** A keyboard-shortcut legend chip: keycap + its action. */
function Hint({ k, children }: { k: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd className="rounded border border-foreground/15 bg-secondary px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
        {k}
      </kbd>
      {children}
    </span>
  );
}

function MetricIcon({ d }: { d: string }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
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
