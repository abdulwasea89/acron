import React, { createContext, use, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import type { View } from "react-native";
import { BlurTargetView } from "expo-blur";
import { useIsFocused } from "expo-router";

/**
 * Android blur plumbing.
 *
 * `expo-blur` on Android can't sample the window the way iOS does — it re-draws
 * a specific host view into the blur. That host has to be a `BlurTargetView`
 * wrapping the content being blurred, and the `BlurView` has to live *outside*
 * it, holding a ref to it. The tab bar is a sibling of the screens, so the ref
 * has to travel between them: the focused screen publishes its host here, and
 * the tab bar background reads it.
 *
 * On iOS this is inert — `BlurTargetView` is a plain `View` there, and the bar
 * uses the system material instead. So the whole tree is skipped off Android.
 */

const BlurTargetContext = createContext<{
  target: View | null;
  publish: (view: View | null) => void;
} | null>(null);

export const ANDROID_BLUR = Platform.OS === "android";

export function BlurTargetProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<View | null>(null);

  // Kept stable so publishing doesn't re-render every screen.
  const value = useMemo(() => ({ target, publish: setTarget }), [target]);

  if (!ANDROID_BLUR) return <>{children}</>;

  return <BlurTargetContext value={value}>{children}</BlurTargetContext>;
}

/**
 * The blur host for one screen. Publishes itself while focused so the tab bar
 * blurs the screen the user is actually looking at, not whichever mounted last.
 */
export function ScreenBlurTarget({ children }: { children: React.ReactNode }) {
  const ctx = use(BlurTargetContext);
  const focused = useIsFocused();
  // `BlurTargetView` takes a ref object, not a callback ref, so the host is
  // republished from an effect on focus rather than at attach time.
  const hostRef = useRef<View | null>(null);

  useEffect(() => {
    if (focused) ctx?.publish(hostRef.current);
  }, [ctx, focused]);

  if (!ctx) return <>{children}</>;

  return (
    <BlurTargetView ref={hostRef} style={styles.fill}>
      {children}
    </BlurTargetView>
  );
}

/**
 * The focused screen's blur host, wrapped as a ref object because that is what
 * `BlurView` takes. A fresh object each call is intentional — `BlurView` only
 * re-resolves its native target when the ref's `.current` changes identity.
 */
export function useBlurTarget() {
  const target = use(BlurTargetContext)?.target ?? null;
  return { current: target };
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
