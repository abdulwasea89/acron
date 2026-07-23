import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "react-native";

import { useAuthStore } from "@/stores/auth-store";
import { useOrgStore } from "@/stores/org-store";
import { api } from "@/lib/api";
import { cleanupStaleKeys } from "@/lib/idempotency";
import type { OrgSummaryResponse } from "@/types/api";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const { isHydrated, isLoading, clearSession, setSession } = useAuthStore();
  const { setOrgs, setActiveOrg } = useOrgStore();

  useEffect(() => {
    if (!isHydrated || isLoading) return;

    const init = async () => {
      try {
        cleanupStaleKeys();
        const orgs = await api.get<OrgSummaryResponse[]>("/auth/my-organizations");
        setOrgs(orgs as any);
        if (orgs.length > 0) {
          setActiveOrg(orgs[0] as any);
        }
      } catch {
        // Not authenticated or network error — fine
      } finally {
        SplashScreen.hideAsync();
      }
    };
    init();
  }, [isHydrated, isLoading]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(member)" />
        <Stack.Screen name="(staff)" />
        <Stack.Screen name="(admin)" />
      </Stack>
    </>
  );
}
