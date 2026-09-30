"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, CategoryTabs, EmptyState, Input, Spinner, TableToolbar } from "@/components/ui";
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
  const [search, setSearch] = useState("");
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

  const all = slots ?? [];

  const inTab = (s: SpaceSlotOut, tab: Filter) => {
    if (s.cancelled) return tab === "cancelled";
    if (tab === "cancelled") return false;
    const start = new Date(s.starts_at).getTime();
    const now = Date.now();
    return tab === "upcoming" ? start > now : start <= now;
  };

  const q = search.trim().toLowerCase();
  const filtered = all
    .filter((s) => inTab(s, filter))
    .filter((s) => !q || s.title.toLowerCase().includes(q))
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
    upcoming: all.filter((s) => inTab(s, "upcoming")).length,
    past: all.filter((s) => inTab(s, "past")).length,
    cancelled: all.filter((s) => inTab(s, "cancelled")).length,
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

      <TableToolbar
        title="Slots"
        subtitle={slots ? `${filtered.length} of ${all.length} shown` : undefined}
        action={
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Input
              placeholder="Search…"
              aria-label="Search slots"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="sm"
              className="w-[150px]"
            />
            <CategoryTabs
              className="shrink-0"
              tabs={[
                { value: "upcoming" as const, label: "Upcoming", count: counts.upcoming },
                { value: "past" as const, label: "Past", count: counts.past },
                { value: "cancelled" as const, label: "Cancelled", count: counts.cancelled },
              ]}
              value={filter}
              onChange={setFilter}
            />
          </div>
        }
      />

      {/* Table surface: hairline border, square corners, flat background. */}
      <div className="border border-foreground/10 bg-card">
        {slots === null ? (
          <Spinner label="Loading slots..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={all.length === 0 ? "No space slots yet" : "No slots match"}
            hint={
              all.length === 0
                ? "Create desks and meeting rooms here — seat-holders book them from their app."
                : "Try a different search or filter."
            }
            action={
              all.length === 0
                ? <Button onClick={() => setShowForm(true)} size="lg">+ Create your first slot</Button>
                : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-foreground/[0.06]">
            {filtered.map((s) => (
              <li key={s.id} className={`flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--background)] ${s.cancelled ? "opacity-55" : ""}`}>
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
      </div>

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
