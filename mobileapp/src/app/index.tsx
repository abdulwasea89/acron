import { Pressable, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "heroui-native";
import { router } from "expo-router";
import Animated, { FadeIn, FadeInDown, useReducedMotion } from "react-native-reanimated";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { RedirectAuthedUser } from "@/components/auth-guard";
import { getPalette } from "@/lib/theme";

/**
 * The first screen anyone sees.
 *
 * Two paths, phrased as the two things people arrive wanting to do — run a gym
 * or attend one — with sign-in kept quieter beneath them. Someone who already
 * has an account is redirected past this screen entirely, so the returning-user
 * case doesn't need to compete for the top slot.
 */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);
  const reducedMotion = useReducedMotion();

  /* Content settles downward in sequence. Reduced motion keeps the sequencing
     but drops the travel, so the order still reads without the movement. */
  const enter = (delay: number) =>
    reducedMotion
      ? FadeIn.delay(delay).duration(240)
      : FadeInDown.delay(delay).duration(420).springify().damping(20).stiffness(180);

  return (
    <>
      <RedirectAuthedUser />
      <View
        className="flex-1 bg-background px-6"
        style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }}
      >
        <View className="flex-1 justify-center">
          <Animated.View entering={enter(60)}>
            <View
              className="h-16 w-16 items-center justify-center rounded-3xl"
              style={{ backgroundColor: p.accent }}
            >
              <Icon
                name="figure.strengthtraining.traditional"
                android="fitness_center"
                size={30}
                color="#ffffff"
              />
            </View>
          </Animated.View>

          <Animated.View entering={enter(140)}>
            <Text
              type="h1"
              className="mt-7 text-foreground"
              style={{ letterSpacing: -1, lineHeight: 44 }}
            >
              Run your gym{"\n"}from anywhere.
            </Text>
          </Animated.View>

          <Animated.View entering={enter(220)}>
            <Text type="body" color="muted" className="mt-3.5 pr-4">
              Members, payments, payroll, and check-ins — in one place, synced across every
              device.
            </Text>
          </Animated.View>
        </View>

        <Animated.View entering={enter(300)} className="gap-3">
          <Button onPress={() => router.push("/(auth)/register/step-1")}>
            Register my gym
          </Button>

          <Button variant="secondary" onPress={() => router.push("/(auth)/register/org-code")}>
            Join a gym
          </Button>

          <Pressable
            onPress={() => router.push("/(auth)/login")}
            hitSlop={8}
            className="items-center py-3 active:opacity-60"
          >
            <Text type="body-sm" color="muted">
              Already have an account?{" "}
              <Text className="font-semibold text-accent">Sign in</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </>
  );
}
