import React from "react";
import { View } from "react-native";
import { Text } from "heroui-native";

import { Button } from "@/components/ui/button";

interface DashboardErrorProps {
  message?: string;
  onRetry?: () => void;
}

/** Compact inline error card for a failed dashboard request. */
export function DashboardError({ message, onRetry }: DashboardErrorProps) {
  return (
    <View className="rounded-2xl bg-surface-secondary p-5">
      <Text type="body" weight="semibold" className="text-foreground">
        Couldn’t load this page
      </Text>
      {message ? (
        <Text type="body-sm" color="muted" className="mt-1">
          {message}
        </Text>
      ) : null}
      {onRetry ? (
        <View className="mt-4">
          <Button variant="secondary" onPress={onRetry}>
            Try again
          </Button>
        </View>
      ) : null}
    </View>
  );
}