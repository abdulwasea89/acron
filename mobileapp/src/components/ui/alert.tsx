import React from "react";
import { View, Text, Pressable } from "@/tw";

type AlertType = "success" | "error" | "info" | "warning";

interface AlertProps {
  type?: AlertType;
  message: string;
  onDismiss?: () => void;
}

const typeStyles: Record<AlertType, string> = {
  success: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
  error: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
  info: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
  warning: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
};

const textStyles: Record<AlertType, string> = {
  success: "text-green-800 dark:text-green-300",
  error: "text-red-800 dark:text-red-300",
  info: "text-blue-800 dark:text-blue-300",
  warning: "text-yellow-800 dark:text-yellow-300",
};

export function Alert({ type = "info", message, onDismiss }: AlertProps) {
  return (
    <View className={`flex-row items-center px-4 py-3 rounded-xl border ${typeStyles[type]}`}>
      <Text className={`flex-1 text-sm ${textStyles[type]}`}>{message}</Text>
      {onDismiss && (
        <Pressable onPress={onDismiss} className="ml-2 p-1">
          <Text className={textStyles[type]}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}
