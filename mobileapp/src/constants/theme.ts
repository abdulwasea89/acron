import "@/global.css";
import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#111827",
    background: "#ffffff",
    backgroundSecondary: "#f3f4f6",
    backgroundElement: "#F0F0F3",
    backgroundSelected: "#E0E1E6",
    textSecondary: "#6b7280",
    brand: "#208AEF",
    success: "#22c55e",
    warning: "#eab308",
    danger: "#ef4444",
  },
  dark: {
    text: "#ffffff",
    background: "#111827",
    backgroundSecondary: "#1f2937",
    backgroundElement: "#212225",
    backgroundSelected: "#2E3135",
    textSecondary: "#9ca3af",
    brand: "#4da6ff",
    success: "#4ade80",
    warning: "#facc15",
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
