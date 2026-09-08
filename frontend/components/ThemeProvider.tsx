"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// Thin wrapper so the root (server) layout can mount next-themes without itself
// becoming a client component. Toggles a `.midnight` class on <html> by default
// (the shipped theme); the full five-theme Lexsus set is available.
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="midnight"
      enableSystem
      themes={["light", "dark", "midnight", "solarized", "oled"]}
      disableTransitionOnChange
      enableColorScheme={false}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
