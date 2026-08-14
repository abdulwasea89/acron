import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * Whether the user has asked for reduced transparency (iOS only; Android does
 * not report this setting). Decorative translucency — glows, frosted surfaces,
 * backdrop blur — should be gated on this so legibility wins when the user
 * asks for less.
 */
export function useReduceTransparency() {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    let cancelled = false;
    AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (!cancelled) setReduce(enabled);
    });
    const sub = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setReduce);

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return reduce;
}