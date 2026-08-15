import React from "react";
import { View } from "react-native";
import { Card, Text } from "heroui-native";
import { Icon, type IconName } from "@/components/icon";
import { AnimatedNumber } from "@/components/motion";
import type { AndroidSymbol } from "expo-symbols";

type Tone = "accent" | "success" | "warning" | "danger" | "neutral";

/**
 * Explicit native colors are used here because `currentColor` is not inherited
 * by `SymbolView` on Android. The previous 10% token washes also made the
 * glyphs disappear against dark cards.
 */
const TONE_TILE: Record<Tone, { backgroundColor: string; iconColor: string }> = {
  accent: { backgroundColor: "#0b315c", iconColor: "#93c5fd" },
  success: { backgroundColor: "#103b28", iconColor: "#86efac" },
  warning: { backgroundColor: "#442d08", iconColor: "#fcd34d" },
  danger: { backgroundColor: "#4a1719", iconColor: "#fca5a5" },
  neutral: { backgroundColor: "#2b2e34", iconColor: "#e2e8f0" },
};

const TONE_VALUE: Record<Tone, string> = {
  accent: "text-accent",
  success: "text-success",
  warning: "text-foreground",
  danger: "text-danger",
  neutral: "text-foreground",
};

const TONE_VALUE_COLOR: Record<Tone, string> = {
  accent: "#3b82f6",
  success: "#22c55e",
  warning: "#f1f5f9",
  danger: "#ef4444",
  neutral: "#f1f5f9",
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: IconName;
  /** Material Symbol name for Android/web when `icon` has no cross-platform pair. */
  android?: AndroidSymbol;
  tone?: Tone;
  hint?: string;
  /** Count up from zero on mount/change when `value` is numeric. */
  animate?: boolean;
  /** Formatter for the animated value (e.g. `money`). */
  format?: (n: number) => string;
  /** Full-width horizontal layout instead of the half-width vertical tile. */
  wide?: boolean;
}

/**
 * Headline metric card — tonal icon tile + large tabular numeral + muted label.
 * Numerals use tight leading and negative tracking at display size (typography
 * scales with size, per Apple), and count up with a spring when `animate` is set.
 */
export function StatCard({
  label,
  value,
  icon,
  android,
  tone = "neutral",
  hint,
  animate = false,
  format,
  wide = false,
}: StatCardProps) {
  const tileTone = TONE_TILE[tone];
  const tile = (
    <View
      className="h-9 w-9 items-center justify-center rounded-[10px]"
      style={{ backgroundColor: tileTone.backgroundColor }}
    >
      {icon ? <Icon name={icon} android={android} size={18} color={tileTone.iconColor} /> : null}
    </View>
  );

  const numeral = animate && typeof value === "number" ? (
    <AnimatedNumber
      value={value}
      format={format}
      style={{ color: TONE_VALUE_COLOR[tone], fontSize: 28, lineHeight: 30, fontWeight: "700", letterSpacing: -0.5, fontVariant: ["tabular-nums"] }}
    />
  ) : (
    <Text
      type="h2"
      className={`${TONE_VALUE[tone]} tabular-nums tracking-tight`}
      style={{ lineHeight: 30 }}
      numberOfLines={1}
    >
      {value}
    </Text>
  );

  if (wide) {
    return (
      <Card className="flex-1">
        <Card.Body>
          <View className="flex-row items-center gap-3">
            {icon ? tile : null}
            <View className="flex-1">
              <Text type="body-xs" className="text-muted">
                {label}
              </Text>
              <View className="mt-0.5 flex-row items-baseline gap-1">{numeral}</View>
              {hint ? <Text type="body-xs" className="mt-0.5 text-muted">{hint}</Text> : null}
            </View>
          </View>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="flex-1">
      <Card.Body>
        <View className="gap-3">
          {icon ? tile : null}
          <View className="gap-0.5">
            {numeral}
            <Text type="body-xs" className="mt-1 text-muted tracking-wide">
              {label}
            </Text>
            {hint ? (
              <Text type="body-xs" className="mt-0.5 text-muted">
                {hint}
              </Text>
            ) : null}
          </View>
        </View>
      </Card.Body>
    </Card>
  );
}
