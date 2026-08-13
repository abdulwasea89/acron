import React from "react";
import { StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

/**
 * Entrance reveal: fades + drifts up as a view mounts. Built on Reanimated 4's
 * layout entering animations (the proven pattern from `tab-icon`). Screens use
 * this everywhere via `Stagger` so every scene lands with a soft cascade.
 */
export function Reveal({
  children,
  delay = 0,
  distance = 14,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(340).springify().damping(20).stiffness(220)}
      style={[styles.base, distance ? { transform: [] } : undefined, style]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Staggered entrance for a list of blocks/sections. Adds a fixed delay between
 * siblings so cards cascade onto the screen in sequence rather than together.
 */
export function Stagger({
  children,
  gap = 72,
  style,
}: {
  children: React.ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const items = React.Children.toArray(children);
  return (
    <View style={style}>
      {items.map((child, i) => (
        <Reveal key={i} delay={i * gap}>
          {child}
        </Reveal>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    // No-op transform slot so `style` overrides don't fight the entering anim.
    transform: [],
  },
});