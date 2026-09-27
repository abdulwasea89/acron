"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ChatPanel } from "./ChatPanel";
import { SessionList } from "./SessionList";
import { api } from "@/lib/api";
import type { AssistantConversationOut } from "@/lib/types";

/* ── AssistantDock ────────────────────────────────────────────────────────
   Hosts the assistant inside the dashboard. Nothing here navigates: opening,
   switching and closing a chat are all state, so the URL never leaves /app.

   The chat takes the viewport while it is open, and carries only two pieces of
   chrome, both floating above it:
     · top-LEFT  — a history icon that drops down the recents list
     · top-RIGHT — "New chat", plus the close control that returns you to the
                   dashboard (without it the chat would be a dead end)

   Mount this around any page content; children keep rendering underneath while
   the chat is closed, and the recents list is warmed on mount so the first
   click is instant. */

interface AssistantDockValue {
  /** Open the chat on a prompt typed elsewhere (the dashboard bar). */
  ask: (prompt: string) => void;
  open: boolean;
}

const AssistantDockContext = createContext<AssistantDockValue | null>(null);

/** Lets any descendant hand a prompt to the chat. */
export function useAssistantDock(): AssistantDockValue | null {
  return useContext(AssistantDockContext);
}

export function AssistantDock({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** A prompt handed over but not yet persisted by ChatPanel. */
  const [prompt, setPrompt] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<AssistantConversationOut[]>([]);

  const refresh = useCallback(() => {
    // The recents list is secondary: a failure must not take the chat down.
    void api
      .get<AssistantConversationOut[]>("/assistant/conversations")
      .then(setConversations)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const ask = useCallback((text: string) => {
    setPrompt(text);
    setActiveId(null);
    setHistoryOpen(false);
    setOpen(true);
  }, []);

  const newChat = useCallback(() => {
    setPrompt(null);
    setActiveId(null);
    setHistoryOpen(false);
  }, []);

  const pick = useCallback((id: string) => {
    setPrompt(null);
    setActiveId(id);
    setHistoryOpen(false);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setHistoryOpen(false);
  }, []);

  /** ChatPanel reports the id once the thread exists. Clearing `prompt` here
   *  is what lets the same prompt be asked twice in a row. */
  const handleCreated = useCallback(
    (id: string) => {
      setActiveId(id);
      setPrompt(null);
      refresh();
    },
    [refresh],
  );

  const value = useMemo(() => ({ ask, open }), [ask, open]);

  return (
    <AssistantDockContext.Provider value={value}>
      {children}

      {open && (
        <div className="fixed inset-0 z-50 bg-background">
          {/* Click-anywhere-else closes the dropdown; sits above the chat but
              below the controls, so the icon itself stays clickable. */}
          {historyOpen && (
            <button
              type="button"
              aria-label="Close chat list"
              onClick={() => setHistoryOpen(false)}
              className="absolute inset-0 z-10 cursor-default"
            />
          )}

          {/* Recents: icon at the top-left, dropdown beneath it. */}
          <div className="fixed left-4 top-4 z-20">
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

            {historyOpen && (
              <div className="absolute left-0 top-12 z-20 w-72 overflow-hidden rounded-xl border border-[var(--border)] bg-card shadow-xl shadow-black/10">
                <SessionList
                  conversations={conversations}
                  activeId={activeId ?? ""}
                  onPick={pick}
                />
              </div>
            )}
          </div>

          {/* New chat, then the way back to the dashboard. */}
          <div className="fixed right-4 top-4 z-20 flex items-center gap-2">
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
            <button
              type="button"
              onClick={close}
              aria-label="Close assistant"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-foreground/15 bg-surface text-muted-foreground transition-colors duration-150 hover:border-foreground/30 hover:text-foreground"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="flex h-full flex-col pt-16">
            <ChatPanel
              conversationId={activeId}
              initialPrompt={prompt}
              onCreated={handleCreated}
              onRailRefresh={refresh}
            />
          </div>
        </div>
      )}
    </AssistantDockContext.Provider>
  );
}
