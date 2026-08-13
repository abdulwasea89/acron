import React, { useEffect, useState } from "react";
import { RefreshControl, View } from "react-native";
import { Text } from "heroui-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { AppScreen } from "@/components/app-screen";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { DashboardError } from "@/components/dashboard-states";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { PressableScale } from "@/components/motion";
import { useGet } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import { formatDay } from "@/lib/format";
import type { OrganizationOut, ShiftOut } from "@/types/api";

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function formatClock(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function elapsedSeconds(sinceIso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(sinceIso).getTime()) / 1000));
}

/** Breathing ring behind the clock that signals "live" while on shift. */
function PulseRing({ active }: { active: boolean }) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }), -1, false);
  }, [p]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + p.value * 0.22 }],
    opacity: active ? 0.25 - p.value * 0.12 : 0,
  }));

  const dot = useAnimatedStyle(() => ({
    opacity: active ? 1 : 0,
    transform: [{ scale: 0.85 + p.value * 0.15 }],
  }));

  return (
    <>
      {active && (
        <Animated.View
          style={[style, { position: "absolute", width: 196, height: 196, borderRadius: 98, backgroundColor: "#0485f7" }]}
        />
      )}
      <Animated.View
        style={[dot, { position: "absolute", top: 0, right: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: "#16a34a" }]}
      />
    </>
  );
}

export default function Screen_shift() {
  const org = useGet<OrganizationOut>("/organizations/me");
  const shift = useGet<ShiftOut | null>("/staff/shifts/current");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCheckedIn, setJustCheckedIn] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const onShift = Boolean(shift.data && !shift.data.checked_out_at);

  useEffect(() => {
    if (!onShift) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [onShift]);

  const liveSeconds = onShift && shift.data ? elapsedSeconds(shift.data.checked_in_at, now) : 0;
  const overtime = liveSeconds > 8 * 3600;

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (onShift) {
        await api.post<ShiftOut>("/staff/shifts/check-out", undefined, { idempotent: true });
      } else {
        await api.post<ShiftOut>("/staff/shifts/check-in", undefined, { idempotent: true });
        setJustCheckedIn(true);
        setTimeout(() => setJustCheckedIn(false), 1200);
      }
      shift.refetch();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen
      title="Shift"
      subtitle={org.data?.name}
      refreshControl={
        <RefreshControl refreshing={shift.loading && !shift.data} onRefresh={() => { shift.refetch(); org.refetch(); }} />
      }
    >
      {shift.loading && !shift.data ? (
        <DashboardSkeleton />
      ) : shift.error ? (
        <DashboardError message={shift.error} onRetry={() => { shift.refetch(); org.refetch(); }} />
      ) : (
        <>
          {/* Hero clock */}
          <View className="mb-6 items-center rounded-3xl bg-surface p-8 shadow-surface">
            <Text type="body-sm" color="muted" className="mb-1">
              {formatDay(new Date().toISOString())}
            </Text>
            <View className="relative mt-2 h-[196px] w-[196px] items-center justify-center">
              <PulseRing active={onShift} />
              <View className="h-[176px] w-[176px] items-center justify-center rounded-full bg-surface-secondary">
                <Text
                  className={`text-[40px] font-bold tabular-nums tracking-tight ${overtime ? "text-danger" : "text-foreground"}`}
                >
                  {onShift ? formatClock(liveSeconds) : "0:00"}
                </Text>
                <Text type="body-xs" color="muted" className="mt-1">
                  {onShift ? (overtime ? "Overtime" : "Time on clock") : "Ready"}
                </Text>
              </View>
            </View>

            <View className="mt-6 w-full">
              <PressableScale scale={0.95} pop={justCheckedIn} onPress={toggle}>
                <View
                  className={`w-full items-center justify-center rounded-2xl py-4 ${onShift ? "bg-danger" : "bg-accent"}`}
                >
                  <Text className="text-[16px] font-bold text-white">
                    {busy ? "Updating…" : onShift ? "Check out" : "Check in"}
                  </Text>
                </View>
              </PressableScale>
            </View>

            <View className="mt-4 flex-row items-center gap-2">
              <Badge tone={onShift ? "success" : "neutral"} label={onShift ? "on shift" : "idle"} />
              {shift.data?.checked_out_at ? (
                <Text type="body-xs" color="muted">
                  Checked out at {new Date(shift.data.checked_out_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </Text>
              ) : null}
            </View>
            {error ? (
              <Text type="body-xs" className="mt-2 text-danger">
                {error}
              </Text>
            ) : null}
          </View>

          <SectionCard title="What counts here">
            <View className="gap-3">
              <View className="flex-row items-start gap-3 rounded-2xl bg-surface p-4">
                <Text className="w-6 text-center text-[15px]">⏱</Text>
                <View className="flex-1">
                  <Text type="body" weight="medium" className="text-foreground">
                    Paid time is tracked automatically
                  </Text>
                  <Text type="body-sm" color="muted" className="mt-0.5">
                    Check out when you finish — your hours feed payroll and show up on your pay stub.
                  </Text>
                </View>
              </View>
              <View className="flex-row items-start gap-3 rounded-2xl bg-surface p-4">
                <Text className="w-6 text-center text-[15px]">📋</Text>
                <View className="flex-1">
                  <Text type="body" weight="medium" className="text-foreground">
                    Overtime flags after 8 hours
                  </Text>
                  <Text type="body-sm" color="muted" className="mt-0.5">
                    Anything past 8 hours is highlighted so your manager can review it before payroll locks.
                  </Text>
                </View>
              </View>
            </View>
          </SectionCard>
        </>
      )}
    </AppScreen>
  );
}