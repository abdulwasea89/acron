import React from "react";
import { View } from "react-native";
import { Text } from "heroui-native";
import { Icon, type IconName } from "@/components/icon";

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: IconName;
  showIcon?: boolean;
  /** Use the brand color when the empty state is a primary destination. */
  tone?: "neutral" | "accent";
  action?: React.ReactNode;
}

/** Friendly empty state for lists and dashboards with no data yet. */
export function EmptyState({ title, message, icon = "tray", showIcon = true, tone = "neutral", action }: EmptyStateProps) {
  const isAccent = tone === "accent";

  return (
    <View className="items-center px-6 py-12">
      {showIcon ? (
        <View
          className="mb-4 h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: isAccent ? "#0b315c" : "#3a3e46" }}
        >
          <Icon name={icon} android="inbox" size={26} color={isAccent ? "#93c5fd" : "#cbd5e1"} />
        </View>
      ) : null}
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
