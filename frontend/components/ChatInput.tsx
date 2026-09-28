"use client";

import { useCallback, useEffect, useState } from "react";
import { ChatComposer } from "@/components/assistant/ChatComposer";
import { useAssistantDock } from "@/components/assistant/AssistantDock";

/* ── ChatInput ────────────────────────────────────────────────────────────
   The assistant's entry point, floating on every dashboard page: a
   bottom-centered, fixed, z-40 prompt bar (ChatGPT-style). It floats above
   the page content but deliberately sits *below* dialogs, selects and kebab
   menus (z-50) so opening a modal still wins the stacking order.

   z-40 / fixed is intentional — this is a persistent overlay, not a page
   section. To re-flow it into the page instead, drop the `fixed` shell and
   render the inner card inline.

   The box fill is the default `bg-surface`, hairline border, shadow.

   Submitting hands the prompt to AssistantDock, which carries it to the
   assistant page and navigates there — the bar starts a chat, it never
   renders one. Nothing is generated here: that page's ChatPanel creates the
   conversation and streams the reply, so exactly one code path talks to the
   model.

   Keyboard: ⌘K / Ctrl+K (or "/") focuses the bar from anywhere on the page,
   so the assistant is one keystroke away. "/" is ignored while the user is
   already typing in a field. */

/** True when the event target is a field that should keep its keystrokes. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

export function ChatInput() {
  const dock = useAssistantDock();
  const [value, setValue] = useState("");
  const [focusSignal, setFocusSignal] = useState(0);
  const [isMac, setIsMac] = useState(false);

  // Read the platform after mount so SSR/hydration agree (both start false).
  // Deferred because a setState in an effect body cascades renders
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    queueMicrotask(() => setIsMac(/Mac|iPhone|iPad/.test(navigator.userAgent)));
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setFocusSignal((n) => n + 1);
        return;
      }
      if (
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTypingTarget(e.target)
      ) {
        e.preventDefault();
        setFocusSignal((n) => n + 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const submit = useCallback(() => {
    const prompt = value.trim();
    if (!prompt || !dock) return;
    // Clear immediately: the chat surface takes over and owns the text from
    // here, so leaving it in the bar would show the same prompt twice.
    setValue("");
    dock.ask(prompt);
  }, [value, dock]);

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 w-[calc(100%-2.5rem)] max-w-2xl -translate-x-1/2">
      <ChatComposer
        value={value}
        onChange={setValue}
        onSubmit={submit}
        focusSignal={focusSignal}
        hint={isMac ? "⌘K" : "Ctrl K"}
        className="pointer-events-auto animate-fade-in rounded-3xl border border-foreground/15 bg-surface p-2 shadow-xl shadow-black/10 transition-colors duration-150 focus-within:border-foreground/30"
      />
    </div>
  );
}
