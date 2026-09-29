"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AssistantConversationOut } from "@/lib/types";
import { useAssistantDock } from "./AssistantDock";
import { ChatPanel } from "./ChatPanel";
import { SessionList } from "./SessionList";

/* ── AssistantPage ────────────────────────────────────────────────────────
   The assistant as a page of its own (/app/assistant), sitting in the shell
   exactly like Dashboard or Members.

   Deliberately headerless: a slim toolbar carries the only two controls —
   recents on the left, new chat on the right — and the thread takes
   everything else. There is no page title, because the sidebar already says
   where you are and a chat wants the height more than it wants a heading.

   Recents is a dropdown rather than a permanent column, so the transcript
   gets the full width whether or not you are looking at your history. It
   opens over the thread instead of pushing it aside.

   The thread is a real page here, so it fills the viewport (minus the shell's
   own vertical padding) and scrolls internally; the page itself never grows. */

export function AssistantPage() {
  const dock = useAssistantDock();
  // Stable across renders (the dock memoizes it), so it is safe to depend on.
  const clearPrompt = dock?.clearPrompt;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AssistantConversationOut[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const refresh = useCallback(() => {
    // Recents are secondary: a failure must not take the chat down.
    void api
      .get<AssistantConversationOut[]>("/assistant/conversations")
      .then(setConversations)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const newChat = useCallback(() => {
    setActiveId(null);
    setHistoryOpen(false);
    // A prompt carried over from the bar belongs to the thread it started;
    // asking for a new one puts it down.
    clearPrompt?.();
  }, [clearPrompt]);

  const pick = useCallback((id: string) => {
    setActiveId(id);
    setHistoryOpen(false);
    clearPrompt?.();
  }, [clearPrompt]);

  const handleCreated = useCallback(
    (id: string) => {
      setActiveId(id);
      // Taken: clearing here is what stops the handoff prompt from being
      // replayed the next time this page is opened.
      clearPrompt?.();
      refresh();
    },
    [refresh, clearPrompt],
  );

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col lg:h-[calc(100dvh-5rem)]">
      {/* Slim toolbar — the page's only chrome. */}
      <div className="relative mb-4 flex shrink-0 items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          aria-expanded={historyOpen}
          aria-haspopup="menu"
          className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-foreground/15 bg-surface px-3.5 text-[12px] text-foreground transition-colors duration-150 hover:border-foreground/30"
        >
          <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 6v6l4 2" />
            <path d="M3.05 11a9 9 0 1 0 2.6-6.35M3 4v4h4" />
          </svg>
          Recents
          <svg
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 ${historyOpen ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        <button
          type="button"
          onClick={newChat}
          className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-foreground/15 bg-surface px-3.5 text-[12px] text-foreground transition-colors duration-150 hover:border-foreground/30"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New chat
        </button>

        {/* Recents, as a dropdown over the thread. The scrim is what makes a
            click anywhere else close it — it sits under the panel (z-30) and
            over the page (z-20). */}
        {historyOpen && (
          <>
            <button
              type="button"
              aria-label="Close recent chats"
              onClick={() => setHistoryOpen(false)}
              className="fixed inset-0 z-20 cursor-default"
            />
            <div
              role="menu"
              className="absolute left-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-xl border border-[var(--border)] bg-card shadow-xl shadow-black/10"
            >
              <SessionList
                conversations={conversations}
                activeId={activeId ?? ""}
                onPick={pick}
              />
            </div>
          </>
        )}
      </div>

      {/* Thread + composer. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatPanel
          conversationId={activeId}
          initialPrompt={dock?.prompt ?? null}
          onCreated={handleCreated}
          onRailRefresh={refresh}
        />
      </div>
    </div>
  );
}
