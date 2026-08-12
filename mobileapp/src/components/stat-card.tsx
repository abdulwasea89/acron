import React from "react";
import { View } from "react-native";
import { Card, Text } from "heroui-native";
import { Icon, type IconName } from "@/components/icon";
import type { AndroidSymbol } from "expo-symbols";

type Tone = "accent" | "success" | "warning" | "danger" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  neutral: "bg-surface-tertiary",
};

const TONE_FOREGROUND: Record<Tone, string> = {
  accent: "text-accent-foreground",
  success: "text-success-foreground",
  warning: "text-warning-foreground",
  danger: "text-danger-foreground",
  neutral: "text-foreground",
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: IconName;
  /** Material Symbol name for Android/web when `icon` has no cross-platform pair. */
  android?: AndroidSymbol;
  tone?: Tone;
  hint?: string;
}

/** Headline metric card — icon tile + big number + label. */
export function StatCard({ label, value, icon, android, tone = "neutral", hint }: StatCardProps) {
  return (
    <Card className="flex-1">
      <Card.Body>
        <View className="gap-2.5">
          {icon && (
            <View
              className={`h-9 w-9 items-center justify-center rounded-xl ${TONE_CLASS[tone]} ${TONE_FOREGROUND[tone]}`}
            >
              <Icon name={icon} android={android} size={18} color="currentColor" />
            </View>
          )}
          <View className="gap-0.5">
            <Text type="h3" className="text-foreground tabular-nums">
              {value}
            </Text>
            <Text type="body-xs" color="muted">
              {label}
            </Text>
            {hint ? (
              <Text type="body-xs" color="muted">
                {hint}
              </Text>
            ) : null}
          </View>
        </View>
      </Card.Body>
    </Card>
  );
}
