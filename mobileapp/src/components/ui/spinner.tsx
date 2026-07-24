import React from "react";
import { View, Text } from "@/tw";
import { ActivityIndicator, useColorScheme } from "react-native";

interface SpinnerProps {
  message?: string;
}

export function Spinner({ message }: SpinnerProps) {
  const isDark = useColorScheme() === "dark";

  return (
    <View className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark">
      <ActivityIndicator size="large" color={isDark ? "#fafafa" : "#0a0a0a"} />
      {message && (
        <Text className="mt-3 text-[13px] text-muted dark:text-muted-dark">{message}</Text>
      )}
    </View>
  );
}
