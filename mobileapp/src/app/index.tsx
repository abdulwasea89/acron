import { View, Text, Pressable } from "@/tw";
import { router } from "expo-router";

export default function WelcomeScreen() {
  return (
    <View className="flex-1 bg-white dark:bg-bg-dark justify-center px-6">
      <View className="items-center mb-12">
        <Text className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Gym Ops
        </Text>
        <Text className="text-base text-muted text-center">
          Your gym. Your members. One platform.
        </Text>
      </View>

      <View className="gap-4">
        <Pressable
          className="bg-brand py-4 rounded-xl items-center active:opacity-80"
          onPress={() => router.push("/(auth)/register/step-1")}
        >
          <Text className="text-white font-semibold text-lg">Register My Gym</Text>
        </Pressable>

        <Pressable
          className="bg-white dark:bg-bg-dark-secondary py-4 rounded-xl items-center border border-border dark:border-border-dark active:opacity-80"
          onPress={() => router.push("/(auth)/register/org-code")}
        >
          <Text className="text-gray-900 dark:text-white font-semibold text-lg">
            Join an Existing Gym
          </Text>
        </Pressable>

        <Pressable
          className="py-4 items-center active:opacity-80"
          onPress={() => router.push("/(auth)/login")}
        >
          <Text className="text-brand font-semibold text-base">
            I already have an account
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
