import React from "react";
import { View } from "react-native";
import { Skeleton } from "heroui-native";

/** Rounded rectangle used for every skeleton block. */
function Block({ className }: { className: string }) {
  return <Skeleton variant="pulse" className={`rounded-lg bg-surface-tertiary ${className}`} />;
}

/** Two-column metric grid placeholders, mirroring the StatCard layout. */
function MetricGrid() {
  return (
    <View className="flex-row gap-3">
      <Block className="h-24 flex-1" />
      <Block className="h-24 flex-1" />
    </View>
  );
}

function ListRows() {
  return (
    <View className="gap-3">
      <Block className="h-16 w-full" />
      <Block className="h-16 w-full" />
    </View>
  );
}

/**
 * Loading placeholder for a dashboard: header line, a wide banner, two metric
 * cards, then a few list rows — matching the screens they fill in.
 */
export function DashboardSkeleton() {
  return (
    <View className="gap-6 pb-4">
      <View className="gap-2">
        <Block className="h-8 w-3/4" />
        <Block className="h-4 w-1/2" />
      </View>
      <Block className="h-28 w-full" />
      <MetricGrid />
      <MetricGrid />
      <ListRows />
    </View>
  );
}