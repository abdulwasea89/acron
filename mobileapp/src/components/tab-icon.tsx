import React from "react";
import { View } from "react-native";
import type { ColorValue } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";
import type { AndroidSymbol } from "expo-symbols";
import { Icon } from "@/components/icon";

interface TabIconProps {
  name: SFSymbol;
  android: AndroidSymbol;
  color: ColorValue;
  focused: boolean;
}

/** Tab bar icon — tinted SymbolView (SF Symbols / Material). */
export function TabIcon({ name, android, color, focused }: TabIconProps) {
  return (
    <View className="h-6 w-6 items-center justify-center">
      <Icon
        name={name}
        android={android}
        size={focused ? 25 : 23}
        color={color}
        weight={focused ? "bold" : "regular"}
      />
    </View>
  );
}
