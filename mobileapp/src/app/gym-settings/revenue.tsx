import React from "react";
import { View } from "react-native";
import { Text } from "heroui-native";

import { AppScreen } from "@/components/app-screen";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { DashboardError } from "@/components/dashboard-states";
import { EmptyState } from "@/components/empty-state";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { RevenueByMethodChart } from "@/components/revenue-chart";
import { StatusChip, memberStatusTone, humanize } from "@/components/status-chip";
import { useGet } from "@/hooks/use-api";
import { money } from "@/lib/format";
import type { RevenueAnalytics } from "@/types/api";

export default function Revenue() {
  const revenue = useGet<RevenueAnalytics>("/analytics/revenue", [
    "payment.recorded",
    "membership.changed",
    "receipt.processed",
  ]);

  const resolvedCurrency = revenue.data?.currency ?? "USD";

  if (revenue.loading && !revenue.data) {
    return (
      <AppScreen title="Revenue" subtitle="Gym performance" showBackButton>
        <DashboardSkeleton />
      </AppScreen>
    );
  }

  if (revenue.error) {
    return (
      <AppScreen title="Revenue" subtitle="Gym performance" showBackButton>
        <DashboardError message={revenue.error} onRetry={() => revenue.refetch()} />
      </AppScreen>
    );
  }

  if (revenue.forbidden || !revenue.data) {
    return (
      <AppScreen title="Revenue" subtitle="Gym performance" showBackButton>
        <EmptyState
          icon="lock"
          title="No access"
          message="Only owners and managers can view revenue breakdowns."
        />
      </AppScreen>
    );
  }

  const data = revenue.data;
  const statusRows = Object.entries(data.member_count_by_status)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <AppScreen title="Revenue" subtitle="Gym performance" showBackButton>
      <View className="mb-6">
        <StatCard
          label="Total revenue"
          value={data.total_revenue}
          icon="banknote"
          android="payments"
          tone="success"
          wide
          format={(n) => money(n, resolvedCurrency)}
        />
      </View>

      <SectionCard title="Revenue by method">
        <View className="overflow-hidden rounded-2xl bg-surface p-5">
          <RevenueByMethodChart
            byMethod={data.revenue_by_method}
            total={data.total_revenue}
            currency={resolvedCurrency}
          />
        </View>
      </SectionCard>

      <SectionCard title="Members">
        <View className="mb-4 flex-row gap-3">
          <StatCard
            label="Active"
            value={data.active_members}
            icon="person.3"
            android="group"
            tone="accent"
            animate
          />
          <StatCard
            label="Churned"
            value={data.churn_count}
            icon="person.crop.circle.badge.xmark"
            android="group"
            tone="danger"
            animate
          />
        </View>

        {statusRows.length > 0 ? (
          <View className="overflow-hidden rounded-2xl bg-surface">
            {statusRows.map((row, i) => (
              <View
                key={row.status}
                className="flex-row items-center justify-between px-4 py-3"
                style={
                  i > 0
                    ? { borderTopWidth: 0.5, borderTopColor: "rgba(128,128,128,0.25)" }
                    : undefined
                }
              >
                <StatusChip status={row.status} tone={memberStatusTone(row.status)} />
                <Text type="body" weight="semibold" className="text-foreground tabular-nums">
                  {row.count}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View className="rounded-2xl bg-surface p-5">
            <Text type="body" weight="semibold" className="text-foreground">
              No members yet
            </Text>
            <Text type="body-sm" color="muted" className="mt-0.5">
              {humanize("member_count_by_status")}
            </Text>
          </View>
        )}
      </SectionCard>
    </AppScreen>
  );
}
