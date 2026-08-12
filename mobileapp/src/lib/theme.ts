/**
 * The HeroUI semantic tokens, mirrored as plain hex.
 *
 * HeroUI's tokens live in CSS variables that only Uniwind's `className` pipeline
 * can resolve. Native chrome that never sees a class name — the navigator
 * theme, the system window background — needs the same values as literals, so
 * they are kept here in one place, converted from
 * `heroui-native/src/styles/variables.css`.
 */
export const palette = {
  light: {
    background: "#f5f5f5",
    surface: "#ffffff",
    foreground: "#18181b",
    border: "#dedee0",
    accent: "#0485f7",
  },
  dark: {
    background: "#060607",
    surface: "#18181b",
    foreground: "#fcfcfc",
    border: "#28282c",
    accent: "#0485f7",
  },
} as const;

export const getPalette = (isDark: boolean) => (isDark ? palette.dark : palette.light);
