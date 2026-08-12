import React from "react";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

/**
 * Tab-bar glyphs from the Ionicons set (via `@expo/vector-icons`), the same
 * way across iOS, Android and web.
 *
 * Every tab renders in two states that the tab bar cross-fades between:
 *   - `line`   — the `-outline` family, resting weight in muted gray
 *   - `active` — the filled family, tinted with the brand accent
 *
 * Both states are genuine Ionicons glyphs, so the symbol keeps its interior
 * detail when it fills instead of turning into a flat silhouette.
 */

export type TabGlyph =
  | "home"
  | "barbell"
  | "card"
  | "person"
  | "time"
  | "cash"
  | "receipt"
  | "storefront"
  | "checkbox"
  | "checkmark-circle";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

const GLYPHS: Record<TabGlyph, { line: IoniconName; active: IoniconName }> = {
  home: { line: "home-outline", active: "home" },
  barbell: { line: "barbell-outline", active: "barbell" },
  card: { line: "card-outline", active: "card" },
  person: { line: "person-outline", active: "person" },
  time: { line: "time-outline", active: "time" },
  cash: { line: "cash-outline", active: "cash" },
  receipt: { line: "receipt-outline", active: "receipt" },
  storefront: { line: "storefront-outline", active: "storefront" },
  checkbox: { line: "checkbox-outline", active: "checkbox" },
  "checkmark-circle": { line: "checkmark-circle-outline", active: "checkmark-circle" },
};

interface TabGlyphIconProps {
  name: TabGlyph;
  /** `false` renders the resting outline, `true` the accent-filled glyph. */
  active: boolean;
  size: number;
  color: ColorValue;
}

export function TabGlyphIcon({ name, active, size, color }: TabGlyphIconProps) {
  return <Ionicons name={GLYPHS[name][active ? "active" : "line"]} size={size} color={color} />;
}