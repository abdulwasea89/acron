import React from "react";
import { View, useColorScheme } from "react-native";
import { Text } from "heroui-native";
import Animated, { FadeIn, useReducedMotion, ZoomIn } from "react-native-reanimated";

import { Icon } from "@/components/icon";
import { getPalette } from "@/lib/theme";

interface SentConfirmationProps {
  title: string;
  message: string;
  /** Bottom action, usually "Back to sign in". */
  action?: React.ReactNode;
}

/**
 * Terminal "we sent it" state, shared by the magic-link and code-recovery
 * screens.
 *
 * The tick scales in rather than appearing: a success mark that was simply
 * always there reads as a static illustration, while one that arrives reads as
 * a response to what you just did.
 */
export function SentConfirmation({ title, message, action }: SentConfirmationProps) {
  const isDark = useColorScheme() === "dark";
  const p = getPalette(isDark);
  const reducedMotion = useReducedMotion();

  const entering = reducedMotion ? FadeIn.duration(180) : ZoomIn.springify().damping(14);

  return (
    <View className="items-center pt-6">
      <Animated.View
        entering={entering}
        style={{
          height: 68,
          width: 68,
          borderRadius: 34,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: `${p.success}24`,
        }}
      >
        <Icon name="checkmark.circle.fill" android="check_circle" size={34} color={p.success} />
      </Animated.View>

      <Text type="h4" className="mt-6 text-center text-foreground">
        {title}
      </Text>
      <Text type="body-sm" color="muted" className="mt-2 px-4 text-center">
        {message}
      </Text>

      {action ? <View className="mt-8 w-full">{action}</View> : null}
    </View>
  );
}
