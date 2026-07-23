import React from "react";
import { View, Text } from "@/tw";
import { ActivityIndicator, useColorScheme } from "react-native";

interface SpinnerProps {
  message?: string;
}

export function Spinner({ message }: SpinnerProps) {
  const isDark = useColorScheme() === "dark";

  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-bg-dark">
      <ActivityIndicator size="large" color={isDark ? "#fff" : "#208AEF"} />
      {message && (
        <Text className="mt-3 text-sm text-muted">{message}</Text>
      )}
    </View>
  );
}
