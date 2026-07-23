import React from "react";
import { View, Text } from "@/tw";

type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

interface BadgeProps {
  tone?: BadgeTone;
  label: string;
}

const toneStyles: Record<BadgeTone, string> = {
  success: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  warning: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
  danger: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  info: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  neutral: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
};

export function Badge({ tone = "neutral", label }: BadgeProps) {
  return (
    <View className={`px-2.5 py-1 rounded-full ${toneStyles[tone]}`}>
      <Text className="text-xs font-medium">{label}</Text>
    </View>
  );
}
