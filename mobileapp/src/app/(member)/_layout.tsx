import { Tabs } from "expo-router";
import type { TabSymbol } from "@/components/tab-icon";
import { tabScreenLayout, useTabIcon, useTabScreenOptions } from "@/components/tab-bar";
import { RequireAuth } from "@/components/auth-guard";

const SYMBOLS = {
  dashboard: { glyph: "home" },
  classes: { glyph: "barbell" },
  payments: { glyph: "card" },
  profile: { glyph: "person" },
} satisfies Record<string, TabSymbol>;

export default function MemberLayout() {
  const screenOptions = useTabScreenOptions();
  const icon = useTabIcon();

  return (
    <RequireAuth>
      <Tabs screenOptions={screenOptions} screenLayout={tabScreenLayout}>
        <Tabs.Screen
          name="dashboard"
          options={{ title: "Home", tabBarIcon: icon(SYMBOLS.dashboard) }}
          unmount={false}
        />
        <Tabs.Screen
          name="classes"
          options={{ title: "Classes", tabBarIcon: icon(SYMBOLS.classes) }}
          unmount={false}
        />
        <Tabs.Screen
          name="payments"
          options={{ title: "Payments", tabBarIcon: icon(SYMBOLS.payments) }}
          unmount={false}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: "Profile", tabBarIcon: icon(SYMBOLS.profile) }}
          unmount={false}
        />
      </Tabs>
    </RequireAuth>
  );
}
