import { Tabs } from "expo-router";
import type { TabSymbol } from "@/components/tab-icon";
import { tabScreenLayout, useTabIcon, useTabScreenOptions } from "@/components/tab-bar";

const SYMBOLS = {
  dashboard: { sf: "square.grid.2x2", sfActive: "square.grid.2x2.fill", md: "grid_view" },
  approvals: { sf: "checkmark.seal", sfActive: "checkmark.seal.fill", md: "verified_user" },
  gymStatus: { sf: "storefront", sfActive: "storefront.fill", md: "storefront" },
  tasks: { sf: "checklist", sfActive: "checklist.checked", md: "task_alt" },
  profile: { sf: "person", sfActive: "person.fill", md: "person" },
} satisfies Record<string, TabSymbol>;

export default function AdminLayout() {
  const screenOptions = useTabScreenOptions();
  const icon = useTabIcon();

  return (
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
  );
}
