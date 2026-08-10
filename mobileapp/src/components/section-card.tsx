import React from "react";
import { View } from "react-native";
import { Text } from "heroui-native";
import { Icon, type IconName } from "@/components/icon";

interface SectionCardProps {
  title: string;
  /** Trailing element on the header row (e.g. "See all"). */
  action?: React.ReactNode;
  children: React.ReactNode;
}

/** Grouped content block with a small uppercase-ish section heading. */
export function SectionCard({ title, action, children }: SectionCardProps) {
  return (
    <View className="mb-6">
      <View className="mb-2 flex-row items-center justify-between px-1">
        <Text type="body-sm" weight="semibold" color="muted" className="uppercase tracking-wide">
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}
