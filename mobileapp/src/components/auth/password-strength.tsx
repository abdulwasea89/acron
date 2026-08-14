import React from "react";
import { View, useColorScheme } from "react-native";
import { Text } from "heroui-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "@/components/icon";
import { getPalette, spring } from "@/lib/theme";

/**
 * The four rules `passwordSchema` enforces, restated as live checks.
 *
 * Keeping them in the same order as the schema matters: if someone fails
 * submission anyway, the error they get names a rule they can already see.
 */
const RULES = [
  { label: "12+ characters", test: (v: string) => v.length >= 12 },
  { label: "Upper & lowercase", test: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { label: "A number", test: (v: string) => /[0-9]/.test(v) },
  { label: "A symbol", test: (v: string) => /[^a-zA-Z0-9]/.test(v) },
] as const;

/** Returns how many of the rules `value` satisfies. */
export function passwordScore(value: string): number {
  return RULES.filter((r) => r.test(value)).length;
}

interface PasswordStrengthProps {
  value: string;
}

/**
 * Live checklist under a new-password field.
 *
 * Password rules delivered as a red error after submit are a puzzle: you're
 * told what's wrong only once you've already committed to an answer. Showing
 * the four requirements ticking off as you type turns the same rules into a
 * progress indicator, and the meter above them summarises it at a glance.
 *
 * Renders nothing until there's a character to judge — an all-red checklist
 * greeting an empty field reads as failure before you've done anything.
 */
export function PasswordStrength({ value }: PasswordStrengthProps) {
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);
  const reducedMotion = useReducedMotion();

  const score = passwordScore(value);
  const fraction = useSharedValue(0);

  React.useEffect(() => {
    const to = score / RULES.length;
    fraction.value = reducedMotion
      ? withTiming(to, { duration: 160 })
      : withSpring(to, spring.standard);
  }, [score, reducedMotion, fraction]);

  const meterStyle = useAnimatedStyle(() => ({
    width: `${fraction.value * 100}%`,
  }));

  if (!value) return null;

  /* Amber until every rule passes, then green. No intermediate green: a
     half-satisfied password isn't "nearly fine", it's rejected. */
  const complete = score === RULES.length;
  const meterColor = complete ? p.success : p.warning;

  return (
    <View className="mt-3 gap-2.5 px-1">
      <View className="h-1 overflow-hidden rounded-full" style={{ backgroundColor: p.border }}>
        <Animated.View
          style={[{ height: 4, borderRadius: 4, backgroundColor: meterColor }, meterStyle]}
        />
      </View>

      <View className="flex-row flex-wrap gap-x-4 gap-y-1.5">
        {RULES.map((rule) => {
          const passed = rule.test(value);
          return (
            <View key={rule.label} className="flex-row items-center gap-1.5">
              <Icon
                name={passed ? "checkmark.circle.fill" : "circle"}
                android={passed ? "check_circle" : "circle"}
                size={13}
                color={passed ? p.success : p.muted}
              />
              <Text type="body-xs" style={{ color: passed ? p.success : p.muted }}>
                {rule.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
