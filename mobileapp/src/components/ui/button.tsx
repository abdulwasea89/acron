import React from "react";
import { Pressable, Text, PressableProps } from "@/tw";
import { ActivityIndicator } from "react-native";
import { useColorScheme } from "react-native";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends PressableProps {
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-brand active:bg-brand-dark",
  secondary: "bg-white dark:bg-bg-dark-secondary border border-border dark:border-border-dark",
  danger: "bg-danger active:bg-red-600",
  ghost: "bg-transparent",
};

const textStyles: Record<ButtonVariant, string> = {
  primary: "text-white",
  secondary: "text-gray-900 dark:text-white",
  danger: "text-white",
  ghost: "text-brand",
};

export function Button({
  variant = "primary",
  loading = false,
  disabled = false,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const isDark = useColorScheme() === "dark";

  return (
    <Pressable
      className={`py-4 px-6 rounded-xl items-center justify-center flex-row
        ${variantStyles[variant]}
        ${disabled ? "opacity-50" : ""}
        ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? (isDark ? "#fff" : "#111") : "#fff"} />
      ) : (
        <Text className={`font-semibold text-lg ${textStyles[variant]}`}>{children}</Text>
      )}
    </Pressable>
  );
}
