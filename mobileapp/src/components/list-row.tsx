import React from "react";
import { Pressable, View } from "react-native";
import { Text } from "heroui-native";
import type { AndroidSymbol } from "expo-symbols";
import { Icon, type IconName } from "@/components/icon";

interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** Material Symbol name for Android/web. */
  android?: AndroidSymbol;
  /** Right-side trailing content (badges, values). */
  trailing?: React.ReactNode;
  /** Chevron shown when pressable. */
  chevron?: boolean;
  onPress?: () => void;
  /** Destructive row tint. */
  destructive?: boolean;
  /** Show a divider under the row. */
  divider?: boolean;
}

/** Pressable list row with icon, primary text, optional subtitle + trailing content. */
export function ListRow({
  title,
  subtitle,
  icon,
  android,
  trailing,
  chevron = false,
  onPress,
  destructive = false,
  divider = true,
}: ListRowProps) {
  const content = (
    <>
      {icon && (
        <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-surface-tertiary">
          <Icon
            name={icon}
            android={android}
            size={20}
            color={destructive ? undefined : undefined}
            className={destructive ? "text-danger" : "text-foreground"}
          />
        </View>
      )}
      <View className="flex-1">
        <Text type="body" weight="medium" className={destructive ? "text-danger" : "text-foreground"}>
          {title}
        </Text>
        {subtitle ? (
          <Text type="body-sm" color="muted" className="mt-0.5">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View className="ml-2">{trailing}</View> : null}
      {chevron ? (
        <View className="ml-2">
          <Icon name="chevron.right" android="chevron_right" size={16} color="text-muted" />
        </View>
      ) : null}
    </>
  );

  const row = (
    <View
      className={`flex-row items-center py-3.5 ${divider ? "border-b border-separator" : ""}`}
    >
      {content}
    </View>
  );

  if (!onPress) return row;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(128,128,128,0.15)" }}
      className="active:opacity-70"
    >
      {row}
    </Pressable>
  );
}
