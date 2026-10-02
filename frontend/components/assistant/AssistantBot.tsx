"use client";

import { BotAvatar, type BotAvatarProps, type BotAvatarState } from "bot-avatars";

/* ── AssistantBot ──────────────────────────────────────────────────────────
   The assistant's face. bot-avatars draws it — one lit body on a 2D canvas,
   no WebGL and no dependencies — and this file is the app's single place to
   say what that bot looks like: every surface that shows the assistant goes
   through here, so it is the same character everywhere and changing its body
   or material is one line.

   `mech` in plastic. It has to read at 18px beside a running turn as well as
   at 72px in the empty state, where the stock fur would collapse into noise
   and a pale body would dissolve into a light background. Slate keeps its edge
   on both themes, and plastic still carries the hot spot, sheen and rim at any
   size. Its palette colour is left alone on purpose: bot-avatars paints from a
   literal colour and cannot take a CSS variable, and --brand is a different
   hue in every theme.

   The library covers the rest itself — prefers-reduced-motion holds the still
   pose, the canvas pauses when it scrolls out of view, and it carries role="img"
   with a label per state. */

type AssistantBotProps = Omit<BotAvatarProps, "type" | "shading"> & {
  size?: number;
  state?: BotAvatarState;
};

export function AssistantBot({ size = 24, state = "default", ...rest }: AssistantBotProps) {
  return <BotAvatar type="mech" size={size} state={state} face="mouth" shading="plastic" {...rest} />;
}