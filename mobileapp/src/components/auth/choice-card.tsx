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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ChoiceCardProps {
  /** Headline price or primary value. */
  price: string;
  /** Unit after the price ("/month"), rendered small and muted. */
  period?: string;
  name: string;
  /** One-line qualifier under the name (member cap, description). */
  detail?: string;
  /** Bulleted inclusions. */
  features?: readonly string[];
  /** Adds a "Popular" flag. */
  featured?: boolean;
  selected: boolean;
  onPress: () => void;
}

/**
 * Selectable plan / tier card.
 *
 * Selection is carried by the card itself — border, tint, and a filled tick —
 * rather than a separate radio dot off to one side. The whole card is the
 * target, so the control and what it selects are the same object; a radio in
 * the corner splits that in two and invites people to aim at the dot.
 *
 * Pressing springs the card down. That press state is the only thing here with
 * any bounce, because it's the only thing responding to a finger.
 */
export function ChoiceCard({
  price,
  period,
  name,
  detail,
  features,
  featured,
  selected,
  onPress,
}: ChoiceCardProps) {
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);
  const reducedMotion = useReducedMotion();

  const pressed = useSharedValue(0);
  const selection = useSharedValue(selected ? 1 : 0);

  React.useEffect(() => {
    selection.value = reducedMotion
      ? withTiming(selected ? 1 : 0, { duration: 140 })
      : withSpring(selected ? 1 : 0, spring.standard);
  }, [selected, reducedMotion, selection]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - 0.02 * pressed.value }],
    borderColor: selection.value > 0.5 ? p.accent : p.border,
    borderWidth: 1 + selection.value,
  }));

  const tickStyle = useAnimatedStyle(() => ({
    opacity: selection.value,
    transform: [{ scale: 0.6 + 0.4 * selection.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withSpring(1, spring.press);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, spring.press);
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name}, ${price}${period ?? ""}`}
      style={[
        {
          borderRadius: 20,
          borderCurve: "continuous",
          padding: 18,
          backgroundColor: selected ? `${p.accent}14` : p.surface,
        },
        cardStyle,
      ]}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          {featured ? (
            <View
              className="mb-2 self-start rounded-full px-2 py-0.5"
              style={{ backgroundColor: p.accent }}
            >
              <Text
                type="body-xs"
                weight="bold"
                style={{ color: "#ffffff", fontSize: 10, letterSpacing: 0.4 }}
              >
                POPULAR
              </Text>
            </View>
          ) : null}

          <View className="flex-row items-baseline gap-1">
            <Text
              type="h3"
              className="text-foreground tabular-nums"
              style={{ letterSpacing: -0.5 }}
            >
              {price}
            </Text>
            {period ? (
              <Text type="body-sm" color="muted">
                {period}
              </Text>
            ) : null}
          </View>

          <Text type="body" weight="semibold" className="mt-1 text-foreground">
            {name}
          </Text>
          {detail ? (
            <Text type="body-sm" color="muted" className="mt-0.5">
              {detail}
            </Text>
          ) : null}
        </View>

        {/* Fixed-size well so the card doesn't reflow as the tick appears. */}
        <View
          className="ml-3 h-6 w-6 items-center justify-center rounded-full"
          style={{
            backgroundColor: selected ? p.accent : "transparent",
            borderWidth: selected ? 0 : 1.5,
            borderColor: p.separator,
          }}
        >
          <Animated.View style={tickStyle}>
            <Icon name="checkmark" android="check" size={14} weight="bold" color="#ffffff" />
          </Animated.View>
        </View>
      </View>

      {features?.length ? (
        <View className="mt-3.5 gap-1.5">
          {features.map((f) => (
            <View key={f} className="flex-row items-center gap-2">
              <Icon name="checkmark" android="check" size={12} weight="semibold" color={p.accent} />
              <Text type="body-sm" color="muted" className="flex-1">
                {f}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </AnimatedPressable>
  );
}
