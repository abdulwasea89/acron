import "@/global.css";

import { useEffect, useMemo } from "react";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { HeroUINativeProvider } from "heroui-native";

import { useAuthStore } from "@/stores/auth-store";
import { useOrgStore } from "@/stores/org-store";
import { api } from "@/lib/api";
import { cleanupStaleKeys } from "@/lib/idempotency";
import { BlurTargetProvider } from "@/components/blur-target";
import { getPalette } from "@/lib/theme";
import type { OrgSummaryResponse } from "@/types/api";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const palette = getPalette(isDark);

  const { isHydrated, isLoading, clearSession, setSession } = useAuthStore();
  const { setOrgs, setActiveOrg } = useOrgStore();

  /**
   * React Navigation paints every screen with its own theme background before
   * our views mount. Its default is a light gray regardless of color scheme, so
   * without this the app flashes — and shows — white behind HeroUI's dark
   * surfaces. Same reason for the system window color underneath.
   */
  const navTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: palette.background,
        card: palette.surface,
        text: palette.foreground,
        border: palette.border,
        primary: palette.accent,
      },
    };
  }, [isDark, palette]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(palette.background);
  }, [palette.background]);

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
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.background }}>
      <HeroUINativeProvider>
        <SafeAreaProvider>
          <ThemeProvider value={navTheme}>
            <BlurTargetProvider>
              <StatusBar style={isDark ? "light" : "dark"} />
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: "slide_from_right",
                  contentStyle: { backgroundColor: palette.background },
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(member)" />
                <Stack.Screen name="(staff)" />
                <Stack.Screen name="(admin)" />
              </Stack>
            </BlurTargetProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
