import type { ReactNode } from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuthStore, type UserRole } from "@/stores/auth-store";

/**
 * Route a role to its primary dashboard. Mirrors the post-login routing in
 * `(auth)/login.tsx` so a persisted session lands in the same place.
 */
export type DashboardRoute = "/(staff)/dashboard" | "/(admin)/dashboard" | "/(member)/dashboard";

export function routeForRole(role: UserRole | undefined | null): DashboardRoute {
  if (role === "trainer" || role === "front_desk") return "/(staff)/dashboard";
  if (role === "owner" || role === "manager") return "/(admin)/dashboard";
  return "/(member)/dashboard";
}

/**
 * Guard for the authenticated tab groups (member / staff / admin).
 *
 * - Before the persisted session has rehydrated, render nothing (splash is
 *   still up, so this is invisible).
 * - If there's no access token afterwards, bounce to the login screen.
 * - Otherwise render the children.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (!isHydrated || isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (!accessToken) {
    return <Redirect href="/(auth)/login" />;
  }

  return <>{children}</>;
}

/**
 * Guard for the welcome screen (`/`): a hydrated session should never sit on
 * the "Register / Join / Sign in" landing. Bounces straight to the dashboard.
 */
export function RedirectAuthedUser() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  if (!isHydrated || !accessToken || !user) return null;

  return <Redirect href={routeForRole(user.role)} />;
}
