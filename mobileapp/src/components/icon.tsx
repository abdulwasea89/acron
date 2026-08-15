import React from "react";
import { SymbolView } from "expo-symbols";
import type { SFSymbol } from "expo-symbols";
import { MaterialIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useColorScheme, type ColorValue } from "react-native";

import { getPalette, type Palette } from "@/lib/theme";

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
 * `SymbolView` and the Android Material fallback do not inherit CSS
 * `currentColor`. Resolve the semantic utility ourselves so native icons have
 * the same contrast as text on every screen.
 */
function semanticIconColor(className: string | undefined, palette: Palette): string {
  const classes = className ?? "";

  if (classes.includes("text-accent-foreground") || classes.includes("text-white")) return "#ffffff";
  if (classes.includes("text-danger")) return palette.danger;
  if (classes.includes("text-warning")) return palette.warning;
  if (classes.includes("text-success")) return palette.success;
  if (classes.includes("text-accent")) return palette.accent;
  if (classes.includes("text-muted")) return palette.muted;

  return palette.foreground;
}

/**
 * Cross-platform icon. Renders the iOS SF Symbol (`name`) on iOS and the
 * matching Material icon (via `android`) on Android/web using `SymbolView`'s
 * fallback.
 */
export function Icon({ name, android, size = 24, color, weight = "regular", className }: IconProps) {
  const isDark = useColorScheme() === "dark";
  const palette = getPalette(isDark);
  const semanticColor = semanticIconColor(className, palette);
  const resolvedColor =
    typeof color === "string" && (color === "currentColor" || color.startsWith("text-"))
      ? semanticIconColor(color === "currentColor" ? className : color, palette)
      : color ?? semanticColor;

  return (
    <SymbolView
      name={name}
      size={size}
      weight={weight}
      tintColor={resolvedColor}
      className={className}
      fallback={
        android ? (
          <MaterialIcons name={MATERIAL_FALLBACK[android] ?? "error"} size={size} color={resolvedColor} />
        ) : null
      }
    />
  );
}
