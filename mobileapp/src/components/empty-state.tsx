import React from "react";
import { View } from "react-native";
import { Text } from "heroui-native";
import { Icon, type IconName } from "@/components/icon";

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: IconName;
  action?: React.ReactNode;
}

/** Friendly empty state for lists and dashboards with no data yet. */
export function EmptyState({ title, message, icon = "tray", action }: EmptyStateProps) {
  return (
    <View className="items-center px-6 py-12">
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-surface-tertiary">
        <Icon name={icon} android="inbox" size={26} color="text-muted" />
      </View>
      <Text type="body" weight="semibold" className="text-foreground">
        {title}
      </Text>
      {message ? (
        <Text type="body-sm" color="muted" className="mt-1 text-center">
          {message}
        </Text>
      ) : null}
      {action ? <View className="mt-5">{action}</View> : null}
    </View>
  );
}
