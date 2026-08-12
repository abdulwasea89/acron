import React, { use, useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { BottomTabBarHeightContext } from "expo-router/tabs";
import type { BottomTabBarButtonProps, BottomTabNavigationOptions } from "expo-router/tabs";

import { CELL_HEIGHT, CELL_WIDTH, TabIcon } from "@/components/tab-icon";
import type { TabSymbol } from "@/components/tab-icon";
import { ANDROID_BLUR, ScreenBlurTarget, useBlurTarget } from "@/components/blur-target";
import { getPalette } from "@/lib/theme";

/**
 * Tab bar chrome. The bar is a floating glass capsule that content scrolls
 * underneath — not an opaque strip welded to the bottom edge. Icons carry it
 * alone; one-word labels under unambiguous glyphs are noise.
 */

/** Bar height, excluding the safe-area gap it floats above. */
const BAR_HEIGHT = 60;
/** Clearance between the capsule and the home indicator / screen edge. */
const FLOAT_GAP = 12;
/** Inset from the left and right screen edges. */
const SIDE_INSET = 20;

/**
 * Bottom padding a screen needs so its last row clears the floating bar.
 * Returns `0` outside a tab navigator, so `AppScreen` works on stack screens
 * too — hence reading the context directly rather than `useBottomTabBarHeight`,
 * which throws when the context is absent.
 */
export function useTabBarInset() {
  const height = use(BottomTabBarHeightContext) ?? 0;
  const insets = useSafeAreaInsets();

  // The context only carries the bar's own height; the gap it floats above is
  // ours, so add it back.
  return height ? height + insets.bottom + FLOAT_GAP : 0;
}

export function useTabBarTheme() {
  const isDark = useColorScheme() === "dark";

  return {
    isDark,
    active: isDark ? "#ffffff" : "#0a0a0a",
    inactive: isDark ? "rgba(235,235,245,0.50)" : "rgba(60,60,67,0.48)",
    /** Bright rim where light catches the edge of the bar. */
    rim: isDark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.65)",
    /** Fallback fill when the material is unavailable or opted out of. */
    solid: isDark ? "rgba(32,32,36,0.98)" : "rgba(252,252,252,0.98)",
    /** Tints the material so it never disappears against a matching background. */
    veil: isDark ? "rgba(30,30,34,0.55)" : "rgba(255,255,255,0.55)",
  };
}

/**
 * Reduce Transparency drops the material for a solid fill — legibility beats
 * the effect. Only iOS reports this setting; on Android the blur stays.
 */
function useReduceTransparency() {
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

function TabBarBackground() {
  const { isDark, solid, rim, veil } = useTabBarTheme();
  const reduceTransparency = useReduceTransparency();
  // Android's blur re-draws a host view rather than sampling the window, so it
  // needs the focused screen's `BlurTargetView`; iOS ignores this entirely.
  const blurTarget = useBlurTarget();

  return (
    <View style={styles.capsule}>
      {reduceTransparency ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: solid }]} />
      ) : isLiquidGlassAvailable() ? (
        <GlassView
          style={StyleSheet.absoluteFill}
          glassEffectStyle="regular"
          colorScheme={isDark ? "dark" : "light"}
        />
      ) : (
        <>
          <BlurView
            style={StyleSheet.absoluteFill}
            tint={isDark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
            intensity={ANDROID_BLUR ? 100 : 70}
            // SDK 31+ only: the older backend re-renders the host view every
            // frame, which is too costly for permanently visible chrome.
            blurMethod="dimezisBlurViewSdk31Plus"
            blurTarget={blurTarget}
          />
          {/* Blur alone vanishes over a flat background — the veil keeps the
              capsule readable as a distinct surface. */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: veil }]} />
        </>
      )}
      <View style={[styles.rim, { borderColor: rim }]} />
    </View>
  );
}

/**
 * Builds a `tabBarIcon` renderer. React Navigation hands the icon a single
 * resolved `color`, but the cross-fade needs both states at once, so the colors
 * come from the theme instead.
 */
export function useTabIcon() {
  const { active, inactive } = useTabBarTheme();

  return (symbol: TabSymbol) =>
    function TabBarIcon({ focused }: { focused: boolean }) {
      return (
        <TabIcon symbol={symbol} focused={focused} activeColor={active} inactiveColor={inactive} />
      );
    };
}

/**
 * The tab's pressable. Exists only to override react-navigation's built-in one,
 * which hardcodes `justifyContent: 'flex-start'` and 5px of padding — the
 * reason icons sat at the top of the bar. Their style is dropped rather than
 * merged, since merging would re-inherit the alignment being fixed. No ripple:
 * a borderless ripple on a transparent cell reads as a stray square.
 */
function TabBarButton({
  children,
  style: _navigationStyle,
  ref: _navigationRef,
  ...props
}: BottomTabBarButtonProps) {
  return (
    <Pressable {...props} android_ripple={null} style={styles.button}>
      {children}
    </Pressable>
  );
}

/**
 * Wraps every tab screen in the blur host the Android bar samples. Pass as the
 * navigator's `screenLayout`. A no-op on iOS, where `ScreenBlurTarget` renders
 * its children straight through.
 */
export const tabScreenLayout = ({ children }: { children: React.ReactElement }) => (
  <ScreenBlurTarget>{children}</ScreenBlurTarget>
);

/** Shared `screenOptions` for every role's tab layout. */
export function useTabScreenOptions(): BottomTabNavigationOptions {
  const { active, inactive, isDark } = useTabBarTheme();
  const insets = useSafeAreaInsets();

  return {
    headerShown: false,
    tabBarShowLabel: false,
    // Screens are transparent until their own view paints; without this the
    // navigator's default light gray shows through in dark mode.
    sceneStyle: { backgroundColor: getPalette(isDark).background },
    tabBarActiveTintColor: active,
    tabBarInactiveTintColor: inactive,
    tabBarBackground: () => <TabBarBackground />,
    tabBarHideOnKeyboard: Platform.OS === "android",
    tabBarStyle: {
      // Absolute so screen content passes under the capsule rather than
      // stopping at it. Screens pad for it via `useTabBarInset`.
      position: "absolute",
      bottom: insets.bottom + FLOAT_GAP,
      // `start`/`end`, not `left`/`right` — react-navigation's own bar style
      // sets the logical properties, and those win over the physical ones.
      start: SIDE_INSET,
      end: SIDE_INSET,
      height: BAR_HEIGHT,
      backgroundColor: "transparent",
      borderTopWidth: 0,
      // The bar lifts off the bottom edge, so it owns no safe-area padding —
      // otherwise react-navigation's default inset would squash the icons.
      paddingBottom: 0,
      // A surface this size reads as thick: deeper shadow than a small chip.
      shadowColor: "#000",
      shadowOpacity: isDark ? 0.45 : 0.14,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
      elevation: 16,
    },
    // `tabBarItemStyle` only reaches the outer wrapper; the pressable inside it
    // is hardcoded to `justifyContent: 'flex-start'` with 5px padding, which
    // pins every icon to the top of the bar. Replacing the button is the only
    // way to center them.
    tabBarButton: (props) => <TabBarButton {...props} />,
    // React Navigation wraps every icon in a fixed 31x28 box; size it to the
    // cell so the glyph isn't clipped or nudged off-center.
    tabBarIconStyle: {
      alignSelf: "center",
      width: CELL_WIDTH,
      height: CELL_HEIGHT,
    },
  };
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  capsule: {
    ...StyleSheet.absoluteFill,
    borderRadius: BAR_HEIGHT / 2,
    borderCurve: "continuous",
    // Clips the material to the capsule.
    overflow: "hidden",
  },
  rim: {
    ...StyleSheet.absoluteFill,
    borderRadius: BAR_HEIGHT / 2,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
