"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, EmptyState, Input, Spinner } from "@/components/ui";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ListToolbar } from "@/components/ListToolbar";
import { RowMenu } from "@/components/RowMenu";
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

  // `inTab` splits slots against the wall clock, so the boundary must refresh
  // on its own rather than reading the clock during render (non-deterministic).
  // A 30s tick is far finer than the upcoming/past distinction users notice.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const inTab = (s: SpaceSlotOut, tab: Filter) => {
    if (s.cancelled) return tab === "cancelled";
    if (tab === "cancelled") return false;
    const start = new Date(s.starts_at).getTime();
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

      {/* Create lives in a sheet so the slot list stays in view. */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="[--sheet-max-w:520px]">
          <SheetHeader className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle>Create a space slot</SheetTitle>
              <SheetDescription>A desk or meeting room seat-holders can book.</SheetDescription>
            </div>
          </SheetHeader>
          <SlotForm onDone={() => { setShowForm(false); load(); }} />
        </SheetContent>
      </Sheet>

      <ListToolbar
        tabs={[
          { value: "upcoming" as const, label: "Upcoming", count: counts.upcoming },
          { value: "past" as const, label: "Past", count: counts.past },
          { value: "cancelled" as const, label: "Cancelled", count: counts.cancelled },
        ]}
        value={filter}
        onChange={setFilter}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search slots…"
      />

      {/* The bordered surface belongs to the *list*. When there is nothing to
          list, an empty box with a hairline border reads as a broken table —
          so the loading and empty states sit on the page, unboxed, and the
          border only appears once there are rows to hold. */}
      {slots === null ? (
        <div className="mt-3">
          <Spinner label="Loading slots..." />
        </div>
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
        <div className="mt-3 border border-foreground/10 bg-card">
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
                  <RowMenu
                    actions={[
                      { label: "View bookings", onSelect: () => void openBookings(s) },
                      ...(!s.cancelled
                        ? [{ label: "Cancel slot", variant: "destructive" as const, onSelect: () => setCreating(s) }]
                        : []),
                    ]}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cancelling is destructive and affects everyone booked in, so it gets a
          centred AlertDialog: two answers, and it should stop you. */}
      <AlertDialog open={!!creating} onOpenChange={(open) => { if (!open) setCreating(null); }}>
        <AlertDialogContent>
          <AlertDialogTitle>Cancel this slot?</AlertDialogTitle>
          <AlertDialogDescription>
            Cancelling <strong className="text-foreground">{creating?.title}</strong> releases every
            booking in it and notifies the seat-holders. The slot stays in your history as cancelled.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary">Keep slot</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="danger" onClick={cancelSlot}>Cancel slot</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bookings are a detail, so they read beside the list, not over it. */}
      <Sheet open={!!viewing} onOpenChange={(open) => { if (!open) setViewing(null); }}>
        <SheetContent className="[--sheet-max-w:520px]">
          <SheetHeader className="flex items-start justify-between gap-4">
            <div>
              <SheetTitle>{viewing?.title ?? ""}</SheetTitle>
              <SheetDescription>Seat-holder bookings.</SheetDescription>
            </div>
          </SheetHeader>
          <SheetBody className="p-0">
            {bookings === null ? (
              <Spinner label="Loading bookings..." />
            ) : bookings.length === 0 ? (
              <div className="px-6 py-8">
                <EmptyState title="No bookings" hint="Nobody has booked this slot yet." />
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {bookings.map((b) => (
                  <li key={b.booking_id} className="flex items-center justify-between gap-3 px-6 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-[var(--foreground)]">{b.member_name || b.member_email}</div>
                      {b.member_name && <div className="truncate text-xs text-[var(--muted)]">{b.member_email}</div>}
                    </div>
                    <Badge tone={b.status === "booked" ? "success" : "neutral"}>{b.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild>
              <Button variant="secondary">Close</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
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
    /* `flex` + the form filling the sheet: header and footer stay put, only
       the body scrolls. A centred modal could do the same, but a sheet keeps
       the slot list in view. */
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <SheetBody className="space-y-5">
        {error && <Alert>{error}</Alert>}
        <Input label="Name" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Desk 14, Meeting Room A…" />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Starts at" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          <Input label="Ends at" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
        <Input label="Capacity" type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
      </SheetBody>
      <SheetFooter>
        <SheetClose asChild>
          <Button type="button" variant="secondary">Cancel</Button>
        </SheetClose>
        <Button type="submit" loading={loading}>Create slot</Button>
      </SheetFooter>
    </form>
  );
}
