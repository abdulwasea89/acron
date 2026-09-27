"use client";

import { useCallback, useState } from "react";
import { ChatComposer } from "@/components/assistant/ChatComposer";
import { useAssistantDock } from "@/components/assistant/AssistantDock";

/* ── ChatInput ────────────────────────────────────────────────────────────
   The dashboard's floating assistant entry point: a bottom-centered, fixed,
   z-40 prompt bar (ChatGPT-style). It floats above the dashboard content but
   deliberately sits *below* dialogs, selects and kebab menus (z-50) so
   opening a modal still wins the stacking order.

   z-40 / fixed is intentional — this is a persistent overlay, not a page
   section. To re-flow it into the page instead, drop the `fixed` shell and
   render the inner card inline.

   The box fill is the default `bg-surface`, hairline border, shadow.

   Submitting hands the prompt to AssistantDock, which opens the chat in place
   *on this page* — no navigation. Nothing is generated here: the dock's
   ChatPanel creates the conversation and streams the reply, so exactly one
   code path talks to the model. */

export function ChatInput() {
  const dock = useAssistantDock();
  const [value, setValue] = useState("");

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
        className="pointer-events-auto animate-fade-in rounded-3xl border border-foreground/15 bg-surface p-2 shadow-xl shadow-black/10 transition-colors duration-150 focus-within:border-foreground/30"
      />
    </div>
  );
}
