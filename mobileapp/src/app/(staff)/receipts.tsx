import React, { useState } from "react";
import { Image, Pressable, RefreshControl, View } from "react-native";
import { Text } from "heroui-native";

import { AppScreen } from "@/components/app-screen";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Alert } from "@/components/ui/alert";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { DashboardError } from "@/components/dashboard-states";
import { SwipeableRow, Stagger } from "@/components/motion";
import { useGet } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/format";
import type { OrganizationOut, ReceiptReviewItem } from "@/types/api";

export default function Screen_receipts() {
  const org = useGet<OrganizationOut>("/organizations/me");
  const queue = useGet<ReceiptReviewItem[]>("/receipts/review-queue");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const currency = org.data?.currency || "USD";

  const review = async (item: ReceiptReviewItem, action: "approve" | "reject" | "request_info") => {
    setBusyId(item.id);
    setError(null);
    try {
      await api.post(`/receipts/${item.id}/review`, { action }, { idempotent: true });
      queue.refetch();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update receipt.");
    } finally {
      setBusyId(null);
    }
  };

  const items = queue.data ?? [];

  return (
    <AppScreen
      title="Receipts"
      subtitle="Verify offline payments"
      refreshControl={
        <RefreshControl refreshing={queue.loading} onRefresh={() => { queue.refetch(); org.refetch(); }} />
      }
    >
      {queue.loading && !queue.data ? (
        <DashboardSkeleton />
      ) : queue.error ? (
        <DashboardError message={queue.error} onRetry={() => { queue.refetch(); org.refetch(); }} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nothing to review"
          message="Member-uploaded receipts will land here for verification."
          icon="doc.text"
        />
      ) : (
        <>
          <View className="mb-4">
            <Text type="body-sm" color="muted">
              {items.length} pending · swipe or tap to decide
            </Text>
          </View>

          <Stagger gap={60}>
            {items.map((item) => (
              <SwipeableRow
                key={item.id}
                rightActions={[
                  { label: "Reject", icon: "xmark", android: "close", bgClass: "bg-danger", onPress: () => review(item, "reject") },
                  { label: "Approve", icon: "checkmark", android: "check", bgClass: "bg-success", onPress: () => review(item, "approve") },
                ]}
              >
                <View className="mb-3 overflow-hidden rounded-2xl bg-surface shadow-surface">
                  <Pressable onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                    <View className="p-4">
                      {/* confidence bar */}
                      <View className="flex-row items-center justify-between">
                        <Text type="body" weight="semibold" className="text-foreground">
                          {item.extracted_payer || "Unknown payer"}
                        </Text>
                        <Badge
                          tone={(item.flags ?? []).length ? "danger" : "warning"}
                          label={item.confidence_score != null ? `${Math.round(item.confidence_score)}%` : "n/a"}
                        />
                      </View>
                      <View className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-tertiary">
                        <View
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, item.confidence_score ?? 50)}%`,
                            backgroundColor: (item.confidence_score ?? 0) >= 70 ? "#16a34a" : "#f59e0b",
                          }}
                        />
                      </View>

                      {(item.flags ?? []).length > 0 ? (
                        <View className="mt-2 flex-row flex-wrap gap-1.5">
                          {item.flags.map((f) => (
                            <Badge key={f} tone="danger" label={f} />
                          ))}
                        </View>
                      ) : null}

                      <View className="mt-3 gap-1">
                        <Field label="Amount" value={item.extracted_amount != null ? money(item.extracted_amount, currency) : "—"} />
                        <Field label="Date" value={item.extracted_date || "—"} />
                        <Field label="Payee" value={item.extracted_payee || "—"} />
                        {item.is_duplicate ? <Field label="Duplicate?" value="Yes" danger /> : null}
                      </View>
                    </View>
                  </Pressable>

                  {expandedId === item.id && item.original_image_url ? (
                    <View className="px-4 pb-4">
                      <Image
                        source={{ uri: item.original_image_url }}
                        className="h-44 w-full rounded-xl"
                        resizeMode="cover"
                      />
                    </View>
                  ) : null}

                  <View className="flex-row gap-2 border-t px-4 py-3" style={{ borderColor: "rgba(128,128,128,0.2)" }}>
                    <View className="flex-1">
                      <ActionBtn label="Approve" tone="success" disabled={busyId === item.id} onPress={() => review(item, "approve")} />
                    </View>
                    <View className="flex-1">
                      <ActionBtn label="Reject" tone="danger" disabled={busyId === item.id} onPress={() => review(item, "reject")} />
                    </View>
                    <View className="flex-1">
                      <ActionBtn label="More info" tone="neutral" disabled={busyId === item.id} onPress={() => review(item, "request_info")} />
                    </View>
                  </View>
                </View>
              </SwipeableRow>
            ))}
          </Stagger>
        </>
      )}

      {error ? (
        <View className="mb-4">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}
    </AppScreen>
  );
}

function Field({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View className="flex-row justify-between">
      <Text type="body-sm" color="muted">{label}</Text>
      <Text type="body-sm" className={danger ? "text-danger" : "text-foreground"}>{value}</Text>
    </View>
  );
}

function ActionBtn({
  label,
  tone,
  disabled,
  onPress,
}: {
  label: string;
  tone: "success" | "danger" | "neutral";
  disabled?: boolean;
  onPress: () => void;
}) {
  const bg =
    tone === "success" ? "bg-success" : tone === "danger" ? "bg-danger" : "bg-surface-tertiary";
  const fg = tone === "neutral" ? "text-foreground" : "text-white";
  return (
    <Pressable onPress={onPress} disabled={disabled} className={`rounded-xl py-2.5 ${bg} active:opacity-80`}>
      <Text className={`text-center text-[13px] font-semibold ${fg}`}>{label}</Text>
    </Pressable>
  );
}