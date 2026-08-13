import React from "react";
import { Pressable, Text, View } from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import type { AndroidSymbol } from "expo-symbols";
import { Icon } from "@/components/icon";

interface SwipeAction {
  /** Accessible label, rendered under the icon. */
  label: string;
  icon: "hand.thumbsup" | "xmark" | "checkmark" | "trash" | "questionmark.circle";
  android: AndroidSymbol;
  /** Tailwind surface classes, e.g. "bg-success". */
  bgClass: "bg-success" | "bg-danger" | "bg-warning" | "bg-info";
  onPress: () => void;
}

export type { SwipeAction };

interface SwipeableRowProps {
  children: React.ReactNode;
  /** Actions revealed by swiping right-to-left (drag content to the left). */
  rightActions?: SwipeAction[];
  /** Actions revealed by swiping left-to-right. */
  leftActions?: SwipeAction[];
  onClose?: () => void;
}

function ActionButton({ action }: { action: SwipeAction }) {
  return (
    <Pressable
      onPress={action.onPress}
      className={`w-[76px] items-center justify-center gap-1 ${action.bgClass}`}
    >
      <Icon name={action.icon} android={action.android} size={22} color="#ffffff" weight="medium" />
      <Text className="text-[11px] font-semibold text-white">{action.label}</Text>
    </Pressable>
  );
}

/**
 * A row that reveals action buttons when swiped. Built on RNGH's
 * `ReanimatedSwipeable`; actions are also reachable via taps elsewhere so swipe
 * is an accelerator, not the only path (accessibility-friendly).
 */
export function SwipeableRow({ children, rightActions, leftActions, onClose }: SwipeableRowProps) {
  return (
    <Swipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={
        rightActions?.length
          ? () => (
              <View className="flex-row">
                {rightActions.map((a) => (
                  <ActionButton key={a.label} action={a} />
                ))}
              </View>
            )
          : undefined
      }
      renderLeftActions={
        leftActions?.length
          ? () => (
              <View className="flex-row">
                {leftActions.map((a) => (
                  <ActionButton key={a.label} action={a} />
                ))}
              </View>
            )
          : undefined
      }
      onSwipeableClose={onClose}
    >
      {children}
    </Swipeable>
  );
}