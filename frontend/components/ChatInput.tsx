"use client";

import { useCallback, useEffect, useState } from "react";
import { CHAT_COMPOSER_SHELL, ChatComposer } from "@/components/assistant/ChatComposer";
import { useAssistantDock } from "@/components/assistant/AssistantDock";

/* ── ChatInput ────────────────────────────────────────────────────────────
   The assistant's entry point, floating on every dashboard page: a
   bottom-centered, fixed, z-40 prompt bar (ChatGPT-style). It floats above
   the page content but deliberately sits *below* dialogs, selects and kebab
   menus (z-50) so opening a modal still wins the stacking order.

   z-40 / fixed is intentional — this is a persistent overlay, not a page
   section. To re-flow it into the page instead, drop the `fixed` shell and
   render the inner card inline.

   Centring follows the *content column*, not the viewport. Below `lg` there
   is no sidebar and the two coincide exactly. From `lg` up the sidebar holds
   the left edge at a fixed `lg:w-64` — 16rem — so the content column's centre
   sits exactly half that, 8rem, right of the viewport's centre. Hence
   `lg:left-[calc(50%+8rem)]`. Keep that 8rem in step with the sidebar's
   `lg:w-64` in components/Sidebar.tsx; they are two halves of one fact.

   The bar keeps its own width (max-w-2xl) rather than stretching to fill the
   column — it is centred *within* the content, not sized to it.

   The box fill is the default `bg-surface`, hairline border, shadow.

   Submitting hands the prompt to AssistantDock, which carries it to the
   assistant page and navigates there — the bar starts a chat, it never
   renders one. Nothing is generated here: that page's ChatPanel creates the
   conversation and streams the reply, so exactly one code path talks to the
   model.

   Keyboard: ⌘K / Ctrl+K (or "/") focuses the bar from anywhere on the page,
   so the assistant is one keystroke away. "/" is ignored while the user is
   already typing in a field. The shortcut is deliberately unadvertised — the
   field carries no key badge, so nothing competes with the placeholder. */

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
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 w-[calc(100%-2.5rem)] max-w-2xl -translate-x-1/2 lg:left-[calc(50%+8rem)]">
      <ChatComposer
        value={value}
        onChange={setValue}
        onSubmit={submit}
        focusSignal={focusSignal}
        className={`pointer-events-auto animate-fade-in ${CHAT_COMPOSER_SHELL} shadow-xl shadow-black/10`}
      />
    </div>
  );
}
