import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";
import { Stagger } from "@/components/motion";
import { RedirectAuthedUser } from "@/components/auth-guard";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <>
      <RedirectAuthedUser />
      <View
        className="flex-1 bg-background px-6"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 24 }}
      >
      {/* Centered brand + tagline */}
      <View className="flex-1 items-center justify-center">
        <Stagger>
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-accent">
            <Text className="text-[30px] font-bold text-accent-foreground">G</Text>
          </View>
          <Text className="mt-5 text-[28px] font-bold tracking-tight text-foreground">
            Gym Ops
          </Text>
          <Text className="mt-2 text-center text-[15px] text-muted">
            Your gym. Your members. One platform.
          </Text>
        </Stagger>
      </View>

      {/* Actions */}
      <Stagger gap={60}>
        <View className="gap-3">
          <Button onPress={() => router.push("/(auth)/register/step-1")}>
            Register My Gym
          </Button>

          <Button variant="secondary" onPress={() => router.push("/(auth)/register/org-code")}>
            Join an Existing Gym
          </Button>

          <Pressable
            className="items-center py-3 active:opacity-60"
            onPress={() => router.push("/(auth)/login")}
          >
            <Text className="text-[14px] text-muted">
              Already have an account?{" "}
              <Text className="font-semibold text-foreground">Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </Stagger>
      </View>
    </>
  );
}