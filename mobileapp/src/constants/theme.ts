import "@/global.css";
import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#0a0a0a",
    background: "#ffffff",
    backgroundSecondary: "#f6f7f9",
    backgroundElement: "#f4f4f5",
    backgroundSelected: "#e5e5e5",
    textSecondary: "#64748b",
    brand: "#0a0a0a",
    success: "#059669",
    warning: "#d97706",
    danger: "#dc2626",
  },
  dark: {
    text: "#fafafa",
    background: "#000000",
    backgroundSecondary: "#0a0a0a",
    backgroundElement: "#141414",
    backgroundSelected: "#1f1f1f",
    textSecondary: "#a1a1a1",
    brand: "#fafafa",
    success: "#4ade80",
    warning: "#fbbf24",
    danger: "#f87171",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
