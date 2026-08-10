import React from "react";
import { View, ScrollView } from "react-native";
import type { RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "heroui-native";

interface AppScreenProps {
  /** Bold screen title. */
  title?: string;
  /** Muted supporting line under the title. */
  subtitle?: string;
  /** Header actions rendered on the right of the title row. */
  headerRight?: React.ReactNode;
  /** Fixed footer pinned to the bottom of the scroll content. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Disable bottom content inset padding (used when a sticky footer exists). */
  noBottomInset?: boolean;
  refreshControl?: React.ReactElement<React.ComponentProps<typeof RefreshControl>>;
}

/**
 * Standard in-app screen: safe-area-aware scroll view with a native header
 * (bold title + optional subtitle + trailing actions). Uses HeroUI semantic
 * tokens, so light/dark theming is automatic.
 */
export function AppScreen({
  title,
  subtitle,
  headerRight,
  footer,
  children,
  noBottomInset,
  refreshControl,
}: AppScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5"
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: noBottomInset ? 0 : insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {(title || headerRight) && (
          <View className="mb-4 flex-row items-start justify-between gap-3">
            <View className="flex-1">
              {title && (
                <Text type="h2" className="text-foreground tracking-tight">
                  {title}
                </Text>
              )}
              {subtitle && (
                <Text type="body-sm" color="muted" className="mt-1">
                  {subtitle}
                </Text>
              )}
            </View>
            {headerRight && <View className="flex-row items-center gap-2 pt-1">{headerRight}</View>}
          </View>
        )}

        {children}

        {footer && <View className="mt-auto pt-6">{footer}</View>}
      </ScrollView>
    </View>
  );
}
