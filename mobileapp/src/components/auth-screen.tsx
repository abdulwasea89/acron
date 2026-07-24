import React from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ScrollView, View, Text, Pressable } from "@/tw";

interface AuthScreenProps {
  title: string;
  /** Muted supporting line under the title. */
  subtitle?: string;
  /** Alias for subtitle (back-compat). */
  description?: string;
  /** Deprecated: small uppercase label — dropped for a native app feel. */
  eyebrow?: string;
  /** Show a back chevron in the top bar. */
  back?: boolean;
  onBack?: () => void;
  /** Footer pinned to the bottom of the scroll content. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Standard mobile auth screen: a safe-area-aware scroll view with a compact
 * native header (back chevron + bold sans-serif title + muted subtitle).
 * Monochrome to match the product, but sized and spaced like an app — not a
 * marketing page. Fixes the old status-bar collision from hard-coded padding.
 */
export function AuthScreen({
  title,
  subtitle,
  description,
  back,
  onBack,
  footer,
  children,
}: AuthScreenProps) {
  const insets = useSafeAreaInsets();
  const sub = subtitle ?? description;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-bg dark:bg-bg-dark"
    >
      {/* Fixed top bar with back button */}
      <View
        style={{ paddingTop: insets.top + 8 }}
        className="px-5 pb-2 flex-row items-center"
      >
        {back && (
          <Pressable
            onPress={onBack ?? (() => router.back())}
            hitSlop={12}
            className="w-9 h-9 -ml-1 rounded-full items-center justify-center active:bg-bg-secondary dark:active:bg-surface-dark-2"
          >
            <Text className="text-[22px] leading-[22px] text-ink dark:text-paper">‹</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 flex-grow"
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-6 mt-2">
          <Text className="text-[26px] font-bold text-ink dark:text-paper tracking-tight">
            {title}
          </Text>
          {sub && (
            <Text className="text-[14px] leading-[20px] text-muted dark:text-muted-dark mt-1.5">
              {sub}
            </Text>
          )}
        </View>

        {children}

        {footer && <View className="mt-auto pt-6">{footer}</View>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
