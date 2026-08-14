import React from "react";
import { SymbolView } from "expo-symbols";
import type { SFSymbol } from "expo-symbols";
import { MaterialIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

export type IconName = SFSymbol;

type MaterialGlyph = ComponentProps<typeof MaterialIcons>["name"];

/**
 * Material Symbols → MaterialIcons glyph names for the Android/web fallback.
 * SF Symbols render on iOS; on Android and web `SymbolView` shows `fallback`
 * instead, so every icon keeps a real glyph on every platform.
 */
const MATERIAL_FALLBACK: Record<string, MaterialGlyph> = {
  account_balance: "account-balance",
  access_time: "access-time",
  add: "add",
  bell: "notifications",
  bell_fill: "notifications-active",
  bell_slash: "notifications-off",
  check: "check",
  check_circle: "check-circle",
  chevron_left: "chevron-left",
  chevron_right: "chevron-right",
  circle: "circle",
  close: "close",
  content_copy: "content-copy",
  credit_card: "credit-card",
  dangerous: "dangerous",
  delete: "delete",
  error: "error",
  fitness_center: "fitness-center",
  group: "group",
  inbox: "inbox",
  lock: "lock",
  logout: "logout",
  mail: "mail",
  payments: "payments",
  person: "person",
  query_stats: "query-stats",
  receipt_long: "receipt-long",
  schedule: "schedule",
  search: "search",
  shield: "shield",
  smartphone: "smartphone",
  storefront: "storefront",
  task_alt: "task-alt",
  visibility: "visibility",
  visibility_off: "visibility-off",
  warning: "warning",
};

interface IconProps {
  name: SFSymbol;
  /** Material Symbols name used for the Android/web fallback glyph. */
  android?: string;
  size?: number;
  color?: ColorValue;
  weight?: "ultraLight" | "light" | "regular" | "medium" | "semibold" | "bold" | "heavy" | "black";
  className?: string;
}

/**
 * Cross-platform icon. Renders the iOS SF Symbol (`name`) on iOS and the
 * matching Material icon (via `android`) on Android/web using `SymbolView`'s
 * fallback.
 */
export function Icon({ name, android, size = 24, color, weight = "regular", className }: IconProps) {
  return (
    <SymbolView
      name={name}
      size={size}
      weight={weight}
      tintColor={color}
      className={className}
      fallback={
        android ? (
          <MaterialIcons name={MATERIAL_FALLBACK[android] ?? "error"} size={size} color={color} />
        ) : null
      }
    />
  );
}
