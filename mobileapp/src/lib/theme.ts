/**
 * The HeroUI semantic tokens, mirrored as plain hex.
 *
 * HeroUI's tokens live in CSS variables that only Uniwind's `className` pipeline
 * can resolve. Native chrome that never sees a class name — the navigator
 * theme, the system window background, a `placeholderTextColor`, a border color
 * interpolated inside a worklet — needs the same values as literals, so they
 * are kept here in one place, converted from
 * `heroui-native/src/styles/variables.css`.
 */
export const palette = {
  light: {
    background: "#f4f7fb",
    surface: "#ffffff",
    surfaceSecondary: "#e8eef6",
    surfaceTertiary: "#dbe5f0",
    foreground: "#0f1720",
    muted: "#475569",
    border: "#cbd5e1",
    separator: "#94a3b8",
    accent: "#2563eb",
    success: "#15803d",
    warning: "#b45309",
    danger: "#dc2626",
  },
  dark: {
    background: "#000000",
    surface: "#202226",
    surfaceSecondary: "#2b2e34",
    surfaceTertiary: "#3a3e46",
    foreground: "#f1f5f9",
    muted: "#94a3b8",
    border: "#4b505a",
    separator: "#656b76",
    accent: "#3b82f6",
    success: "#22c55e",
    warning: "#f59e0b",
    danger: "#ef4444",
  },
} as const;

/* `as const` narrows each value to its own literal, so `light` and `dark` are
   nominally different types. Widening to `string` makes them one shape. */
export type Palette = { readonly [K in keyof (typeof palette)["light"]]: string };

export const getPalette = (isDark: boolean): Palette => (isDark ? palette.dark : palette.light);

/**
 * Spring presets in Apple's damping-ratio / response vocabulary rather than
 * Reanimated's raw stiffness numbers.
 *
 * `standard` is critically damped — the default for anything that simply moves
 * from A to B; overshoot on a panel that merely appeared reads as noise.
 * `gentle` keeps a little bounce and is reserved for motion the user's own
 * gesture set going, where a dead stop feels mechanical.
 */
export const spring = {
  /** Critically damped, no overshoot. */
  standard: { damping: 26, stiffness: 260, mass: 1 },
  /** Slight overshoot, for momentum-carrying or celebratory motion. */
  gentle: { damping: 17, stiffness: 220, mass: 1 },
  /** Fast and tight, for press feedback that has to feel instant. */
  press: { damping: 20, stiffness: 400, mass: 0.7 },
} as const;
