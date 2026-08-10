import React from "react";
import { Chip } from "heroui-native";

type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

interface BadgeProps {
  tone?: BadgeTone;
  label: string;
}

/*
  Status pill — member states (active / grace / expired / frozen), receipt
  verdicts, and the like. The `soft` variant gives a tonal background.

  HeroUI has no `info` color, so informational badges borrow `accent`.
*/
const toneMap: Record<BadgeTone, React.ComponentProps<typeof Chip>["color"]> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "accent",
  neutral: "default",
};

export function Badge({ tone = "neutral", label }: BadgeProps) {
  return (
    <Chip variant="soft" color={toneMap[tone]} size="sm">
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
}
