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

import { getPalette, spring } from "@/lib/theme";
import type { FlowPosition } from "@/lib/flow";

/** Rail thickness. Thin enough to read as a hairline, thick enough to see. */
const TRACK_HEIGHT = 3;

interface FlowProgressProps {
  position: FlowPosition;
}

/**
 * Progress rail for a multi-screen sign-up flow.
 *
 * A single continuous bar rather than a row of dots: dots imply you can jump
 * between steps, and at seven steps they shrink to noise. The fill springs to
 * its new width on mount so advancing a screen reads as forward movement
 * instead of a cut, and the "Step 2 of 7" caption keeps the exact position
 * legible for anyone who can't infer it from bar length alone.
 */
export function FlowProgress({ position }: FlowProgressProps) {
  const { step, total, label } = position;
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);
  const reducedMotion = useReducedMotion();

  const target = step / total;
  // Starts one step back so the bar animates *into* its position on mount —
  // the screen transition and the fill then read as one movement. The first
  // step has nowhere to grow from, so it just appears filled.
  const fraction = useSharedValue(step === 1 ? target : (step - 1) / total);

  React.useEffect(() => {
    fraction.value = reducedMotion
      ? withTiming(target, { duration: 200 })
      : withSpring(target, spring.standard);
  }, [target, reducedMotion, fraction]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fraction.value * 100}%`,
  }));

  return (
    <View
      className="gap-2"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: step }}
    >
      <View className="flex-row items-baseline justify-between">
        <Text type="body-sm" weight="semibold" className="text-foreground">
          {label}
        </Text>
        <Text type="body-xs" color="muted" className="tabular-nums">
          Step {step} of {total}
        </Text>
      </View>

      <View
        className="overflow-hidden rounded-full"
        style={{ height: TRACK_HEIGHT, backgroundColor: p.border }}
      >
        <Animated.View
          style={[
            { height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT, backgroundColor: p.accent },
            fillStyle,
          ]}
        />
      </View>
    </View>
  );
}
