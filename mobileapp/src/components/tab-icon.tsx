import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import type { ColorValue } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { TabGlyphIcon } from "@/components/tab-icons";
import type { TabGlyph } from "@/components/tab-icons";

/**
 * A tab's symbol. Both states come from the shared Ionicons glyph set — the
 * outline and filled families are stable across iOS, Android and web, so the
 * tab bar carries the brand instead of diverging per platform.
 */
export interface TabSymbol {
  glyph: TabGlyph;
}

interface TabIconProps {
  symbol: TabSymbol;
  focused: boolean;
  activeColor: ColorValue;
  inactiveColor: ColorValue;
}

/** A confident glyph that still leaves the capsule room to breathe. */
const ICON_SIZE = 24;
/** The icon's hit area. Sized to the touch target, not the glyph. */
export const CELL_WIDTH = 28;
export const CELL_HEIGHT = 26;

const CROSSFADE_MS = 180;

/**
 * Tab bar glyph. The outline and filled variants are stacked and cross-faded
 * rather than swapped, so the weight change reads as one symbol thickening
 * instead of two icons blinking. Fill and tint alone mark the selected tab —
 * no capsule behind it, since the brightness shift already carries that.
 */
export function TabIcon({ symbol, focused, activeColor, inactiveColor }: TabIconProps) {
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, { duration: CROSSFADE_MS });
  }, [focused, progress]);

  const activeStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const inactiveStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));

  return (
    <View style={styles.box}>
      <Animated.View style={[styles.layer, inactiveStyle]}>
        <TabGlyphIcon name={symbol.glyph} active={false} size={ICON_SIZE} color={inactiveColor} />
      </Animated.View>
      <Animated.View style={[styles.layer, activeStyle]}>
        <TabGlyphIcon name={symbol.glyph} active size={ICON_SIZE} color={activeColor} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  layer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
});
