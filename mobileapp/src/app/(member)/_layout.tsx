import { Tabs } from "expo-router";
import type { TabSymbol } from "@/components/tab-icon";
import { tabScreenLayout, useTabIcon, useTabScreenOptions } from "@/components/tab-bar";

const SYMBOLS = {
  dashboard: { glyph: "house" },
  classes: { glyph: "dumbbell" },
  payments: { glyph: "credit-card" },
  profile: { glyph: "person" },
} satisfies Record<string, TabSymbol>;

export default function MemberLayout() {
  const screenOptions = useTabScreenOptions();
  const icon = useTabIcon();

  return (
    <Tabs screenOptions={screenOptions} screenLayout={tabScreenLayout}>
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Home", tabBarIcon: icon(SYMBOLS.dashboard) }}
      />
      <Tabs.Screen
        name="classes"
        options={{ title: "Classes", tabBarIcon: icon(SYMBOLS.classes) }}
      />
      <Tabs.Screen
        name="payments"
        options={{ title: "Payments", tabBarIcon: icon(SYMBOLS.payments) }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: icon(SYMBOLS.profile) }}
      />
    </Tabs>
  );
}
