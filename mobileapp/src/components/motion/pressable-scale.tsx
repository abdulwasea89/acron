import React from "react";
import { Pressable } from "react-native";
import type { PressableProps, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends Omit<PressableProps, "style"> {
  scale?: number;
  /** Springs back and forth once after release (used for a success "pop"). */
  pop?: boolean;
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
}

/**
 * A pressable that compresses under a finger with a spring and snaps back on
 * release — a tactile alternative to the flat `active:opacity` state used
 * elsewhere. `pop` plays a quick overshoot after an action succeeds.
 */
export function PressableScale({
  scale = 0.96,
  pop = false,
  style,
  children,
  onPressIn: _onPressIn,
  onPressOut: _onPressOut,
  ...rest
}: PressableScaleProps) {
  const pressed = useSharedValue(0);
  const popped = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const base = popped.value > 0.5 ? 1 + 0.06 * popped.value : 1 - 0.04 * pressed.value;
    return { transform: [{ scale: base }] };
  });

  const handlePop = () => {
    popped.value = withTiming(1, { duration: 90 }, (finished) => {
      if (finished) popped.value = withSpring(0, { damping: 7, stiffness: 260 });
    });
  };

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        pressed.value = withSpring(1, { damping: 18, stiffness: 300 });
        _onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, { damping: 18, stiffness: 300 });
        if (pop) handlePop();
        _onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}