"use client";

import { ThinkingOrb as Orb, type ThinkingOrbProps } from "thinking-orbs";

/* ── ThinkingOrb ───────────────────────────────────────────────────────────
   The "it is on it" mark in a live turn. thinking-orbs draws it — a dotted
   thought-orb on a 2D canvas, nine hand-tuned states, no dependencies — and
   this is where the app's two habits live: the inline-text scale (20px), and
   the stock ink.

   The ink is left alone because it is the one part that has to survive the
   app's five themes: it flips light or dark off the ancestor `dark` class
   (next-themes writes it on <html>), then the OS preference. A brand-green orb
   would need a literal colour, and --brand is a different hue in every theme.

   The avatar answers "who is this"; the orb answers "what is it doing", so
   they never share a row. The library pauses the canvas offscreen, holds a
   still frame under prefers-reduced-motion, and carries role="img" with a
   label per state. */

/** 64 (avatar scale), 32 (compact) or 20 (inline text) — each is its own
 *  tuned design, not a scale factor, so the default is the inline one. */
type AssistantOrbProps = Omit<ThinkingOrbProps, "size"> & {
  size?: ThinkingOrbProps["size"];
};

export function ThinkingOrb({ size = 20, ...rest }: AssistantOrbProps) {
  return <Orb size={size} {...rest} />;
}