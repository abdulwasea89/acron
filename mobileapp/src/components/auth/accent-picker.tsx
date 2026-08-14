import React from "react";
import { Pressable, View, useColorScheme } from "react-native";
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
 * Brand colors offered to a new gym.
 *
 * A fixed set rather than a free hex field: the value ends up as the accent
 * behind white text throughout both apps, and an owner who types `#ffff00`
 * ships an unreadable interface to their members. Every swatch here clears
 * contrast against white.
 */
const SWATCHES = [
  { name: "Blue", value: "#0485f7" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Emerald", value: "#059669" },
  { name: "Amber", value: "#d97706" },
  { name: "Rose", value: "#e11d48" },
  { name: "Slate", value: "#334155" },
] as const;

export const DEFAULT_ACCENT = SWATCHES[0].value;

interface AccentPickerProps {
  value: string;
  onChange: (value: string) => void;
}

function Swatch({
  color,
  name,
  selected,
  onPress,
}: {
  color: string;
  name: string;
  selected: boolean;
  onPress: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(selected ? 1 : 0);

  React.useEffect(() => {
    progress.value = reducedMotion
      ? withTiming(selected ? 1 : 0, { duration: 140 })
      : withSpring(selected ? 1 : 0, spring.gentle);
  }, [selected, reducedMotion, progress]);

  const tickStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.5 + 0.5 * progress.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.06 * progress.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={name}
      hitSlop={4}
    >
      <Animated.View
        style={[
          {
            height: 44,
            width: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: color,
          },
          ringStyle,
        ]}
      >
        <Animated.View style={tickStyle}>
          <Icon name="checkmark" android="check" size={18} weight="bold" color="#ffffff" />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/** Brand accent chooser for gym setup. */
export function AccentPicker({ value, onChange }: AccentPickerProps) {
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);

  return (
    <View>
      <Text
        type="body-xs"
        weight="semibold"
        color="muted"
        className="mb-2 ml-4 uppercase"
        style={{ letterSpacing: 0.5 }}
      >
        Brand color
      </Text>

      <View
        className="flex-row flex-wrap justify-between gap-y-3 rounded-2xl p-4"
        style={{ backgroundColor: p.surface }}
        accessibilityRole="radiogroup"
      >
        {SWATCHES.map((s) => (
          <Swatch
            key={s.value}
            color={s.value}
            name={s.name}
            selected={value.toLowerCase() === s.value}
            onPress={() => onChange(s.value)}
          />
        ))}
      </View>

      <Text type="body-xs" color="muted" className="mt-2 ml-4">
        Used across your members' app. You can change it later in settings.
      </Text>
    </View>
  );
}
