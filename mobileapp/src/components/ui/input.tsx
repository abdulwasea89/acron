import React, { forwardRef } from "react";
import { useColorScheme } from "react-native";
import { TextInput, Text, View, TextInputProps } from "@/tw";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

/*
  Filled, low-contrast inputs matching the web portal: a soft gray fill
  (#f6f7f9 light / #141414 dark) with a hairline border. Label is a small
  medium-weight caption. No blue anywhere.
*/
export const Input = forwardRef<typeof TextInput, InputProps>(
  ({ label, error, hint, className = "", ...props }, ref) => {
    const isDark = useColorScheme() === "dark";
    return (
      <View className="gap-2">
        {label && (
          <Text className="text-[13px] font-semibold text-ink dark:text-paper">
            {label}
          </Text>
        )}
        <TextInput
          ref={ref as any}
          className={`border rounded-xl px-4 py-3.5 text-[15px]
            ${error
              ? "border-danger dark:border-danger-dark"
              : "border-border dark:border-border-dark"}
            bg-bg-secondary dark:bg-surface-dark-2
            text-ink dark:text-paper
            ${className}`}
          placeholderTextColor={isDark ? "#6e6e6e" : "#94a3b8"}
          {...props}
        />
        {error ? (
          <Text className="text-[12px] text-danger dark:text-danger-dark">{error}</Text>
        ) : hint ? (
          <Text className="text-[12px] text-muted dark:text-muted-dark">{hint}</Text>
        ) : null}
      </View>
    );
  },
);

Input.displayName = "Input";
