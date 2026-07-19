"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { PageHeader } from "@/components/PageHeader";
import { Dialog } from "@/components/Dialog";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Select, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useRealtimeEvent } from "@/components/Realtime";
import type { ClassSessionOut, ClassSessionCreate, MemberDirectoryItem, BookingWithMember } from "@/lib/types";

export default function ClassesPage() {
  const currentUser = useCurrentUser();
  const [sessions, setSessions] = useState<ClassSessionOut[] | null>(null);
  const [members, setMembers] = useState<MemberDirectoryItem[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"upcoming" | "past" | "cancelled">("upcoming");
  const [showForm, setShowForm] = useState(false);
  const [cancelling, setCancelling] = useState<ClassSessionOut | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formTrainer, setFormTrainer] = useState("");
  const [formStartsAt, setFormStartsAt] = useState("");
  const [formEndsAt, setFormEndsAt] = useState("");
  const [formCapacity, setFormCapacity] = useState("20");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Bookings dialog
  const [bookingsSession, setBookingsSession] = useState<ClassSessionOut | null>(null);
  const [bookings, setBookings] = useState<BookingWithMember[] | null>(null);
  const [bookingsError, setBookingsError] = useState("");

  // Check-in
  const [checkInLoading, setCheckInLoading] = useState<string | null>(null);

  // Kebab menu
  const [menuSession, setMenuSession] = useState<ClassSessionOut | null>(null);
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);

  const isStaff = currentUser?.role === "owner" || currentUser?.role === "manager" || currentUser?.role === "trainer";

  const load = useCallback(async () => {
    setError("");
    try {
      const c = await api.get<ClassSessionOut[]>("/classes");
      setSessions(c);
    } catch (e) {
      setError((e as ApiError).message);
      setSessions([]);
    }
    try {
      const m = await api.get<MemberDirectoryItem[]>("/members");
      setMembers(m);
    } catch {
      // best-effort for trainer names
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  useRealtimeEvent(["classes.changed"], load);

  const trainerById = Object.fromEntries(
    members.map((m) => [m.member_id, m.display_name || m.full_name || m.email]),
  );

  const trainers = members.filter((m) => m.role === "trainer" || m.role === "manager" || m.role === "owner");

  const now = new Date();
  const filtered = (sessions ?? []).filter((s) => {
    if (s.cancelled) return filter === "cancelled";
    const start = new Date(s.starts_at);
    if (filter === "upcoming") return start >= now;
    if (filter === "past") return start < now;
    return true;
  });

  const tabs = [
    { value: "upcoming" as const, label: "Upcoming" },
    { value: "past" as const, label: "Past" },
    { value: "cancelled" as const, label: "Cancelled" },
  ];

  function resetForm() {
    setFormTitle("");
    setFormTrainer("");
    setFormStartsAt("");
    setFormEndsAt("");
    setFormCapacity("20");
    setFormError("");
    setShowForm(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);
    try {
      const body: ClassSessionCreate = {
        title: formTitle,
        trainer_member_id: formTrainer || undefined,
        starts_at: new Date(formStartsAt).toISOString(),
        ends_at: formEndsAt ? new Date(formEndsAt).toISOString() : undefined,
        capacity: parseInt(formCapacity, 10) || 20,
      };
      await api.post("/classes", body);
      resetForm();
      load();
    } catch (e) {
      setFormError((e as ApiError).message);
    } finally {
      setFormLoading(false);
    }
  }

  async function confirmCancel() {
    if (!cancelling) return;
    setError("");
    try {
      await api.post(`/classes/${cancelling.id}/cancel`);
      setCancelling(null);
      load();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function doCheckIn(session: ClassSessionOut) {
    setCheckInLoading(session.id);
    setError("");
    try {
      await api.post(`/classes/${session.id}/check-in`);
      load();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setCheckInLoading(null);
    }
  }

  async function loadBookings(session: ClassSessionOut) {
    setBookingsSession(session);
    setBookings(null);
    setBookingsError("");
    try {
      const b = await api.get<BookingWithMember[]>(`/classes/${session.id}/bookings`);
      setBookings(b);
    } catch (e) {
      setBookingsError((e as ApiError).message);
    }
  }

  function closeMenu() { setMenuSession(null); setMenuPos(null); }

  function openMenu(session: ClassSessionOut, e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const vh = window.innerHeight;
    const top = rect.bottom + 4;
    setMenuPos(top + 200 > vh
      ? { bottom: vh - rect.top + 4, right: document.documentElement.clientWidth - rect.right }
      : { top, right: document.documentElement.clientWidth - rect.right });
    setMenuSession(session);
  }

  useEffect(() => {
    if (!menuSession) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeMenu(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [Boolean(menuSession)]);

  function fmtDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function sessionStatus(s: ClassSessionOut): { label: string; tone: "info" | "success" | "neutral" | "warning" } {
    if (s.cancelled) return { label: "Cancelled", tone: "warning" };
    const start = new Date(s.starts_at);
    const end = s.ends_at ? new Date(s.ends_at) : null;
    if (start > now) return { label: "Upcoming", tone: "info" };
    if (end && end < now) return { label: "Done", tone: "neutral" };
    return { label: "Live", tone: "success" };
  }

  function capacityColor(booked: number, capacity: number): string {
    const ratio = booked / capacity;
    if (ratio >= 1) return "bg-[var(--danger)]";
    if (ratio >= 0.7) return "bg-[var(--warning)]";
    return "bg-[var(--success)]";
  }

  return (
    <>
      <PageHeader
        title="Classes"
        subtitle="Schedule and manage class sessions"
        action={
          <Button onClick={() => { resetForm(); setShowForm(true); }}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Schedule class
          </Button>
        }
      />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <div className="mb-4 flex w-fit gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setFilter(t.value)}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
              filter === t.value
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Create dialog */}
      <Dialog
        open={showForm}
        onClose={resetForm}
        title="Schedule a class"
        subtitle="Set up a new class session"
      >
        <form onSubmit={submit} className="space-y-4">
          {formError && <Alert>{formError}</Alert>}
          <Input
            label="Class title"
            required
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="e.g. Morning HIIT"
          />
          <Select label="Trainer" value={formTrainer} onChange={(e) => setFormTrainer(e.target.value)}>
            <option value="">Unassigned</option>
            {trainers.map((t) => (
              <option key={t.member_id} value={t.member_id}>
                {t.display_name || t.full_name || t.email} ({t.role})
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Starts at" type="datetime-local" required value={formStartsAt} onChange={(e) => setFormStartsAt(e.target.value)} />
            <Input label="Ends at" type="datetime-local" value={formEndsAt} onChange={(e) => setFormEndsAt(e.target.value)} />
          </div>
          <Input label="Capacity" type="number" min={1} value={formCapacity} onChange={(e) => setFormCapacity(e.target.value)} hint="Maximum number of members" />
          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={formLoading}>Schedule</Button>
            <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>
          </div>
        </form>
      </Dialog>

      {/* Cancel confirmation */}
      <Dialog
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title=""
        subtitle=""
        hideTitle
      >
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--warning-bg)]">
            <svg className="h-6 w-6 text-[var(--warning)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="mb-1 text-lg font-semibold text-[var(--foreground)]">Cancel class</h3>
          <p className="mb-6 text-sm leading-relaxed text-[var(--foreground-muted)]">
            Are you sure you want to cancel <span className="font-medium text-[var(--foreground)]">&ldquo;{cancelling?.title}&rdquo;</span>? All bookings will be cancelled and members will be notified.
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setCancelling(null)} className="flex-1">Keep class</Button>
            <Button variant="danger" onClick={confirmCancel} className="flex-1">Cancel class</Button>
          </div>
        </div>
      </Dialog>

      {/* Bookings dialog */}
      <Dialog
        open={!!bookingsSession}
        onClose={() => { setBookingsSession(null); setBookings(null); }}
        title={bookingsSession ? `Bookings — ${bookingsSession.title}` : ""}
        subtitle={`${bookings?.length ?? 0} booking${bookings?.length === 1 ? "" : "s"}`}
      >
        {bookings === null ? (
          <Spinner label="Loading bookings..." />
        ) : bookingsError ? (
          <Alert>{bookingsError}</Alert>
        ) : bookings.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--foreground-muted)]">No bookings yet.</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {bookings.map((b) => (
              <div key={b.booking_id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">{b.member_name || b.member_email}</p>
                  <p className="text-xs text-[var(--muted)]">{b.member_email}</p>
                </div>
                <Badge tone={b.status === "booked" ? "success" : "neutral"}>{b.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Dialog>

      {/* Kebab menu portal */}
      {menuSession && menuPos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={closeMenu} />
          <div
            className="fixed z-50 min-w-[160px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg animate-fade-in"
            style={{ top: menuPos.top, bottom: menuPos.bottom, right: menuPos.right }}
          >
            {!menuSession.cancelled && !menuSession.trainer_checked_in && (
              <button
                type="button"
                onClick={() => { closeMenu(); doCheckIn(menuSession); }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--background)]"
              >
                <svg className="h-3.5 w-3.5 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {checkInLoading === menuSession.id ? "Checking in..." : "Check in"}
              </button>
            )}
            <button
              type="button"
              onClick={() => { closeMenu(); loadBookings(menuSession); }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--background)]"
            >
              <svg className="h-3.5 w-3.5 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              View bookings
            </button>
            {!menuSession.cancelled && (
              <>
                <hr className="border-t border-[var(--border)]" />
                <button
                  type="button"
                  onClick={() => { closeMenu(); setCancelling(menuSession); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-[var(--danger)] transition-colors hover:bg-[var(--background)]"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  Cancel class
                </button>
              </>
            )}
          </div>
        </>,
        document.body,
      )}

      <Card>
        <CardHeader
          title={filter === "upcoming" ? "Upcoming classes" : filter === "past" ? "Past classes" : "Cancelled classes"}
          subtitle={sessions ? `${filtered.length} session${filtered.length === 1 ? "" : "s"}` : undefined}
        />
        {sessions === null ? (
          <Spinner label="Loading classes..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No classes found"
            hint={
              filter === "upcoming"
                ? "Schedule your first class to get started."
                : filter === "past"
                  ? "No past classes yet."
                  : "No cancelled classes."
            }
            action={filter === "upcoming" ? <Button onClick={() => { resetForm(); setShowForm(true); }}>+ Schedule class</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Trainer</th>
                  <th className="px-4 py-3">Date / Time</th>
                  <th className="px-4 py-3">Capacity</th>
                  <th className="px-4 py-3">Status</th>
                  {isStaff && <th className="w-12 px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((s) => {
                  const st = sessionStatus(s);
                  return (
                    <tr
                      key={s.id}
                      className={`transition-colors hover:bg-[var(--background)] ${s.cancelled ? "opacity-50" : ""}`}
                    >
                      <td className="max-w-[200px] px-4 py-3">
                        <p className={`truncate font-medium ${s.cancelled ? "text-[var(--muted)] line-through" : "text-[var(--foreground)]"}`}>
                          {s.title}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[var(--foreground-muted)]">
                          {s.trainer_member_id ? (trainerById[s.trainer_member_id] || "—") : "Unassigned"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[var(--foreground-muted)]">
                          <p className="whitespace-nowrap">{fmtDateTime(s.starts_at)}</p>
                          {s.ends_at && (
                            <p className="text-xs text-[var(--muted)]">
                              until {fmtTime(s.ends_at)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1">
                            <div className="h-2 w-20 rounded-full bg-[var(--border)]">
                              <div
                                className={`h-2 rounded-full transition-all ${capacityColor(s.booked_count, s.capacity)}`}
                                style={{ width: `${Math.min(100, (s.booked_count / s.capacity) * 100)}%` }}
                              />
                            </div>
                          </div>
                          <span className="tabnum text-xs text-[var(--foreground-muted)]">
                            {s.booked_count}/{s.capacity}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge tone={st.tone}>{st.label}</Badge>
                          {!s.cancelled && s.trainer_checked_in && (
                            <span className="flex h-2 w-2 rounded-full bg-[var(--success)]" title="Trainer checked in" />
                          )}
                        </div>
                      </td>
                      {isStaff && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={(e) => openMenu(s, e)}
                              className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="1.5" />
                                <circle cx="12" cy="12" r="1.5" />
                                <circle cx="12" cy="19" r="1.5" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
