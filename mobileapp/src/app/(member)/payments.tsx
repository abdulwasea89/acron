import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { Text } from "heroui-native";

import { AppScreen } from "@/components/app-screen";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { DashboardError } from "@/components/dashboard-states";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import type { IconName } from "@/components/icon";
import type { AndroidSymbol } from "expo-symbols";
import { AnimatedNumber, Stagger } from "@/components/motion";
import { useGet } from "@/hooks/use-api";
import { money, formatDay } from "@/lib/format";
import { humanize } from "@/components/status-chip";
import type { OrganizationOut, PaymentOut } from "@/types/api";

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function monthLabel(key: string) {
  const d = new Date(`${key}-01T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "succeeded":
      return "success";
    case "pending":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

function methodIcon(method: string): { ios: IconName; android: AndroidSymbol } {
  switch (method) {
    case "cash":
      return { ios: "banknote", android: "payments" };
    case "bank_transfer":
      return { ios: "building.columns", android: "account_balance" };
    case "mobile_wallet":
      return { ios: "iphone", android: "smartphone" };
    default:
      return { ios: "creditcard", android: "credit_card" };
  }
}

export default function Screen_payments() {
  const org = useGet<OrganizationOut>("/organizations/me", ["payment.recorded", "membership.changed"]);
  const payments = useGet<PaymentOut[]>("/payments/my", ["payment.recorded"]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const currency = org.data?.currency || "USD";
  const data = payments.data;

  const total = useMemo((): number => (data ?? []).reduce((sum, p) => sum + p.amount - (p.refunded_amount ?? 0), 0), [data]);
  const groups = useMemo(() => {
    const map = new Map<string, PaymentOut[]>();
    for (const p of data ?? []) {
      const key = monthKey(p.paid_at ?? p.created_at);
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [data]);

  return (
    <AppScreen
      title="Payments"
      subtitle="Your payment history"
    >
      {payments.loading && !payments.data ? (
        <DashboardSkeleton />
      ) : payments.error ? (
        <DashboardError message={payments.error} onRetry={() => { payments.refetch(); org.refetch(); }} />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState title="No payments yet" message="Your membership payments will appear here." icon="creditcard" />
      ) : (
        <>
          {/* Total card */}
          <View className="mb-6 rounded-3xl bg-accent p-5">
            <Text className="text-[13px] font-semibold text-accent-foreground opacity-80">Total paid</Text>
            <AnimatedNumber
              value={total}
              decimals={2}
              format={(n) => money(n, currency)}
              style={{ fontSize: 34, fontWeight: "800", color: "#ffffff", marginTop: 4 }}
            />
            <Text className="mt-1 text-[13px] text-accent-foreground opacity-80">
              {(data?.length ?? 0)} payment{(data?.length ?? 0) > 1 ? "s" : ""}
            </Text>
          </View>

          {groups.map(([month, items]) => (
            <SectionCard key={month} title={monthLabel(month)}>
              <View className="overflow-hidden rounded-2xl bg-surface shadow-surface">
                {items.map((p, i) => {
                  const icon = methodIcon(p.method);
                  const expanded = expandedId === p.id;
                  return (
                    <View
                      key={p.id}
                      style={{ borderTopWidth: i > 0 ? 0.5 : 0, borderTopColor: "rgba(128,128,128,0.25)" }}
                    >
                      <Stagger gap={0}>
                        <View className="flex-row items-center gap-3 px-4 py-3.5">
                          <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-tertiary">
                            <Icon name={icon.ios} android={icon.android} size={18} className="text-muted" />
                          </View>
                          <View className="flex-1">
                            <Text type="body" weight="medium" className="text-foreground">
                              {humanize(p.kind ?? "member_fee")}
                            </Text>
                            <Text type="body-sm" color="muted">
                              {formatDay(p.paid_at ?? p.created_at)}
                            </Text>
                          </View>
                          <View className="items-end">
                            <Text type="body" weight="semibold" className="text-foreground">
                              {money(p.amount, currency)}
                            </Text>
                            <Badge tone={statusTone(p.status)} label={humanize(p.status)} />
                          </View>
                        </View>
                        {expanded ? (
                          <View className="gap-1 border-t px-4 py-3" style={{ borderColor: "rgba(128,128,128,0.2)" }}>
                            <Detail label="Method" value={humanize(p.method)} />
                            <Detail label="Kind" value={humanize(p.kind ?? "member_fee")} />
                            {p.refunded_amount ? <Detail label="Refunded" value={money(p.refunded_amount, currency)} /> : null}
                          </View>
                        ) : null}
                        <View className="px-4 pb-3">
                          <Text
                            className="text-[12px] font-semibold text-accent"
                            onPress={() => setExpandedId(expanded ? null : p.id)}
                          >
                            {expanded ? "Hide details" : "Details"}
                          </Text>
                        </View>
                      </Stagger>
                    </View>
                  );
                })}
              </View>
            </SectionCard>
          ))}
        </>
      )}
    </AppScreen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text type="body-sm" color="muted">{label}</Text>
      <Text type="body-sm" className="text-foreground">{value}</Text>
    </View>
  );
}