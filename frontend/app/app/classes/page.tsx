"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Dialog } from "@/components/Dialog";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Select, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useRealtimeEvent } from "@/components/Realtime";
import type { ClassSessionOut, ClassSessionCreate, MemberDirectoryItem } from "@/lib/types";

export default function ClassesPage() {
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
    members.map((m) => [m.member_id, m.full_name || m.email]),
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
                {t.full_name || t.email} ({t.role})
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
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((s) => {
                  const status = sessionStatus(s);
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
                          <Badge tone={status.tone}>{status.label}</Badge>
                          {!s.cancelled && s.trainer_checked_in && (
                            <span className="flex h-2 w-2 rounded-full bg-[var(--success)]" title="Trainer checked in" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!s.cancelled && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCancelling(s)}
                          >
                            Cancel
                          </Button>
                        )}
                      </td>
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
