import React from "react";
import { View, Text, ViewProps } from "@/tw";

interface CardProps extends ViewProps {
  title?: string;
  subtitle?: string;
}

export function Card({ title, subtitle, className = "", children, ...props }: CardProps) {
  return (
    <View
      className={`bg-bg dark:bg-bg-dark-secondary rounded-2xl p-5
        border border-border dark:border-border-dark ${className}`}
      {...props}
    >
      {title && (
        <Text className="text-[16px] font-semibold text-ink dark:text-paper mb-1">
          {title}
        </Text>
      )}
      {subtitle && (
        <Text className="text-[13px] text-muted dark:text-muted-dark mb-3">{subtitle}</Text>
      )}
      {children}
    </View>
  );
}
