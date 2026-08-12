import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import type { ColorValue } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";
import type { AndroidSymbol } from "expo-symbols";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Icon } from "@/components/icon";

/**
 * A tab's symbol in both states. iOS gets the outline/filled SF Symbol pair
 * Apple uses in tab bars; Android has no fill axis exposed by `expo-symbols`,
 * so it leans on weight and tint instead (`mdActive` only when a real filled
 * glyph exists).
 */
export interface TabSymbol {
  sf: SFSymbol;
  sfActive: SFSymbol;
  md: AndroidSymbol;
  mdActive?: AndroidSymbol;
}

interface TabIconProps {
  symbol: TabSymbol;
  focused: boolean;
  activeColor: ColorValue;
  inactiveColor: ColorValue;
}

/** Slightly under the 25pt react-navigation default — reads lighter, less toy-like. */
const ICON_SIZE = 21;
/** The icon's hit area. Sized to the touch target, not the glyph. */
export const CELL_WIDTH = 46;
export const CELL_HEIGHT = 34;

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
        <Icon
          name={symbol.sf}
          android={symbol.md}
          size={ICON_SIZE}
          color={inactiveColor}
          weight="regular"
        />
      </Animated.View>
      <Animated.View style={[styles.layer, activeStyle]}>
        <Icon
          name={symbol.sfActive}
          android={symbol.mdActive ?? symbol.md}
          size={ICON_SIZE}
          color={activeColor}
          weight={symbol.mdActive ? "regular" : "semibold"}
        />
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
