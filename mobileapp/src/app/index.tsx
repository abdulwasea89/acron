import { View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "heroui-native";
import { router } from "expo-router";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useReducedMotion,
} from "react-native-reanimated";

import { AmbientBackground } from "@/components/ambient-background";
import { Button } from "@/components/ui/button";
import { PressableScale } from "@/components/motion";
import { RedirectAuthedUser } from "@/components/auth-guard";
import { getPalette, spring } from "@/lib/theme";

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
  const p = getPalette(useColorScheme() === "dark");
  const reducedMotion = useReducedMotion();

  /* Content settles downward in sequence. Reduced motion keeps the sequencing
     but drops the travel, so the order still reads without the movement. */
  const enter = (delay: number) =>
    reducedMotion
      ? FadeIn.delay(delay).duration(240)
      : FadeInDown.delay(delay)
          .duration(420)
          .springify()
          .damping(spring.standard.damping)
          .stiffness(spring.standard.stiffness);

  /* The actions rise from the thumb zone while the message settles from the
     top — motion hints at where each thing lives. */
  const enterUp = (delay: number) =>
    reducedMotion
      ? FadeIn.delay(delay).duration(240)
      : FadeInUp.delay(delay)
          .duration(420)
          .springify()
          .damping(spring.standard.damping)
          .stiffness(spring.standard.stiffness);

  return (
    <>
      <RedirectAuthedUser />
      <View
        className="flex-1 bg-background px-6"
        style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }}
      >
        <AmbientBackground />

{/* Wordmark — the one piece of brand, set in Saira ExtraBold. Saira is a
            geometric sans with a wide, athletic stance, so it takes a little
            tracking without losing its shape. */}
        <Animated.View entering={enter(60)} className="items-center">
          <Text
            style={{
              fontFamily: "Saira",
              fontSize: 20,
              letterSpacing: 3,
              color: p.foreground,
            }}
          >
            ACRON
          </Text>
        </Animated.View>

        <View className="flex-1 justify-center">
          <Animated.View entering={enter(140)}>
            <Text
              type="h1"
              className="text-foreground"
              style={{ letterSpacing: -1, lineHeight: 44 }}
            >
              Run your gym{"\n"}
              <Text style={{ color: "#5780c2" }}>from anywhere.</Text>
            </Text>
          </Animated.View>

          <Animated.View entering={enter(220)}>
            <Text type="body" color="muted" className="mt-3.5 pr-4">
              Members, payments, payroll, and check-ins in one place, synced across every
              device.
            </Text>
          </Animated.View>
        </View>

        <Animated.View entering={enterUp(380)} className="gap-3">
          <Button onPress={() => router.push("/(auth)/register/step-1")}>
            Register my gym
          </Button>

          <Button variant="secondary" onPress={() => router.push("/(auth)/register/org-code")}>
            Join a gym
          </Button>

          <PressableScale
            scale={0.98}
            onPress={() => router.push("/(auth)/login")}
            hitSlop={8}
            style={{ alignItems: "center", paddingVertical: 12 }}
          >
            <Text type="body-sm" color="muted">
              Already have an account?{" "}
              <Text className="font-semibold text-accent">Sign in</Text>
            </Text>
          </PressableScale>
        </Animated.View>
      </View>
    </>
  );
}