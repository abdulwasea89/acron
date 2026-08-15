import React from "react";
import { View } from "react-native";
import { Text } from "heroui-native";
import { router } from "expo-router";

import { AppScreen } from "@/components/app-screen";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { DashboardError } from "@/components/dashboard-states";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { Icon, type IconName } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { PressableScale, Stagger } from "@/components/motion";
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

const CHECKLIST_ITEMS: {
  key: keyof SetupChecklist;
  label: string;
  icon: IconName;
  android: string;
  color: string;
}[] = [
  { key: "gym_registered", label: "Gym registered", icon: "checkmark.circle", android: "check_circle", color: "#4ade80" },
  { key: "saas_active", label: "SaaS plan active", icon: "checkmark.circle", android: "check_circle", color: "#4ade80" },
  { key: "stripe_connected", label: "Connect Stripe", icon: "creditcard", android: "credit_card", color: "#60a5fa" },
  { key: "plan_published", label: "Publish a membership plan", icon: "doc.text", android: "task_alt", color: "#a78bfa" },
  { key: "enrollment_configured", label: "Configure enrollment mode", icon: "checklist", android: "task_alt", color: "#c4b5fd" },
  { key: "staff_invited", label: "Invite staff", icon: "person.2", android: "group", color: "#60a5fa" },
  { key: "office_configured", label: "Set office statuses & leave", icon: "checklist", android: "task_alt", color: "#fbbf24" },
];

export default function Screen_dashboard() {
  const activeOrg = useOrgStore((s) => s.activeOrg);

  const realtime = ["payment.recorded", "plan.changed", "membership.changed", "task.changed", "gym_status.changed", "receipt.processed", "class.changed"];

  const profile = useGet<ProfileOut>("/auth/me/profile", realtime);
  const org = useGet<OrganizationOut>("/organizations/me", realtime);
  const headline = useGet<HeadlineMetrics>("/analytics/headline", realtime);
  const checklist = useGet<SetupChecklist>("/organizations/me/checklist", realtime);
  const approvals = useGet<MemberDirectoryItem[]>("/members/approval-queue", ["membership.changed"]);
  const receipts = useGet<ReceiptReviewItem[]>("/receipts/review-queue", ["receipt.processed"]);

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
      headerVariant="dashboard"
    >
      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <DashboardError message={error} onRetry={refresh} />
      ) : (
        <Stagger gap={90}>
          {checklistData && !checklistComplete ? (
            <SetupProgressCard doneCount={doneCount} total={CHECKLIST_ITEMS.length} data={checklistData} />
          ) : null}

          {metrics ? (
            <View className="mb-6">
              <View className="mb-2 flex-row items-center justify-between px-1">
                <Text type="body-sm" weight="semibold" className="uppercase tracking-wide text-muted">
                  Today
                </Text>
              </View>
              <View className="flex-row gap-3">
                <StatCard
                  label="Today's check-ins"
                  value={metrics.today_check_ins}
                  icon="person.2"
                  android="group"
                  tone="accent"
                  animate
                />
                <StatCard
                  label="Today's revenue"
                  value={metrics.today_revenue}
                  icon="banknote"
                  android="payments"
                  tone="success"
                  animate
                  format={(n) => money(n, currency)}
                />
              </View>
            </View>
          ) : null}
          {metrics ? (
            <View className="mb-6">
              <View className="mb-2 flex-row items-center justify-between px-1">
                <Text type="body-sm" weight="semibold" className="uppercase tracking-wide text-muted">
                  Needs attention
                </Text>
              </View>
              <View className="flex-row gap-3">
                <StatCard
                  label="Pending approvals"
                  value={metrics.pending_approvals}
                  icon="person.crop.circle.badge.questionmark"
                  android="query_stats"
                  tone="warning"
                  animate
                />
                <StatCard
                  label="Pending receipts"
                  value={metrics.pending_receipts}
                  icon="doc.text"
                  android="receipt_long"
                  tone="warning"
                  animate
                />
              </View>
            </View>
          ) : null}
          {metrics ? (
            <View className="mb-6">
              <StatCard
                label="Active members"
                value={metrics.active_members}
                icon="person.3"
                android="group"
                tone="neutral"
                animate
                wide
              />
            </View>
          ) : null}

          <SectionCard
            title="Approval queue"
            action={
              <PressableScale onPress={() => router.navigate("/approvals")} hitSlop={8}>
                <Text type="body-sm" className="text-accent">See all</Text>
              </PressableScale>
            }
          >
            {approvalPreview.length === 0 ? (
              <View className="rounded-2xl bg-surface p-5">
                <Text type="body" weight="semibold" className="text-foreground">Nothing pending</Text>
                <Text type="body-sm" className="mt-1 text-muted">
                  No signups waiting for approval.
                </Text>
              </View>
            ) : (
              <View className="overflow-hidden rounded-2xl bg-surface">
                {approvalPreview.map((m, i) => (
                  <PressableScale key={m.member_id} onPress={() => router.navigate("/approvals")}>
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
                        <Text type="body-sm" className="mt-0.5 text-muted">
                          {m.email}
                        </Text>
                      </View>
                      <View className="ml-2">
                        <Badge tone="info" label="pending" />
                      </View>
                    </View>
                  </PressableScale>
                ))}
              </View>
            )}
          </SectionCard>

          {receiptPreview.length > 0 ? (
            <SectionCard
              title="Receipts to review"
              action={
                <PressableScale onPress={() => router.navigate("/receipts")} hitSlop={8}>
                  <Text type="body-sm" className="text-accent">See all</Text>
                </PressableScale>
              }
            >
              <View className="overflow-hidden rounded-2xl bg-surface">
                {receiptPreview.map((r, i) => (
                  <PressableScale key={r.id} onPress={() => router.navigate("/receipts")}>
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
                        <Text type="body-sm" className="mt-0.5 text-muted">
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
                  </PressableScale>
                ))}
              </View>
            </SectionCard>
          ) : null}
        </Stagger>
      )}
    </AppScreen>
  );
}

/**
 * Compact setup checklist with a thin progress bar. The count is the headline
 * (`3 of 7`), done items collapse to a checkmark line, and only the remaining
 * steps are listed — fewer rows, clearer next action (Apple: simplicity).
 */
function SetupProgressCard({
  doneCount,
  total,
  data,
}: {
  doneCount: number;
  total: number;
  data: SetupChecklist;
}) {
  const remaining = CHECKLIST_ITEMS.filter((item) => !data[item.key]);
  const pct = Math.round((doneCount / total) * 100);

  return (
    <View className="mb-6 overflow-hidden rounded-3xl bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <Text type="body" weight="semibold" className="text-foreground">
          Set up your gym
        </Text>
        <Text type="body-sm" className="text-muted tabular-nums">
          {doneCount} of {total}
        </Text>
      </View>

      <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-tertiary">
        <View
          className="h-full rounded-full bg-accent"
          style={{ width: `${pct}%` }}
        />
      </View>

      <View className="mt-4 gap-2">
        {remaining.length === 0 ? (
          <Text type="body-sm" className="text-success">
            All set — your gym is live.
          </Text>
        ) : (
          remaining.slice(0, 3).map((item) => (
            <View key={item.key} className="flex-row items-center gap-2.5">
              <Icon name={item.icon} android={item.android} size={16} color={item.color} weight="semibold" />
              <Text type="body-sm" className="text-foreground">
                {item.label}
              </Text>
            </View>
          ))
        )}
        {remaining.length > 3 ? (
          <Text type="body-xs" className="mt-0.5 text-muted">
            +{remaining.length - 3} more
          </Text>
        ) : null}
      </View>
    </View>
  );
}
