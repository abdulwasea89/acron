import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, Text, Pressable } from "@/tw";
import { router } from "expo-router";
import { Button } from "@/components/ui/button";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-1 bg-bg dark:bg-bg-dark px-6"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 24 }}
    >
      {/* Centered brand + tagline */}
      <View className="flex-1 items-center justify-center">
        <View className="w-16 h-16 rounded-2xl bg-ink dark:bg-paper items-center justify-center mb-5">
          <Text className="text-[30px] font-bold text-paper dark:text-ink">G</Text>
        </View>
        <Text className="text-[28px] font-bold text-ink dark:text-paper tracking-tight">
          Gym Ops
        </Text>
        <Text className="text-[15px] text-muted dark:text-muted-dark mt-2 text-center">
          Your gym. Your members. One platform.
        </Text>
      </View>

      {/* Actions */}
      <View className="gap-3">
        <Button onPress={() => router.push("/(auth)/register/step-1")}>
          Register My Gym
        </Button>

        <Button variant="secondary" onPress={() => router.push("/(auth)/register/org-code")}>
          Join an Existing Gym
        </Button>

        <Pressable
          className="py-3 items-center active:opacity-60"
          onPress={() => router.push("/(auth)/login")}
        >
          <Text className="text-[14px] text-muted dark:text-muted-dark">
            Already have an account?{" "}
            <Text className="font-semibold text-ink dark:text-paper">Sign in</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
