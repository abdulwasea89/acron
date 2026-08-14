import React from "react";
import { Pressable, View, useColorScheme } from "react-native";
import { Text } from "heroui-native";
import { router } from "expo-router";

import { Icon } from "@/components/icon";
import { getPalette } from "@/lib/theme";
import { useNotificationStore } from "@/stores/notification-store";

/**
 * Top-right bell that opens the notifications feed. Rendered by `AppScreen` on
 * every in-app screen. The unread badge reads the live store, which is seeded
 * from the API at launch and bumped by the WebSocket client.
 *
 * Deliberately a plain `Pressable`, not a HeroUI `Button`: on Android the
 * button's animated press-feedback surface can render a stuck translucent disc
 * (Reanimated mismatch), and an explicit transparent background guarantees a
 * clean circular hit target on every platform.
 */
export function NotificationBell() {
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const accent = getPalette(useColorScheme() === "dark").accent;

  return (
    <View className="relative">
      <Pressable
        onPress={() => router.push("/notifications")}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        hitSlop={6}
        style={({ pressed }) => [
          {
            width: 40,
            height: 40,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 9999,
            backgroundColor: "transparent",
            opacity: pressed ? 0.6 : 1,
          },
        ]}
      >
        <Icon name="bell.fill" android="bell_fill" size={20} color={accent} />
      </Pressable>

      {unreadCount > 0 ? (
        <View className="absolute -right-0.5 -top-0.5 min-w-[18px] items-center justify-center rounded-full bg-danger px-1 py-0.5">
          <Text className="text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
