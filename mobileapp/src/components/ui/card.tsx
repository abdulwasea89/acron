import React from "react";
import { View, Text, ViewProps } from "@/tw";

interface CardProps extends ViewProps {
  title?: string;
  subtitle?: string;
}

export function Card({ title, subtitle, className = "", children, ...props }: CardProps) {
  return (
    <View
      className={`bg-white dark:bg-bg-dark-secondary rounded-2xl p-4
        border border-border dark:border-border-dark ${className}`}
      {...props}
    >
      {title && (
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          {title}
        </Text>
      )}
      {subtitle && (
        <Text className="text-sm text-muted mb-3">{subtitle}</Text>
      )}
      {children}
    </View>
  );
}
