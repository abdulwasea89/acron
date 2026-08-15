import React from "react";
import { Pressable, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "heroui-native";
import { router } from "expo-router";

import { useTabBarInset } from "@/components/tab-bar";
import { NotificationBell } from "@/components/notification-bell";
import { Icon } from "@/components/icon";

interface AppScreenProps {
  /** Bold screen title. */
  title?: string;
  /** Muted supporting line under the title. */
  subtitle?: string;
  /** Header actions rendered on the right of the title row. */
  headerRight?: React.ReactNode;
  /** Hide the notifications bell (e.g. on the notifications screen itself). */
  showNotifications?: boolean;
  /** Adds a visible in-app back affordance for stack screens. */
  showBackButton?: boolean;
  /** Dashboard headers separate the page title from utility actions. */
  headerVariant?: "default" | "dashboard";
  /** Fixed footer pinned to the bottom of the scroll content. */
  footer?: React.ReactNode;
  /** Floating action pinned above the tab bar at the bottom-right. */
  fab?: React.ReactNode;
  children: React.ReactNode;
  /** Disable bottom content inset padding (used when a sticky footer exists). */
  noBottomInset?: boolean;
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
  showNotifications = true,
  showBackButton = false,
  headerVariant = "default",
  footer,
  fab,
  children,
  noBottomInset,
}: AppScreenProps) {
  const insets = useSafeAreaInsets();
  // The tab bar floats over the content, so it already covers the bottom inset.
  const tabBarInset = useTabBarInset();
  const bottomInset = tabBarInset || insets.bottom;

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5"
        contentContainerStyle={{
          paddingTop: Math.max(insets.top, 24) + 28,
          paddingBottom: noBottomInset ? 0 : bottomInset + 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {(title || headerRight || showNotifications || showBackButton) &&
          (headerVariant === "dashboard" ? (
            <View className="mb-7">
              <View className="mb-5 flex-row items-center justify-between">
                <OrganizationIdentity name={subtitle || "Your gym"} />
                {(showNotifications || headerRight) && (
                  <View className="flex-row items-center gap-2">
                    {showNotifications ? <NotificationBell /> : null}
                    {headerRight}
                  </View>
                )}
              </View>
              {title ? (
                <Text
                  type="h1"
                  className="text-foreground tracking-tight"
                  style={{ fontSize: 30, lineHeight: 37, letterSpacing: -0.8 }}
                >
                  {title}
                </Text>
              ) : null}
            </View>
          ) : (
            <View className="mb-5 flex-row items-center gap-3">
              {showBackButton ? <HeaderBackButton /> : null}
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
              {(showNotifications || headerRight) && (
                <View className="flex-row items-center gap-2">
                  {showNotifications ? <NotificationBell /> : null}
                  {headerRight}
                </View>
              )}
            </View>
          ))}

        {children}

        {footer && <View className="mt-auto pt-6">{footer}</View>}
      </ScrollView>

      {fab ? (
        <View className="absolute right-5" style={{ bottom: bottomInset + 12 }}>
          {fab}
        </View>
      ) : null}
    </View>
  );
}

function OrganizationIdentity({ name }: { name: string }) {
  const cleanName = name.trim() || "Your gym";
  const displayName = cleanName === cleanName.toLowerCase()
    ? `${cleanName.charAt(0).toUpperCase()}${cleanName.slice(1)}`
    : cleanName;

  return (
    <View className="min-w-0 flex-1 flex-row items-center gap-2.5 pr-4">
      <Text
        type="body"
        weight="semibold"
        className="flex-1 text-foreground"
        numberOfLines={1}
        style={{ fontSize: 16, lineHeight: 21, letterSpacing: 0.7, textTransform: "uppercase" }}
      >
        {displayName}
      </Text>
    </View>
  );
}

function HeaderBackButton() {
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
      className="h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-secondary"
      style={({ pressed }) => ({ opacity: pressed ? 0.62 : 1 })}
    >
      <Icon name="chevron.left" android="chevron_left" size={20} className="text-foreground" weight="semibold" />
    </Pressable>
  );
}
