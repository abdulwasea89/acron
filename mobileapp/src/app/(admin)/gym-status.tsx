import React, { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Text } from "heroui-native";

import { AppScreen } from "@/components/app-screen";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { DashboardError } from "@/components/dashboard-states";
import { SectionCard } from "@/components/section-card";
import { Alert } from "@/components/ui/alert";
import { PressableScale } from "@/components/motion";
import { useGet } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import { humanize } from "@/components/status-chip";
import type { OrganizationOut } from "@/types/api";

const STATUSES = [
  { value: "open", label: "Open", sub: "Accepting members & walk-ins", color: "bg-success", ring: "#16a34a" },
  { value: "half_day", label: "Half day", sub: "Reduced hours today", color: "bg-warning", ring: "#d97706" },
  { value: "closed", label: "Closed", sub: "Members see the gym as unavailable", color: "bg-danger", ring: "#dc2626" },
] as const;

export default function Screen_gym_status() {
  const org = useGet<OrganizationOut>("/organizations/me");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const current = org.data?.gym_status ?? "open";

  const setStatus = async (status: (typeof STATUSES)[number]["value"]) => {
    if (status === current) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.patch<OrganizationOut>("/organizations/me/gym-status", { gym_status: status });
      setSaved(true);
      org.refetch();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update status.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen
      title="Gym status"
      subtitle="Let members know you're open"
      refreshControl={<RefreshControl refreshing={org.loading} onRefresh={() => org.refetch()} />}
    >
      {org.loading && !org.data ? (
        <DashboardSkeleton />
      ) : org.error ? (
        <DashboardError message={org.error} onRetry={() => org.refetch()} />
      ) : (
        <>
          <SectionCard title="Current status">
            <StaggerStatus statuses={STATUSES} current={current} onPress={setStatus} disabled={busy} />
          </SectionCard>

          <SectionCard title="How members see it">
            <View className="gap-3">
              <InfoRow title="Open" body="Members can book classes and the gym shows as accepting walk-ins." />
              <InfoRow title="Half day" body="Bookings stay open but members are told the gym runs reduced hours." />
              <InfoRow title="Closed" body="The gym reads as unavailable — no new bookings, no walk-ins." />
            </View>
          </SectionCard>

          {error ? (
            <View className="mb-4">
              <Alert type="error" message={error} onDismiss={() => setError(null)} />
            </View>
          ) : null}
          {saved ? (
            <View className="mb-4">
              <Alert type="success" message={`Status updated to ${humanize(current)}.`} onDismiss={() => setSaved(false)} />
            </View>
          ) : null}
        </>
      )}
    </AppScreen>
  );
}

function StaggerStatus({
  statuses,
  current,
  onPress,
  disabled,
}: {
  statuses: readonly (typeof STATUSES)[number][];
  current: string;
  onPress: (s: (typeof STATUSES)[number]["value"]) => void;
  disabled: boolean;
}) {
  return (
    <View className="gap-3">
      {statuses.map((s, i) => {
        const active = s.value === current;
        return (
          <PressableScale key={s.value} scale={0.97} style={{ borderRadius: 20 }}>
            <Pressable onPress={() => onPress(s.value)} disabled={disabled} className="active:opacity-80">
              <View
                className={`flex-row items-center gap-3 rounded-2xl border p-4 ${
                  active ? "border-accent bg-surface" : "border-border bg-surface"
                }`}
                style={active ? { borderColor: s.ring, borderWidth: 2 } : undefined}
              >
                <View className={`h-4 w-4 rounded-full ${active ? s.color : "bg-surface-tertiary"}`} />
                <View className="flex-1">
                  <Text type="body" weight="semibold" className="text-foreground">
                    {s.label}
                  </Text>
                  <Text type="body-sm" color="muted">{s.sub}</Text>
                </View>
                <Text className={`text-[12px] font-semibold ${active ? "text-accent" : "text-muted"}`}>
                  {active ? "Current" : ""}
                </Text>
              </View>
            </Pressable>
          </PressableScale>
        );
      })}
    </View>
  );
}

function InfoRow({ title, body }: { title: string; body: string }) {
  return (
    <View className="rounded-2xl bg-surface p-4">
      <Text type="body" weight="semibold" className="text-foreground">{title}</Text>
      <Text type="body-sm" color="muted" className="mt-0.5">{body}</Text>
    </View>
  );
}