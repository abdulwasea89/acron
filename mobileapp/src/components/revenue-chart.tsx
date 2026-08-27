import React from "react";
import { View } from "react-native";
import { Text } from "heroui-native";
import { money } from "@/lib/format";
import { humanize } from "@/components/status-chip";

const METHOD_COLORS: Record<string, string> = {
  card: "#3b82f6",
  cash: "#22c55e",
  bank_transfer: "#a78bfa",
  mobile_wallet: "#f59e0b",
};

/** Fallback for any method the backend reports that we don't have a color for. */
const FALLBACK_COLOR = "#94a3b8";

interface BarRowProps {
  label: string;
  amount: number;
  /** Share of the total (0–1) used to size the bar. */
  fraction: number;
  currency: string;
  color: string;
}

function BarRow({ label, amount, fraction, currency, color }: BarRowProps) {
  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between">
        <Text type="body" weight="medium" className="text-foreground">
          {label}
        </Text>
        <Text type="body-sm" className="text-muted tabular-nums">
          {money(amount, currency)}
        </Text>
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-surface-tertiary">
        <View style={{ backgroundColor: color, width: `${Math.max(0, Math.min(100, fraction * 100))}%` }} className="h-full rounded-full" />
      </View>
    </View>
  );
}

/**
 * Revenue breakdown by payment method as proportional bars. Pure view — callers
 * feed the raw method->amount map plus a total; each row shows a humanized label,
 * the currency amount, and a bar sized by its share of the total.
 */
export function RevenueByMethodChart({
  byMethod,
  total,
  currency,
}: {
  byMethod: Record<string, number>;
  total: number;
  currency: string;
}) {
  const rows = Object.entries(byMethod)
    .map(([method, amount]) => ({
      method,
      amount,
      fraction: total > 0 ? amount / total : 0,
      color: METHOD_COLORS[method] ?? FALLBACK_COLOR,
    }))
    .sort((a, b) => b.amount - a.amount);

  if (rows.length === 0) {
    return (
      <View className="rounded-2xl bg-surface p-5">
        <Text type="body" weight="semibold" className="text-foreground">
          No payments recorded yet
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      {rows.map((row) => (
        <BarRow
          key={row.method}
          label={humanize(row.method)}
          amount={row.amount}
          fraction={row.fraction}
          currency={currency}
          color={row.color}
        />
      ))}
    </View>
  );
}
