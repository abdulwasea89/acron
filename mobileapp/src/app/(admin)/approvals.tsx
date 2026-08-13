import React, { useState } from "react";
import { Pressable, RefreshControl, TextInput, View } from "react-native";
import { Text } from "heroui-native";

import { AppScreen } from "@/components/app-screen";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { DashboardError } from "@/components/dashboard-states";
import { SectionCard } from "@/components/section-card";
import { EmptyState } from "@/components/empty-state";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SwipeableRow, Stagger } from "@/components/motion";
import { useGet } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import { humanize, memberStatusTone, StatusChip } from "@/components/status-chip";
import { formatDay } from "@/lib/format";
import type { MemberDirectoryItem, ReceiptReviewItem } from "@/types/api";

export default function Screen_approvals() {
  const queue = useGet<MemberDirectoryItem[]>("/members/approval-queue");
  const receipts = useGet<ReceiptReviewItem[]>("/receipts/review-queue");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<MemberDirectoryItem | null>(null);

  const decide = async (m: MemberDirectoryItem, approve: boolean, reason?: string) => {
    setBusyId(m.member_id);
    setError(null);
    try {
      await api.post(`/members/${m.member_id}/approval`, { approve, reason: reason ?? null }, { idempotent: true });
      setReasonFor(null);
      queue.refetch();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update member.");
    } finally {
      setBusyId(null);
    }
  };

  const members = queue.data ?? [];
  const receiptsPending = (receipts.data ?? []).length;

  return (
    <AppScreen
      title="Approvals"
      subtitle="Members & receipts awaiting a decision"
      refreshControl={
        <RefreshControl refreshing={queue.loading} onRefresh={() => { queue.refetch(); receipts.refetch(); }} />
      }
    >
      {queue.loading && !queue.data ? (
        <DashboardSkeleton />
      ) : queue.error ? (
        <DashboardError message={queue.error} onRetry={() => { queue.refetch(); receipts.refetch(); }} />
      ) : members.length === 0 ? (
        <EmptyState
          title="All clear"
          message="Enrollment requests and receipt reviews are all handled."
          icon="checkmark.circle"
        />
      ) : (
        <Stagger gap={60}>
          {members.map((m) => (
            <SwipeableRow
              key={m.member_id}
              rightActions={[
                { label: "Reject", icon: "xmark", android: "close", bgClass: "bg-danger", onPress: () => setReasonFor(m) },
                { label: "Approve", icon: "checkmark", android: "check", bgClass: "bg-success", onPress: () => decide(m, true) },
              ]}
            >
              <View className="mb-3 rounded-2xl bg-surface p-4 shadow-surface">
                <View className="flex-row items-center gap-3">
                  <View className="h-11 w-11 items-center justify-center rounded-full bg-surface-tertiary">
                    <Text className="text-[16px] font-bold text-accent">
                      {(m.full_name || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text type="body" weight="semibold" className="text-foreground" numberOfLines={1}>
                        {m.full_name || "Unnamed member"}
                      </Text>
                      <Badge tone="info" label={m.role === "member" ? "new member" : humanize(m.role)} />
                    </View>
                    <Text type="body-sm" color="muted">{m.email}</Text>
                    {m.phone ? <Text type="body-xs" color="muted">{m.phone}</Text> : null}
                  </View>
                </View>

                <View className="mt-3 flex-row items-center justify-between">
                  <Text type="body-xs" color="muted">
                    Requested {formatDay(m.created_at)}
                  </Text>
                  <StatusChip status={m.member_status} tone={memberStatusTone(m.member_status)} />
                </View>

                <View className="mt-3 flex-row gap-2">
                  <View className="flex-1">
                    <ActionBtn label="Approve" tone="success" disabled={busyId === m.member_id} onPress={() => decide(m, true)} />
                  </View>
                  <View className="flex-1">
                    <ActionBtn label="Reject" tone="danger" disabled={busyId === m.member_id} onPress={() => setReasonFor(m)} />
                  </View>
                </View>
              </View>
            </SwipeableRow>
          ))}
        </Stagger>
      )}

      {receiptsPending > 0 ? (
        <SectionCard title="Also waiting">
          <View className="rounded-2xl bg-surface p-4 shadow-surface">
            <Text type="body-sm" color="muted">
              {receiptsPending} receipt{receiptsPending > 1 ? "s" : ""} in the review queue.
            </Text>
          </View>
        </SectionCard>
      ) : null}

      {error ? (
        <View className="mb-4">
          <Alert type="error" message={error} onDismiss={() => setError(null)} />
        </View>
      ) : null}

      <ReasonDialog
        key={reasonFor?.member_id ?? "none"}
        member={reasonFor}
        onClose={() => setReasonFor(null)}
        onConfirm={(reason) => reasonFor && decide(reasonFor, false, reason)}
        busy={busyId !== null}
      />
    </AppScreen>
  );
}

function ActionBtn({
  label,
  tone,
  disabled,
  onPress,
}: {
  label: string;
  tone: "success" | "danger";
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`rounded-xl py-2.5 ${tone === "success" ? "bg-success" : "bg-danger"} active:opacity-80`}
    >
      <Text className="text-center text-[13px] font-semibold text-white">{label}</Text>
    </Pressable>
  );
}

function ReasonDialog({
  member,
  onClose,
  onConfirm,
  busy,
}: {
  member: MemberDirectoryItem | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  busy: boolean;
}) {
  const [reason, setReason] = useState("");

  if (!member) return null;
  return (
    <View className="absolute inset-0 z-50 items-center justify-center bg-black/40 px-6">
      <View className="w-full rounded-3xl bg-surface p-5 shadow-overlay">
        <Text type="body" weight="semibold" className="text-foreground">
          Reject {member.full_name || "this member"}?
        </Text>
        <Text type="body-sm" color="muted" className="mt-1">
          The applicant will see this reason.
        </Text>
        <TextInput
          className="mt-4 rounded-xl border px-4 py-3 text-[15px] text-foreground"
          placeholder="Reason (optional)"
          placeholderTextColor="#9ca3af"
          value={reason}
          onChangeText={setReason}
          style={{ borderColor: "rgba(128,128,128,0.3)" }}
        />
        <View className="mt-4 flex-row justify-end gap-3">
          <Pressable onPress={onClose} className="py-2 px-4">
            <Text type="body" className="text-muted">Cancel</Text>
          </Pressable>
          <Pressable onPress={() => onConfirm(reason.trim())} disabled={busy} className="rounded-xl bg-danger px-5 py-2 active:opacity-80">
            <Text type="body" weight="semibold" className="text-white">Reject</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}