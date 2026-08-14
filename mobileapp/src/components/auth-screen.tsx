import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Text } from "heroui-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { Icon } from "@/components/icon";
import { FlowProgress } from "@/components/auth/flow-progress";
import { getPalette } from "@/lib/theme";
import type { FlowPosition } from "@/lib/flow";

/** Scroll distance over which the large title hands off to the compact one. */
const TITLE_HANDOFF = 44;

interface AuthScreenProps {
  /** Large title. Kept short — the subtitle carries the explanation. */
  title: string;
  /** Muted supporting line under the title. */
  subtitle?: string;
  /** Alias for subtitle (back-compat with older screens). */
  description?: string;
  /** Show the back chevron. */
  back?: boolean;
  onBack?: () => void;
  /** Progress rail for screens that are one step of a longer flow. */
  progress?: FlowPosition | null;
  /**
   * Actions pinned above the keyboard. The primary button belongs here, not at
   * the end of the scroll body: it stays reachable however long the form runs.
   */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Standard auth screen.
 *
 * Three things carry the native feel. The title starts large in the scroll
 * content and cross-fades into the fixed bar as it scrolls away, so the bar
 * holds a title only once the real one is gone. The bar overlays the content
 * rather than occupying a strip above it. And the footer is pinned rather than
 * trailing the form, so the primary action never needs a scroll to reach.
 */
export function AuthScreen({
  title,
  subtitle,
  description,
  back,
  onBack,
  progress,
  footer,
  children,
}: AuthScreenProps) {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);
  const sub = subtitle ?? description;

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  /* The two titles are inverses: as the large one leaves, the compact one
     arrives, crossing near the midpoint of the handoff. */
  const largeTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, TITLE_HANDOFF], [1, 0], Extrapolation.CLAMP),
  }));

  const compactTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [TITLE_HANDOFF * 0.6, TITLE_HANDOFF],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [TITLE_HANDOFF * 0.6, TITLE_HANDOFF],
          [6, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const barTop = Math.max(insets.top, 20);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
    >
      {/* Overlays the scroll view rather than sitting above it, so content
          passes under it and the title handoff has somewhere to land. */}
      <View
        pointerEvents="box-none"
        style={{ paddingTop: barTop }}
        className="absolute inset-x-0 top-0 z-10 flex-row items-center px-5 pb-2"
      >
        {back ? (
          <Pressable
            onPress={onBack ?? (() => router.back())}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="-ml-2 h-9 w-9 items-center justify-center rounded-full active:opacity-50"
          >
            <Icon
              name="chevron.left"
              android="chevron_left"
              size={22}
              weight="semibold"
              color={p.foreground}
            />
          </Pressable>
        ) : (
          <View className="h-9 w-9" />
        )}

        <Animated.View style={compactTitleStyle} className="flex-1 px-1">
          <Text type="body" weight="semibold" numberOfLines={1} className="text-foreground">
            {title}
          </Text>
        </Animated.View>

        {/* Balances the chevron so the compact title sits optically centered. */}
        <View className="h-9 w-9" />
      </View>

      <Animated.ScrollView
        className="flex-1"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerClassName="px-5"
        contentContainerStyle={{ paddingTop: barTop + 50, paddingBottom: 28 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {progress ? (
          <View className="mb-7">
            <FlowProgress position={progress} />
          </View>
        ) : null}

        <Animated.View style={largeTitleStyle} className="mb-7">
          <Text
            type="h2"
            className="text-foreground"
            /* Large type reads loose at default tracking — tighten as it grows
               and pull the leading in to match. */
            style={{ letterSpacing: -0.6, lineHeight: 38 }}
          >
            {title}
          </Text>
          {sub ? (
            <Text type="body-sm" color="muted" className="mt-2">
              {sub}
            </Text>
          ) : null}
        </Animated.View>

        {children}
      </Animated.ScrollView>

      {footer ? (
        <View
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          className="border-t border-border/60 bg-background px-5 pt-3"
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
