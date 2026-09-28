"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { api } from "@/lib/api";
import type { AssistantConversationOut } from "@/lib/types";
import { useAssistantDock } from "./AssistantDock";
import { ChatPanel } from "./ChatPanel";
import { SessionList } from "./SessionList";

/* ── AssistantPage ────────────────────────────────────────────────────────
   The assistant as a page of its own (/app/assistant), sitting in the shell
   exactly like Dashboard or Members.

   Layout mirrors the docked chat the dashboard already has — recents on the
   left, thread and composer on the right — but as two persistent columns
   instead of an overlay, because a full page has the width to show the
   history rather than tuck it behind a dropdown. On narrow screens the
   history column collapses into a header dropdown.

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
      <PageHeader
        title="Assistant"
        subtitle="Grounded in this organization's data — ask about members, revenue, or payroll."
        action={
          <div className="flex items-center gap-2">
            {/* History, only while the recents column is hidden. */}
            <div className="relative lg:hidden">
              <button
                type="button"
                onClick={() => setHistoryOpen((v) => !v)}
                aria-label="Recent chats"
                aria-expanded={historyOpen}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-foreground/15 bg-surface text-muted-foreground transition-colors duration-150 hover:border-foreground/30 hover:text-foreground"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 6v6l4 2" />
                  <path d="M3.05 11a9 9 0 1 0 2.6-6.35M3 4v4h4" />
                </svg>
              </button>
            </div>

            <button
              type="button"
              onClick={newChat}
              className="flex h-9 cursor-pointer items-center gap-2 rounded-full border border-foreground/15 bg-surface px-3.5 text-[13px] text-foreground transition-colors duration-150 hover:border-foreground/30"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New chat
            </button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 gap-6">
        {/* Recents — a permanent column on desktop. */}
        <aside className="hidden w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-card lg:flex">
          <p className="shrink-0 border-b border-[var(--border)] px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Recent
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SessionList conversations={conversations} activeId={activeId ?? ""} onPick={pick} />
          </div>
        </aside>

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

      {/* Mobile recents: click-anywhere-else closes the dropdown. */}
      {historyOpen && (
        <>
          <button
            type="button"
            aria-label="Close chat list"
            onClick={() => setHistoryOpen(false)}
            className="fixed inset-0 z-20 cursor-default lg:hidden"
          />
          <div className="fixed right-4 top-28 z-30 w-72 overflow-hidden rounded-xl border border-[var(--border)] bg-card shadow-xl shadow-black/10 lg:hidden">
            <SessionList conversations={conversations} activeId={activeId ?? ""} onPick={pick} />
          </div>
        </>
      )}
    </div>
  );
}
