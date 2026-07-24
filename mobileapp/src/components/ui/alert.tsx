import React from "react";
import { View, Text, Pressable } from "@/tw";

type AlertType = "success" | "error" | "info" | "warning";

interface AlertProps {
  type?: AlertType;
  message: string;
  onDismiss?: () => void;
}

/* Muted semantic tints matching the web portal — soft backgrounds, no neon. */
const typeStyles: Record<AlertType, string> = {
  success: "bg-success/10 border-success/25",
  error: "bg-danger/10 border-danger/25",
  info: "bg-ink/[0.04] dark:bg-paper/[0.06] border-border dark:border-border-dark",
  warning: "bg-warning/10 border-warning/25",
};

const textStyles: Record<AlertType, string> = {
  success: "text-success dark:text-success-dark",
  error: "text-danger dark:text-danger-dark",
  info: "text-ink dark:text-paper",
  warning: "text-warning dark:text-warning-dark",
};

export function Alert({ type = "info", message, onDismiss }: AlertProps) {
  return (
    <View className={`flex-row items-center px-4 py-3 rounded-xl border ${typeStyles[type]}`}>
      <Text className={`flex-1 text-[13px] leading-[19px] ${textStyles[type]}`}>{message}</Text>
      {onDismiss && (
        <Pressable onPress={onDismiss} hitSlop={8} className="ml-3 active:opacity-60">
          <Text className={`text-[13px] ${textStyles[type]}`}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}
