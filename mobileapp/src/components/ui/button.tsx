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

/*
  Monochrome, matching the web portal. The primary action is INVERTED:
  near-black button in light mode, off-white button in dark mode — the
  same signature as the web "Sign in" button.
*/
const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-ink dark:bg-paper active:bg-ink-soft dark:active:bg-paper-soft",
  secondary:
    "bg-transparent border border-border-strong dark:border-border-strong-dark active:bg-bg-secondary dark:active:bg-surface-dark-2",
  danger: "bg-danger dark:bg-danger-dark active:opacity-90",
  ghost: "bg-transparent active:opacity-60",
};

const textStyles: Record<ButtonVariant, string> = {
  primary: "text-paper dark:text-ink",
  secondary: "text-ink dark:text-paper",
  danger: "text-white",
  ghost: "text-ink dark:text-paper",
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

  // Spinner color inverts with the primary button.
  const spinnerColor =
    variant === "primary"
      ? isDark
        ? "#0a0a0a"
        : "#fafafa"
      : variant === "danger"
        ? "#fff"
        : isDark
          ? "#fafafa"
          : "#0a0a0a";

  return (
    <Pressable
      className={`py-3.5 px-6 rounded-xl items-center justify-center flex-row
        ${variantStyles[variant]}
        ${disabled ? "opacity-40" : ""}
        ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text className={`font-semibold text-[15px] tracking-wide ${textStyles[variant]}`}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}
