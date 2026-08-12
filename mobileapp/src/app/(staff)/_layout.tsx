import { Tabs } from "expo-router";
import type { TabSymbol } from "@/components/tab-icon";
import { tabScreenLayout, useTabIcon, useTabScreenOptions } from "@/components/tab-bar";

const SYMBOLS = {
  dashboard: { glyph: "house" },
  shift: { glyph: "clock" },
  cashLog: { glyph: "banknote" },
  receipts: { glyph: "receipt" },
  profile: { glyph: "person" },
} satisfies Record<string, TabSymbol>;

export default function StaffLayout() {
  const screenOptions = useTabScreenOptions();
  const icon = useTabIcon();

  return (
    <Tabs screenOptions={screenOptions} screenLayout={tabScreenLayout}>
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Home", tabBarIcon: icon(SYMBOLS.dashboard) }}
      />
      <Tabs.Screen name="shift" options={{ title: "Shift", tabBarIcon: icon(SYMBOLS.shift) }} />
      <Tabs.Screen name="cash-log" options={{ title: "Cash", tabBarIcon: icon(SYMBOLS.cashLog) }} />
      <Tabs.Screen
        name="receipts"
        options={{ title: "Receipts", tabBarIcon: icon(SYMBOLS.receipts) }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: icon(SYMBOLS.profile) }}
      />
    </Tabs>
  );
}
