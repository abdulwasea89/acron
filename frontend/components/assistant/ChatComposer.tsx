"use client";

import { useEffect, useRef, useState } from "react";

/* ── ChatComposer ─────────────────────────────────────────────────────────
   The prompt field itself — auto-growing textarea plus send button. Shared by
   the dashboard's floating bar (`ChatInput`) and the in-session composer so
   the grow-and-cap behaviour has exactly one implementation.

   The send button is inset from the box by the container's padding on every
   side — top, right and bottom all measure the same. That falls out of one
   rule: the button must be exactly as tall as the field, so no centring gap
   is left over above or below it. A one-line field is `py-2` + `leading-6` =
   40px, so the button is `h-10` and the row is button-height. The container's
   padding is then the only inset there is, and it applies to all three sides.

   Two things break that equality, both of which look plausible until you
   measure. An `mb-*` on the button (an optical nudge against a taller field)
   adds to the bottom gap alone. And a field taller than the button leaves
   `(field - button) / 2` of slack above and below, but not on the right — so
   if either size moves, move both.

   The row stays `items-end` rather than `items-center`: the box is bottom-
   anchored and grows upward, so keeping the button on the last-line axis
   holds it still as you type. Centring it would make it slide down the box
   with every new line.

   Once the textarea caps out it scrolls, and that scrollbar is tinted to the
   send button's brand green so the two read as one control. Nothing is drawn
   before the cap — the scrollbar rules only apply with `overflow-y-auto`.
   Both the Firefox (`scrollbar-*`) and WebKit (`::-webkit-scrollbar`) forms
   are needed; neither engine understands the other's. */

/** Grow one line at a time until this many, then stop and scroll. */
const MAX_ROWS = 5;

/* The bordered shell around the row. Defined once and imported by both the
   dashboard bar (`ChatInput`) and the in-session composer (`ChatPanel`) so the
   dock is identical wherever it appears. At rest the row is one line: a 40px
   field (`py-2` + `leading-6`) plus this `p-2` on all sides plus the 1px
   border gives a 58px box, which `rounded-[28px]` fills to a full pill — the
   same shape as the circular send button. */
export const CHAT_COMPOSER_SHELL =
  "rounded-[28px] border border-foreground/15 bg-surface p-2 transition-colors duration-150 focus-within:border-foreground/30";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  /** A reply is in flight — blocks a second send without clearing the field. */
  sending?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Shell classes: the bordered box that wraps the row. */
  className?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
  /** Bump this to focus the field without remounting (keyboard shortcut). */
  focusSignal?: number;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  sending = false,
  disabled = false,
  placeholder = "Ask about members, revenue, or payroll…",
  className = "",
  autoFocus = false,
  ariaLabel = "Ask the assistant",
  focusSignal = 0,
}: ChatComposerProps) {
  const [capped, setCapped] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = value.trim().length > 0 && !sending && !disabled;

  // Auto-grow: collapse first so the box can also shrink when text is
  // deleted, then grow to fit content up to MAX_ROWS. The cap is derived
  // from the element's own line-height and padding rather than a hardcoded
  // pixel guess, so it stays exactly 5 lines if the type scale ever moves.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const cs = getComputedStyle(el);
    const max = parseFloat(cs.lineHeight) * MAX_ROWS + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const next = Math.min(el.scrollHeight, max);
    el.style.height = `${next}px`;
    // Only allow a scrollbar once we've actually hit the cap, so shorter
    // content never shows a flash of scroll track.
    setCapped(el.scrollHeight > max);
  }, [value]);

  useEffect(() => {
    if (autoFocus) areaRef.current?.focus();
  }, [autoFocus]);

  // A shortcut elsewhere bumps focusSignal; focus the field without stealing
  // focus on the initial render (signal 0 is ignored).
  useEffect(() => {
    if (focusSignal > 0) areaRef.current?.focus();
  }, [focusSignal]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter inserts a newline (ChatGPT convention).
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSubmit();
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSubmit();
      }}
      className={className}
    >
      {/* items-end, not items-center: the box is bottom-anchored and grows
          upward, so a centred button would re-centre on every new line and
          drift up the screen as you type. Pinned to the bottom edge it holds
          a fixed position while the text grows above it. */}
      <div className="flex items-end gap-1">
        <textarea
          ref={areaRef}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className={`w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 [scrollbar-color:var(--brand)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-brand [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-[3px] ${
            capped ? "overflow-y-auto" : "overflow-hidden"
          }`}
        />

        {/* Send: the brand pill, square-marked like the other CTAs (§10.8). */}
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand text-brand-foreground transition duration-150 hover:bg-brand/90 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand/60"
        >
          {sending ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}
