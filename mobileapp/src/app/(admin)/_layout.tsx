import { Tabs } from "expo-router";
import type { TabSymbol } from "@/components/tab-icon";
import { tabScreenLayout, useTabIcon, useTabScreenOptions } from "@/components/tab-bar";
import { RequireAuth } from "@/components/auth-guard";

const SYMBOLS = {
  dashboard: { glyph: "home" },
  approvals: { glyph: "checkmark-circle" },
  gymStatus: { glyph: "storefront" },
  tasks: { glyph: "checkbox" },
  profile: { glyph: "person" },
} satisfies Record<string, TabSymbol>;

export default function AdminLayout() {
  const screenOptions = useTabScreenOptions();
  const icon = useTabIcon();

  return (
    <RequireAuth>
      <Tabs screenOptions={screenOptions} screenLayout={tabScreenLayout}>
        <Tabs.Screen
          name="dashboard"
          options={{ title: "Home", tabBarIcon: icon(SYMBOLS.dashboard) }}
        />
        <Tabs.Screen
          name="approvals"
          options={{ title: "Approve", tabBarIcon: icon(SYMBOLS.approvals) }}
        />
        <Tabs.Screen
          name="gym-status"
          options={{ title: "Status", tabBarIcon: icon(SYMBOLS.gymStatus) }}
        />
        <Tabs.Screen name="tasks" options={{ title: "Tasks", tabBarIcon: icon(SYMBOLS.tasks) }} />
        <Tabs.Screen
          name="profile"
          options={{ title: "Profile", tabBarIcon: icon(SYMBOLS.profile) }}
        />
      </Tabs>
    </RequireAuth>
  );
}
