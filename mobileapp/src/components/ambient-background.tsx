import { useState } from "react";
import { View, useColorScheme } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { useReduceTransparency } from "@/lib/accessibility";
import { getPalette } from "@/lib/theme";

/* SVG `id`s are scoped per `<Svg>` root, but keep them unique anyway so two
   instances mounted side by side (screens mid-transition) never collide. */
let uid = 0;

/**
 * A soft accent wash behind a screen's content.
 *
 * Two faint radial gradients — one settling over the top, one rising from the
 * bottom corner — give the flat background a sense of depth without drawing
 * the eye off the content. It is purely decorative: gated on reduced
 * transparency, and hidden from screen readers.
 */
export function AmbientBackground() {
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);
  const reduceTransparency = useReduceTransparency();
  const [id] = useState(() => `ambient-${++uid}`);

  if (reduceTransparency) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="absolute inset-0"
    >
      <Svg width="100%" height="100%" viewBox="0 0 390 844">
        <Defs>
          <RadialGradient id={`${id}-top`} cx="50%" cy="14%" r="42%">
            <Stop offset="0%" stopColor={p.accent} stopOpacity={isDark ? 0.3 : 0.18} />
            <Stop offset="100%" stopColor={p.accent} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${id}-bottom`} cx="88%" cy="92%" r="45%">
            <Stop offset="0%" stopColor={p.accent} stopOpacity={isDark ? 0.2 : 0.1} />
            <Stop offset="100%" stopColor={p.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id}-top)`} />
        <Rect width="100%" height="100%" fill={`url(#${id}-bottom)`} />
      </Svg>
    </View>
  );
}