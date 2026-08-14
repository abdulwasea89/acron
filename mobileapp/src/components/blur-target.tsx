import type { ReactNode } from "react";
import { Platform } from "react-native";

/**
 * Android blur plumbing.
 *
 * Older expo-blur releases exposed a `BlurTargetView` host that a `BlurView`
 * could sample on Android. SDK 54's expo-blur (15.x) dropped that API: Android
 * blur now samples the window behind the `BlurView` directly via
 * `experimentalBlurMethod="dimezisBlurView"`. There is nothing to host or
 * publish anymore, so these wrappers exist only to keep the call sites stable.
 *
 * On iOS the system material handles the blur and these are inert.
 */

export const ANDROID_BLUR = Platform.OS === "android";

export function BlurTargetProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function ScreenBlurTarget({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
