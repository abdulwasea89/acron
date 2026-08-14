import React from "react";
import { Pressable, View, useColorScheme, type LayoutChangeEvent } from "react-native";
import { Text } from "heroui-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { getPalette, spring } from "@/lib/theme";

export interface SegmentOption {
  label: string;
  value: string;
}

interface SegmentedProps {
  label?: string;
  options: readonly SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/**
 * iOS-style segmented control.
 *
 * For a short, mutually exclusive set — gender, billing period — this beats
 * both a dropdown (which hides the options behind a tap) and a row of bordered
 * buttons (which reads as three separate actions rather than one choice).
 *
 * The selected pill slides between segments instead of the fill jumping. The
 * movement is what tells you the segments are one control and the choice moved
 * from A to B, rather than one thing switching off and another switching on.
 */
export function Segmented({ label, options, value, onChange, error }: SegmentedProps) {
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);
  const reducedMotion = useReducedMotion();

  const [trackWidth, setTrackWidth] = React.useState(0);
  const index = options.findIndex((o) => o.value === value);
  const offset = useSharedValue(0);

  // Inset of the pill inside the track, on every side.
  const PAD = 3;
  const segmentWidth = trackWidth > 0 ? (trackWidth - PAD * 2) / options.length : 0;

  React.useEffect(() => {
    if (segmentWidth === 0 || index < 0) return;
    const to = index * segmentWidth;
    offset.value = reducedMotion
      ? withTiming(to, { duration: 140 })
      : withSpring(to, spring.standard);
  }, [index, segmentWidth, reducedMotion, offset]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  return (
    <View>
      {label ? (
        <Text
          type="body-xs"
          weight="semibold"
          color="muted"
          className="mb-2 ml-4 uppercase"
          style={{ letterSpacing: 0.5 }}
        >
          {label}
        </Text>
      ) : null}

      <View
        onLayout={onLayout}
        accessibilityRole="radiogroup"
        className="flex-row rounded-2xl"
        style={{ backgroundColor: p.surfaceTertiary, padding: PAD }}
      >
        {/* Only drawn once the track has been measured — a zero-width pill
            flashing at the left edge on first paint is worse than no pill. */}
        {segmentWidth > 0 && index >= 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                left: PAD,
                top: PAD,
                bottom: PAD,
                width: segmentWidth,
                borderRadius: 13,
                borderCurve: "continuous",
                backgroundColor: p.accent,
              },
              pillStyle,
            ]}
          />
        ) : null}

        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              className="flex-1 items-center justify-center py-2.5"
            >
              <Text
                type="body-sm"
                weight={active ? "semibold" : "medium"}
                style={{ color: active ? "#ffffff" : p.muted }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Text type="body-xs" className="mt-1.5 ml-4 text-danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
