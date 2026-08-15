import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "heroui-native";
import { router } from "expo-router";

import { AppScreen } from "@/components/app-screen";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { DashboardError } from "@/components/dashboard-states";
import { ListRow } from "@/components/list-row";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stagger } from "@/components/motion";
import { useGet } from "@/hooks/use-api";
import { useOrgStore } from "@/stores/org-store";
import { api } from "@/lib/api";
import { formatTime, firstName, greeting, money, relativeDeadline } from "@/lib/format";
import type {
  HeadlineMetrics,
  OrganizationOut,
  ProfileOut,
  ReceiptReviewItem,
  ShiftOut,
  TaskOut,
} from "@/types/api";

export default function Screen_dashboard() {
  const activeOrg = useOrgStore((s) => s.activeOrg);

  const realtime = ["shift.check_in", "shift.check_out", "receipt.processed", "task.changed", "gym_status.changed", "payment.recorded"];

  const profile = useGet<ProfileOut>("/auth/me/profile", realtime);
  const org = useGet<OrganizationOut>("/organizations/me", realtime);
  const shift = useGet<ShiftOut | null>("/staff/shifts/current", realtime);
  const headline = useGet<HeadlineMetrics>("/analytics/headline", realtime);
  const receipts = useGet<ReceiptReviewItem[]>("/receipts/review-queue", ["receipt.processed"]);
  const tasks = useGet<TaskOut[]>("/staff/tasks", ["task.changed"]);

  const loading = profile.loading || shift.loading || headline.loading || receipts.loading;
  const error = profile.error ?? shift.error ?? headline.error ?? receipts.error;

  const currency = org.data?.currency || "USD";
  const orgName = org.data?.name || activeOrg?.name || "";
  const metrics = headline.data;
  const receiptPreview = (receipts.data ?? []).slice(0, 3);
  const taskPreview = (tasks.data ?? []).filter((t) => !t.done).slice(0, 3);

  const refresh = () => {
    profile.refetch();
    org.refetch();
    shift.refetch();
    headline.refetch();
    receipts.refetch();
    tasks.refetch();
  };

  return (
    <AppScreen
      title={`${greeting()}, ${firstName(profile.data?.full_name)}`}
      subtitle={orgName || activeOrg?.org_code || "Your gym"}
    >
      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <DashboardError message={error} onRetry={refresh} />
      ) : (
        <Stagger gap={90}>
          <View className="mb-6">
            <ShiftCard shift={shift.data} onChanged={shift.refetch} />
          </View>

          {metrics ? (
            <View className="mb-6 flex-row gap-3">
              <StatCard
                label="Today’s check-ins"
                value={metrics.today_check_ins}
                icon="person.2"
                android="group"
                tone="accent"
              />
              <StatCard
                label="Today’s revenue"
                value={money(metrics.today_revenue, currency)}
                icon="banknote"
                android="payments"
                tone="success"
              />
            </View>
          ) : null}
          {metrics ? (
            <View className="mb-6 flex-row gap-3">
              <StatCard
                label="Pending receipts"
                value={metrics.pending_receipts}
                icon="doc.text"
                android="receipt_long"
                tone="warning"
              />
              <StatCard
                label="Active members"
                value={metrics.active_members}
                icon="person.3"
                android="group"
                tone="neutral"
              />
            </View>
          ) : null}

          <SectionCard
            title="Receipts to review"
            action={
              <Pressable onPress={() => router.navigate("/receipts")} hitSlop={8}>
                <Text type="body-sm" className="text-accent">See all</Text>
              </Pressable>
            }
          >
            {receiptPreview.length === 0 ? (
              <View className="rounded-2xl bg-surface p-5">
                <Text type="body" weight="semibold" className="text-foreground">All caught up</Text>
                <Text type="body-sm" color="muted" className="mt-1">
                  No receipts waiting for review.
                </Text>
              </View>
            ) : (
              <View className="overflow-hidden rounded-2xl bg-surface">
                {receiptPreview.map((r, i) => (
                  <Pressable
                    key={r.id}
                    onPress={() => router.navigate("/receipts")}
                    className="active:opacity-70"
                  >
                    <View
                      className="flex-row items-center py-3.5"
                      style={
                        i > 0
                          ? { borderTopWidth: 0.5, borderTopColor: "rgba(128,128,128,0.25)" }
                          : undefined
                      }
                    >
                      <View className="flex-1">
                        <Text type="body" weight="medium" className="text-foreground">
                          {r.extracted_payer || r.extracted_payee || `Receipt ${i + 1}`}
                        </Text>
                        <Text type="body-sm" color="muted" className="mt-0.5">
                          {r.extracted_amount != null
                            ? money(r.extracted_amount, currency)
                            : "Amount unknown"}
                          {r.confidence_score != null
                            ? ` · ${Math.round(r.confidence_score)}% confidence`
                            : ""}
                        </Text>
                      </View>
                      <View className="ml-2">
                        <Badge
                          tone={r.is_duplicate || (r.flags?.length ?? 0) > 0 ? "danger" : "info"}
                          label={r.is_duplicate ? "duplicate" : "pending"}
                        />
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </SectionCard>

          {!tasks.forbidden && taskPreview.length > 0 ? (
            <SectionCard title="My tasks">
              <View className="overflow-hidden rounded-2xl bg-surface">
                {taskPreview.map((t, i) => (
                  <ListRow
                    key={t.id}
                    title={t.title}
                    subtitle={t.deadline ? `Due ${relativeDeadline(t.deadline)}` : "No deadline"}
                    icon="checklist"
                    android="task_alt"
                    divider={i < taskPreview.length - 1}
                  />
                ))}
              </View>
            </SectionCard>
          ) : null}
        </Stagger>
      )}
    </AppScreen>
  );
}

function ShiftCard({ shift, onChanged }: { shift: ShiftOut | null; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onShift = Boolean(shift && !shift.checked_out_at);

  const shiftStart = shift && !shift.checked_out_at ? formatTime(shift.checked_in_at) : null;

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (onShift) {
        await api.post<ShiftOut>("/staff/shifts/check-out", undefined, { idempotent: true });
      } else {
        await api.post<ShiftOut>("/staff/shifts/check-in", undefined, { idempotent: true });
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="overflow-hidden rounded-3xl bg-surface p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-tertiary">
          <Icon
            name={onShift ? "clock.fill" : "clock"}
            android={onShift ? "schedule" : "access_time"}
            size={22}
            className={onShift ? "text-success" : "text-muted"}
          />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text type="body" weight="semibold" className="text-foreground">
              {onShift ? "You’re on shift" : "Not checked in"}
            </Text>
            <Badge tone={onShift ? "success" : "neutral"} label={onShift ? "active" : "idle"} />
          </View>
          <Text type="body-sm" color="muted" className="mt-0.5">
            {onShift
              ? `Checked in · ${shiftStart}`
              : "Check in to start tracking time."}
          </Text>
        </View>
      </View>
      <View className="mt-3">
        <Button variant={onShift ? "secondary" : "primary"} loading={busy} onPress={toggle}>
          {onShift ? "Check out" : "Check in"}
        </Button>
      </View>
      {error ? (
        <Text type="body-xs" className="mt-2 text-danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}