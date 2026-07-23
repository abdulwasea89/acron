import React, { forwardRef } from "react";
import { TextInput, Text, View, TextInputProps } from "@/tw";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input = forwardRef<typeof TextInput, InputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <View className="gap-1.5">
        {label && (
          <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </Text>
        )}
        <TextInput
          ref={ref as any}
          className={`border ${error ? "border-danger" : "border-border dark:border-border-dark"}
            bg-white dark:bg-bg-dark-secondary rounded-xl px-4 py-3.5
            text-gray-900 dark:text-white text-base
            ${className}`}
          placeholderTextColor="#9ca3af"
          {...props}
        />
        {error && (
          <Text className="text-sm text-danger">{error}</Text>
        )}
      </View>
    );
  },
);

Input.displayName = "Input";
