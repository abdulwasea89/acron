import { Tabs } from "expo-router";
import type { TabSymbol } from "@/components/tab-icon";
import { tabScreenLayout, useTabIcon, useTabScreenOptions } from "@/components/tab-bar";
import { RequireAuth } from "@/components/auth-guard";

const SYMBOLS = {
  dashboard: { glyph: "home" },
  shift: { glyph: "time" },
  cashLog: { glyph: "cash" },
  receipts: { glyph: "receipt" },
  profile: { glyph: "person" },
} satisfies Record<string, TabSymbol>;

export default function StaffLayout() {
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
        <Tabs.Screen name="shift" options={{ title: "Shift", tabBarIcon: icon(SYMBOLS.shift) }} unmount={false} />
        <Tabs.Screen name="cash-log" options={{ title: "Cash", tabBarIcon: icon(SYMBOLS.cashLog) }} unmount={false} />
        <Tabs.Screen
          name="receipts"
          options={{ title: "Receipts", tabBarIcon: icon(SYMBOLS.receipts) }}
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
