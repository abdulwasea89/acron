import React from "react";
import { SymbolView } from "expo-symbols";
import type { ColorValue } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";
import type { AndroidSymbol } from "expo-symbols";

export type IconName = SFSymbol;

interface IconProps {
  name: SFSymbol;
  android?: AndroidSymbol;
  size?: number;
  color?: ColorValue;
  weight?: "ultraLight" | "light" | "regular" | "medium" | "semibold" | "bold" | "heavy" | "black";
  className?: string;
}

/**
 * Cross-platform icon. Renders the iOS SF Symbol (`name`) on iOS and the
 * Material Symbol (`android`, falling back to the SF name) on Android/web.
 */
export function Icon({ name, android, size = 24, color, weight = "regular", className }: IconProps) {
  return (
    <SymbolView
      name={android ? { ios: name, android, web: android } : name}
      size={size}
      weight={weight}
      tintColor={color}
      className={className}
    />
  );
}
