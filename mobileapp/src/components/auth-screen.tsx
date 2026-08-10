import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button, Text } from "heroui-native";
import { SymbolView } from "expo-symbols";

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
 * native header (back chevron + bold title + muted subtitle). Monochrome to
 * match the product, but sized and spaced like an app — not a marketing page.
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
      className="flex-1 bg-background"
    >
      {/* Fixed top bar with back button */}
      <View
        style={{ paddingTop: insets.top + 8 }}
        className="px-5 pb-2 flex-row items-center"
      >
        {back && (
          <Button
            variant="ghost"
            size="sm"
            isIconOnly
            onPress={onBack ?? (() => router.back())}
            className="-ml-2"
          >
            <SymbolView
              name={{
                ios: "chevron.left",
                android: "chevron_left",
                web: "chevron_left",
              }}
              size={20}
              weight="semibold"
              className="text-foreground"
            />
          </Button>
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
          <Text className="text-[26px] font-bold text-foreground tracking-tight">
            {title}
          </Text>
          {sub && (
            <Text className="text-[14px] leading-[20px] text-muted mt-1.5">
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
