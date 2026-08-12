import React from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Text } from "heroui-native";
import { router } from "expo-router";

import { AppScreen } from "@/components/app-screen";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { DashboardError } from "@/components/dashboard-states";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { useGet } from "@/hooks/use-api";
import { useOrgStore } from "@/stores/org-store";
import { firstName, greeting, money } from "@/lib/format";
import type {
  HeadlineMetrics,
  MemberDirectoryItem,
  OrganizationOut,
  ProfileOut,
  ReceiptReviewItem,
  SetupChecklist,
} from "@/types/api";

const CHECKLIST_ITEMS: { key: keyof SetupChecklist; label: string }[] = [
  { key: "gym_registered", label: "Gym registered" },
  { key: "saas_active", label: "SaaS plan active" },
  { key: "stripe_connected", label: "Connect Stripe" },
  { key: "plan_published", label: "Publish a membership plan" },
  { key: "enrollment_configured", label: "Configure enrollment mode" },
  { key: "staff_invited", label: "Invite staff" },
  { key: "office_configured", label: "Set office statuses & leave" },
];

export default function Screen_dashboard() {
  const activeOrg = useOrgStore((s) => s.activeOrg);

  const profile = useGet<ProfileOut>("/auth/me/profile");
  const org = useGet<OrganizationOut>("/organizations/me");
  const headline = useGet<HeadlineMetrics>("/analytics/headline");
  const checklist = useGet<SetupChecklist>("/organizations/me/checklist");
  const approvals = useGet<MemberDirectoryItem[]>("/members/approval-queue");
  const receipts = useGet<ReceiptReviewItem[]>("/receipts/review-queue");

  const loading = profile.loading || headline.loading || checklist.loading;
  const error = profile.error ?? headline.error ?? checklist.error;

  const currency = org.data?.currency || "USD";
  const orgName = org.data?.name || activeOrg?.name || "";
  const metrics = headline.data;
  const checklistData = checklist.data;
  const approvalPreview = (approvals.data ?? []).slice(0, 3);
  const receiptPreview = (receipts.data ?? []).slice(0, 3);

  const doneCount = checklistData
    ? CHECKLIST_ITEMS.filter((item) => checklistData[item.key]).length
    : 0;
  const checklistComplete = checklistData ? doneCount === CHECKLIST_ITEMS.length : true;

  const refresh = () => {
    profile.refetch();
    org.refetch();
    headline.refetch();
    checklist.refetch();
    approvals.refetch();
    receipts.refetch();
  };

  return (
    <AppScreen
      title={`${greeting()}, ${firstName(profile.data?.full_name)}`}
      subtitle={orgName || activeOrg?.org_code || "Your gym"}
      refreshControl={<RefreshControl refreshing={checklist.loading} onRefresh={refresh} />}
    >
      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <DashboardError message={error} onRetry={refresh} />
      ) : (
        <>
          {checklistData && !checklistComplete ? (
            <View className="mb-6 overflow-hidden rounded-3xl bg-surface p-4">
              <View className="flex-row items-center justify-between">
                <Text type="body" weight="semibold" className="text-foreground">
                  Set up your gym
                </Text>
                <Badge tone="warning" label={`${doneCount} of ${CHECKLIST_ITEMS.length}`} />
              </View>
              <View className="mt-4 gap-2.5">
                {CHECKLIST_ITEMS.map((item) => {
                  const done = checklistData[item.key];
                  return (
                    <View key={item.key} className="flex-row items-center gap-2.5">
                      <Icon
                        name={done ? "checkmark.circle.fill" : "circle"}
                        android={done ? "check_circle" : "circle"}
                        size={18}
                        className={done ? "text-success" : "text-muted"}
                      />
                      <Text
                        type="body-sm"
                        color={done ? "muted" : "default"}
                        className={done ? "line-through" : "text-foreground"}
                      >
                        {item.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {metrics ? (
            <View className="mb-6 flex-row gap-3">
              <StatCard label="Today’s check-ins" value={metrics.today_check_ins} icon="person.2" android="group" tone="accent" />
              <StatCard label="Today’s revenue" value={money(metrics.today_revenue, currency)} icon="banknote" android="payments" tone="success" />
            </View>
          ) : null}
          {metrics ? (
            <View className="mb-6 flex-row gap-3">
              <StatCard label="Pending approvals" value={metrics.pending_approvals} icon="person.crop.circle.badge.questionmark" android="query_stats" tone="warning" />
              <StatCard label="Pending receipts" value={metrics.pending_receipts} icon="doc.text" android="receipt_long" tone="warning" />
            </View>
          ) : null}
          {metrics ? (
            <View className="mb-6 flex-row gap-3">
              <StatCard label="Active members" value={metrics.active_members} icon="person.3" android="group" tone="neutral" />
              <View className="flex-1" />
            </View>
          ) : null}

          <SectionCard
            title="Approval queue"
            action={
              <Pressable onPress={() => router.navigate("/approvals")} hitSlop={8}>
                <Text type="body-sm" className="text-accent">See all</Text>
              </Pressable>
            }
          >
            {approvalPreview.length === 0 ? (
              <View className="rounded-2xl bg-surface p-5">
                <Text type="body" weight="semibold" className="text-foreground">Nothing pending</Text>
                <Text type="body-sm" color="muted" className="mt-1">
                  No signups waiting for approval.
                </Text>
              </View>
            ) : (
              <View className="overflow-hidden rounded-2xl bg-surface">
                {approvalPreview.map((m, i) => (
                  <Pressable
                    key={m.member_id}
                    onPress={() => router.navigate("/approvals")}
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
                      <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-surface-tertiary">
                        <Icon name="person" android="person" size={20} className="text-foreground" />
                      </View>
                      <View className="flex-1">
                        <Text type="body" weight="medium" className="text-foreground">
                          {m.display_name || m.full_name || m.email}
                        </Text>
                        <Text type="body-sm" color="muted" className="mt-0.5">
                          {m.email}
                        </Text>
                      </View>
                      <View className="ml-2">
                        <Badge tone="info" label="pending" />
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </SectionCard>

          {receiptPreview.length > 0 ? (
            <SectionCard
              title="Receipts to review"
              action={
                <Pressable onPress={() => router.navigate("/receipts")} hitSlop={8}>
                  <Text type="body-sm" className="text-accent">See all</Text>
                </Pressable>
              }
            >
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
            </SectionCard>
          ) : null}
        </>
      )}
    </AppScreen>
  );
}