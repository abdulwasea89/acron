import React, { useEffect, useRef, useState } from "react";
import type { StyleProp, TextStyle } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";

interface AnimatedNumberProps {
  value: number;
  /** Fixed decimal places, e.g. currency uses 2. */
  decimals?: number;
  /** Optional formatter applied to the animated value (e.g. money, %). */
  format?: (n: number) => string;
  duration?: number;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/**
 * Counts from 0 to `value` on mount/change. The formatted string is driven by
 * a JS-side rAF-free timer (lightweight — one state update per frame is fine
 * for a headline figure) while a subtle spring scale punctuates each change.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  format,
  duration = 650,
  style,
  numberOfLines,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (value - from) * eased;
      setDisplay(current);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);

  const scale = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(1, { damping: 16, stiffness: 240 }) }],
  }));

  const text = format ? format(display) : display.toFixed(decimals);

  return (
    <Animated.Text style={[scale, style]} numberOfLines={numberOfLines}>
      {text}
    </Animated.Text>
  );
}