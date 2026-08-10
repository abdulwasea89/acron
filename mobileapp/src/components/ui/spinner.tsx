import React from "react";
import { View } from "react-native";
import { Spinner as HSpinner, Text } from "heroui-native";

interface SpinnerProps {
  message?: string;
}

/**
 * Full-screen loading state. For an inline spinner use HeroUI's `Spinner`
 * directly — this one claims the whole viewport and paints the background.
 */
export function Spinner({ message }: SpinnerProps) {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <HSpinner size="lg" color="foreground" />
      {message && (
        <Text className="mt-3 text-[13px] text-muted">{message}</Text>
      )}
    </View>
  );
}
