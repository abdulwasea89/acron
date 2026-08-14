import React, { useCallback, useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Text } from "heroui-native";
import { BottomSheet } from "heroui-native/bottom-sheet";
import { router } from "expo-router";

import { AppScreen } from "@/components/app-screen";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { DashboardError } from "@/components/dashboard-states";
import { EmptyState } from "@/components/empty-state";
import { Icon, type IconName } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { useGet } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { useAuthStore, type UserRole } from "@/stores/auth-store";
import { useNotificationStore } from "@/stores/notification-store";
import type { NotificationCategory, NotificationOut } from "@/types/api";

const CATEGORY_META: Record<NotificationCategory, { icon: IconName; android: string; label: string }> = {
  approval: { icon: "person.crop.circle.badge.questionmark", android: "query_stats", label: "Approval" },
  receipt: { icon: "doc.text", android: "receipt_long", label: "Receipt" },
  receipt_review: { icon: "doc.text.magnifyingglass", android: "receipt_long", label: "Receipt review" },
  payment: { icon: "banknote", android: "payments", label: "Payment" },
  task: { icon: "checklist", android: "task_alt", label: "Task" },
  membership: { icon: "figure.strengthtraining.traditional", android: "fitness_center", label: "Membership" },
  cash: { icon: "dollarsign.circle", android: "payments", label: "Cash" },
  system: { icon: "bell", android: "bell", label: "System" },
};

/** Route to deep-link from an alert, per recipient role. */
function deepLinkFor(category: NotificationCategory, role: UserRole): string | null {
  if (category === "receipt" || category === "payment" || category === "membership") {
    return role === "member" ? "/payments" : "/receipts";
  }
  if (category === "receipt_review" || category === "approval" || category === "cash") {
    return role === "member" ? null : "/approvals";
  }
  if (category === "task") return role === "member" ? null : "/tasks";
  return null;
}

export default function Screen_notifications() {
  const notifications = useGet<NotificationOut[]>("/notifications");
  const role = useAuthStore((s) => s.user?.role ?? "member");
  const decrement = useNotificationStore((s) => s.decrement);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  const [selected, setSelected] = useState<NotificationOut | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = notifications.data ?? [];

  const refresh = useCallback(() => {
    notifications.refetch();
    api.get<{ count: number }>("/notifications/unread-count").then(
      (r) => setUnreadCount(r.count),
      () => undefined,
    );
  }, [notifications, setUnreadCount]);

  const openDetail = async (n: NotificationOut) => {
    setSelected(n);
    if (n.read) return;
    // Optimistically mark read so the badge drops immediately.
    decrement();
    setBusyId(n.id);
    try {
      await api.post(`/notifications/${n.id}/read`);
      notifications.refetch();
    } catch {
      // Reconcile from the server rather than roll back the badge guess.
      api.get<{ count: number }>("/notifications/unread-count").then(
        (r) => setUnreadCount(r.count),
        () => undefined,
      );
    } finally {
      setBusyId(null);
    }
  };

  const markAllRead = async () => {
    try {
      await api.post("/notifications/read-all");
      setUnreadCount(0);
      notifications.refetch();
    } catch {
      /* non-fatal */
    }
  };

  return (
    <AppScreen
      title="Notifications"
      subtitle={list.filter((n) => !n.read).length > 0 ? "You have unread alerts" : "You're all caught up"}
      showNotifications={false}
      headerRight={
        list.some((n) => !n.read) ? (
          <Pressable onPress={markAllRead} hitSlop={8}>
            <Text className="text-[13px] font-semibold text-accent">Mark all read</Text>
          </Pressable>
        ) : undefined
      }
      refreshControl={<RefreshControl refreshing={notifications.loading} onRefresh={refresh} />}
    >
      {notifications.loading && !notifications.data ? (
        <DashboardSkeleton />
      ) : notifications.error ? (
        <DashboardError message={notifications.error} onRetry={refresh} />
      ) : list.length === 0 ? (
        <EmptyState
          icon="bell"
          title="No notifications yet"
          message="Payment updates, receipt verdicts and task assignments will land here."
        />
      ) : (
        <View className="gap-2">
          {list.map((n) => {
            const meta = CATEGORY_META[n.category] ?? CATEGORY_META.system;
            const unread = !n.read;
            return (
              <Pressable
                key={n.id}
                onPress={() => openDetail(n)}
                className="active:opacity-70"
                accessibilityLabel={`${n.title}. ${unread ? "Unread" : "Read"}`}
              >
                <View
                  className={`flex-row items-center gap-3 rounded-2xl p-4 ${
                    unread ? "bg-surface" : "bg-surface-secondary"
                  }`}
                >
                  <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-tertiary">
                    <Icon name={meta.icon} android={meta.android} size={20} className="text-foreground" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      {unread ? <View className="h-2 w-2 rounded-full bg-accent" /> : null}
                      <Text
                        type="body"
                        weight={unread ? "semibold" : "medium"}
                        className="flex-1 text-foreground"
                        numberOfLines={1}
                      >
                        {n.title}
                      </Text>
                    </View>
                    <Text type="body-sm" color="muted" className="mt-0.5" numberOfLines={2}>
                      {n.body}
                    </Text>
                    <Text type="body-xs" className="mt-1 text-muted">
                      {timeAgo(n.created_at)}
                    </Text>
                  </View>
                  {busyId === n.id ? (
                    <Icon name="hourglass" android="schedule" size={16} className="text-muted" />
                  ) : (
                    <Icon name="chevron.right" android="chevron_right" size={16} className="text-muted" />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <BottomSheet isOpen={selected !== null} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay isCloseOnPress />
          {selected ? (
            <BottomSheet.Content className="gap-4 p-5 pb-8">
              <View className="items-start">
                <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl bg-surface-tertiary">
                  <Icon
                    name={(CATEGORY_META[selected.category] ?? CATEGORY_META.system).icon}
                    android={(CATEGORY_META[selected.category] ?? CATEGORY_META.system).android}
                    size={24}
                    className="text-accent"
                  />
                </View>
                <Text type="body-xs" className="mb-1 text-muted">
                  {(CATEGORY_META[selected.category] ?? CATEGORY_META.system).label} · {timeAgo(selected.created_at)}
                </Text>
                <BottomSheet.Title className="text-[18px] font-bold text-foreground">
                  {selected.title}
                </BottomSheet.Title>
              </View>
              <Text type="body" className="text-foreground leading-relaxed">
                {selected.body}
              </Text>

              {deepLinkFor(selected.category, role) ? (
                <Button
                  onPress={() => {
                    const href = deepLinkFor(selected.category, role);
                    setSelected(null);
                    if (href) router.push(href as never);
                  }}
                >
                  View details
                </Button>
              ) : null}
              <BottomSheet.Close>
                <Button variant="ghost">Close</Button>
              </BottomSheet.Close>
            </BottomSheet.Content>
          ) : null}
        </BottomSheet.Portal>
      </BottomSheet>
    </AppScreen>
  );
}
