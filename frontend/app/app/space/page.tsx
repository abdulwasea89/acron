"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Input, Spinner } from "@/components/ui";
import { KebabMenu } from "@/components/KebabMenu";
import { useModuleGate } from "@/hooks/useModuleGate";
import { api, ApiError } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import type { BookingWithMember, SpaceSlotOut } from "@/lib/types";

type Filter = "upcoming" | "past" | "cancelled";

export default function SpacePage() {
  const { ready } = useModuleGate("space");
  const [slots, setSlots] = useState<SpaceSlotOut[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [showForm, setShowForm] = useState(false);

  const [creating, setCreating] = useState<SpaceSlotOut | null>(null); // cancel target
  const [viewing, setViewing] = useState<SpaceSlotOut | null>(null);
  const [bookings, setBookings] = useState<BookingWithMember[] | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setSlots(await api.get<SpaceSlotOut[]>("/space"));
    } catch (e) {
      setError((e as ApiError).message);
      setSlots([]);
    }
  }, []);

  useEffect(() => {
    if (ready) queueMicrotask(() => void load());
  }, [ready, load]);

  const filtered = (slots ?? [])
    .filter((s) => {
      if (s.cancelled) return filter === "cancelled";
      const start = new Date(s.starts_at).getTime();
      const now = Date.now();
      return filter === "upcoming" ? start > now : filter === "past" ? start <= now : false;
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  async function openBookings(slot: SpaceSlotOut) {
    setViewing(slot);
    setBookings(null);
    try {
      setBookings(await api.get<BookingWithMember[]>(`/space/${slot.id}/bookings`));
    } catch (e) {
      setError((e as ApiError).message);
      setBookings([]);
    }
  }

  async function cancelSlot() {
    if (!creating) return;
    setError("");
    try {
      await api.post(`/space/${creating.id}/cancel`);
      setCreating(null);
      await load();
    } catch (e) {
      setError((e as ApiError).message);
      setCreating(null);
    }
  }

  if (!ready) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Spinner /></div>;
  }

  const counts = {
    upcoming: (slots ?? []).filter((s) => !s.cancelled && new Date(s.starts_at).getTime() > Date.now()).length,
    past: (slots ?? []).filter((s) => !s.cancelled && new Date(s.starts_at).getTime() <= Date.now()).length,
    cancelled: (slots ?? []).filter((s) => s.cancelled).length,
  };

  return (
    <>
      <PageHeader
        title="Desks & rooms"
        subtitle={slots ? `${counts.upcoming} bookable upcoming` : "Space slots seat-holders can book"}
        action={
          <Button onClick={() => setShowForm((s) => !s)} variant={showForm ? "secondary" : "primary"}>
            {showForm ? "Close" : "+ New slot"}
          </Button>
        }
      />

      {error && <div className="mb-5"><Alert>{error}</Alert></div>}

      <Dialog open={showForm} onClose={() => setShowForm(false)} title="Create a space slot" subtitle="A desk or meeting room seat-holders can book" className="max-w-lg">
        <SlotForm onDone={() => { setShowForm(false); load(); }} />
      </Dialog>

      <Card>
        <CardHeader title="Slots" subtitle={slots ? `${filtered.length} shown` : undefined} />

        <div className="flex gap-1 rounded-xl bg-[var(--background)] p-0.5 px-5 pb-5">
          {(["upcoming", "past", "cancelled"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                filter === f ? "bg-[var(--surface)] text-[var(--foreground)] shadow-xs" : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {f}
              <span className="rounded-full px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--muted)]">{counts[f]}</span>
            </button>
          ))}
        </div>

        {slots === null ? (
          <Spinner label="Loading slots..." />
        ) : filtered.length === 0 ? (
          <div className="px-5 pb-10">
            <EmptyState
              title={slots.length === 0 ? "No space slots yet" : `No ${filter} slots`}
              hint={slots.length === 0 ? "Create desks and meeting rooms here — seat-holders book them from their app." : undefined}
              action={slots.length === 0 ? <Button onClick={() => setShowForm(true)} size="lg">+ Create your first slot</Button> : undefined}
            />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {filtered.map((s) => (
              <li key={s.id} className={`flex items-center justify-between gap-3 px-5 py-3.5 ${s.cancelled ? "opacity-55" : ""}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`truncate font-medium ${s.cancelled ? "text-[var(--muted)] line-through" : "text-[var(--foreground)]"}`}>{s.title}</span>
                    {s.cancelled && <Badge tone="neutral">Cancelled</Badge>}
                  </div>
                  <p className="mt-0.5 whitespace-nowrap text-xs text-[var(--foreground-muted)]">
                    {fmtDateTime(s.starts_at)}{s.ends_at ? ` – ${fmtDateTime(s.ends_at)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={`tabular-nums text-sm ${s.booked_count >= s.capacity ? "font-semibold text-[var(--foreground)]" : "text-[var(--foreground-muted)]"}`}>
                    {s.booked_count}/{s.capacity} booked
                  </span>
                  <KebabMenu
                    actions={[
                      { label: "View bookings", onClick: () => void openBookings(s) },
                      ...(!s.cancelled
                        ? [{ label: "Cancel slot", danger: true, onClick: () => setCreating(s) }]
                        : []),
                    ]}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Cancel confirm */}
      <Dialog open={!!creating} onClose={() => setCreating(null)} title="Cancel slot" className="max-w-sm">
        <p className="mb-6 text-sm text-[var(--foreground-muted)]">
          Cancel <strong className="text-[var(--foreground)]">{creating?.title}</strong>? All bookings are cancelled and seat-holders are notified.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCreating(null)}>Cancel</Button>
          <Button variant="danger" onClick={cancelSlot}>Cancel slot</Button>
        </div>
      </Dialog>

      {/* Bookings dialog */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title ?? ""} subtitle="Seat-holder bookings" className="max-w-lg">
        {bookings === null ? (
          <Spinner label="Loading bookings..." />
        ) : bookings.length === 0 ? (
          <EmptyState title="No bookings" hint="Nobody has booked this slot yet." />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {bookings.map((b) => (
              <li key={b.booking_id} className="flex items-center justify-between gap-3 px-2 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm text-[var(--foreground)]">{b.member_name || b.member_email}</div>
                  {b.member_name && <div className="truncate text-xs text-[var(--muted)]">{b.member_email}</div>}
                </div>
                <Badge tone={b.status === "booked" ? "success" : "neutral"}>{b.status}</Badge>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end border-t border-[var(--border)] pt-4">
          <Button variant="ghost" onClick={() => setViewing(null)}>Close</Button>
        </div>
      </Dialog>
    </>
  );
}

function SlotForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/space", {
        title,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        capacity: parseInt(capacity, 10) || 1,
      });
      onDone();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <Alert>{error}</Alert>}
      <Input label="Name" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Desk 14, Meeting Room A…" />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Starts at" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        <Input label="Ends at" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
      </div>
      <Input label="Capacity" type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
      <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-5">
        <Button type="submit" loading={loading} size="lg">Create slot</Button>
      </div>
    </form>
  );
}
