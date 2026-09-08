import React, { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "heroui-native";

import { AppScreen } from "@/components/app-screen";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { DashboardError } from "@/components/dashboard-states";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/empty-state";
import { Stagger } from "@/components/motion";
import { useGet } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import { formatTime, formatDay } from "@/lib/format";
import type { SpaceBookingOut, SpaceSlotOut } from "@/types/api";

/**
 * Office vertical: a seat-holder's desks & rooms surface. Reads the same
 * space_slot schedule the web portal manages and books through the idempotent
 * /space endpoints. Read-only company billing stays on the web portal.
 */
function groupByDay(slots: SpaceSlotOut[]) {
  const map = new Map<string, SpaceSlotOut[]>();
  for (const s of slots) {
    const key = formatDay(s.starts_at);
    const arr = map.get(key) ?? [];
    arr.push(s);
    map.set(key, arr);
  }
  return Array.from(map.entries());
}

export default function Screen_space() {
  const slots = useGet<SpaceSlotOut[]>("/space/available", ["space.changed", "class.changed"]);
  const mine = useGet<SpaceBookingOut[]>("/space/my-bookings", ["space.changed", "class.changed"]);
  const [selected, setSelected] = useState<SpaceSlotOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justBooked, setJustBooked] = useState(false);
  const [now] = useState(() => Date.now());

  const future = React.useMemo(
    () => (slots.data ?? []).filter((s) => !s.cancelled && new Date(s.ends_at ?? s.starts_at).getTime() > now - 3600e3),
    [slots.data, now],
  );
  const groups = useMemo(() => groupByDay(future), [future]);

  const bookedIds = useMemo(
    () => new Set((mine.data ?? []).filter((b) => b.status === "booked").map((b) => b.slot.id)),
    [mine.data],
  );

  const refresh = () => {
    slots.refetch();
    mine.refetch();
  };

  const openSheet = (s: SpaceSlotOut) => {
    setSelected(s);
    setError(null);
  };

  const myBooking = selected ? (mine.data ?? []).find((b) => b.slot.id === selected.id && b.status === "booked") : null;
  const isMine = selected ? bookedIds.has(selected.id) : false;
  const full = selected ? selected.booked_count >= selected.capacity : false;

  const book = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/space/book", { slot_id: selected.id }, { idempotent: true });
      setJustBooked(true);
      setTimeout(() => setJustBooked(false), 900);
      setSelected(null);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not book this space.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!selected || !myBooking) return;
    setBusy(true);
    setError(null);
    try {
      await api.del(`/space/bookings/${myBooking.booking_id}`);
      setSelected(null);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not cancel your booking.");
    } finally {
      setBusy(false);
    }
  };

  const loading = slots.loading && !slots.data;

  return (
    <AppScreen
      title="Space"
      subtitle="Book a desk or room"
    >
      {loading ? (
        <DashboardSkeleton />
      ) : slots.error ? (
        <DashboardError message={slots.error} onRetry={refresh} />
      ) : future.length === 0 ? (
        <EmptyState
          title="No desks or rooms available"
          message="New slots are added here — check back soon, or ask the space manager."
          icon="building.2"
        />
      ) : (
        groups.map(([day, list]) => (
          <SectionCard key={day} title={day}>
            <View className="gap-2">
              <Stagger gap={44}>
                {list.map((s) => {
                  const booked = bookedIds.has(s.id);
                  const slotFull = s.booked_count >= s.capacity;
                  return (
                    <Pressable key={s.id} onPress={() => openSheet(s)} className="active:opacity-80">
                      <View className="rounded-2xl bg-surface p-4 shadow-surface">
                        <View className="flex-row items-center justify-between">
                          <Text type="body" weight="semibold" className="flex-1 text-foreground" numberOfLines={1}>
                            {s.title}
                          </Text>
                          {booked ? <Badge tone="success" label="booked" /> : slotFull ? <Badge tone="danger" label="full" /> : <Badge tone="neutral" label="open" />}
                        </View>
                        <View className="mt-2 flex-row items-center gap-3">
                          <Text type="body-sm" className="text-muted">{formatTime(s.starts_at)}</Text>
                          <Text type="body-sm" className="text-muted">·</Text>
                          <Text type="body-sm" className="text-muted">
                            {s.booked_count}/{s.capacity} booked
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </Stagger>
            </View>
          </SectionCard>
        ))
      )}

      {error ? (
        <View className="mb-4">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      <Sheet isOpen={selected !== null} onOpenChange={(o: boolean) => { if (!o) setSelected(null); }}>
        {selected && (
          <>
            <SheetTitle>{selected.title}</SheetTitle>
            <View className="gap-1">
              <Row label="Day" value={formatDay(selected.starts_at)} />
              <Row label="Starts" value={formatTime(selected.starts_at)} />
              <Row label="Capacity" value={`${selected.booked_count} / ${selected.capacity} booked`} />
            </View>

            {isMine ? (
              <Button variant="secondary" loading={busy} onPress={cancel}>
                Cancel my booking
              </Button>
            ) : (
              <Button loading={busy} onPress={book} disabled={full}>
                {full ? "Fully booked" : "Book this space"}
              </Button>
            )}
            {justBooked ? <Text type="body-sm" className="text-center text-success">Booked!</Text> : null}
          </>
        )}
      </Sheet>
    </AppScreen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text type="body-sm" color="muted">{label}</Text>
      <Text type="body" weight="medium" className="text-foreground">{value}</Text>
    </View>
  );
}
