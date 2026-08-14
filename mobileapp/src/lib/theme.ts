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
    background: "#f5f5f5",
    surface: "#ffffff",
    surfaceSecondary: "#efeff0",
    surfaceTertiary: "#eaeaeb",
    foreground: "#18181b",
    muted: "#71717a",
    border: "#dedee0",
    separator: "#aaaaad",
    accent: "#0485f7",
    success: "#17c964",
    warning: "#f5a524",
    danger: "#ff383c",
  },
  dark: {
    background: "#060607",
    surface: "#18181b",
    surfaceSecondary: "#232325",
    surfaceTertiary: "#262728",
    foreground: "#fcfcfc",
    muted: "#9f9fa9",
    border: "#28282c",
    separator: "#47474b",
    accent: "#0485f7",
    success: "#17c964",
    warning: "#f7b750",
    danger: "#db3b3e",
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
