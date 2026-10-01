"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui";
import { Glyph } from "@/components/Glyph";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, ApiError } from "@/lib/api";
import type { AssistantConversationOut } from "@/lib/types";
import { useAssistantChats } from "./AssistantChats";
import { useAssistantDock } from "./AssistantDock";
import { AssistantRecordPanel } from "./AssistantRecordPanel";
import { ChatPanel } from "./ChatPanel";
import { SessionList } from "./SessionList";

/* ── AssistantPage ────────────────────────────────────────────────────────
   The assistant as a page of its own (/app/assistant), sitting in the shell
   exactly like Dashboard or Members.

   The slim toolbar carries recents on the left (its label is the *current
   session's name*, so the control doubles as "where am I") and a session menu
   beside it; new chat sits on the right. The thread takes the rest.

   When the assistant is opened from a record (e.g. "Ask AI" on a plan), the
   dock carries a frontend-only record handoff: the page renders the record in a
   panel beside the thread and ChatPanel auto-answers the summary question the
   handoff carried. Selecting another chat or starting a new one drops it.

   Neither the thread nor the list is state here: both come from
   AssistantChats, which the sidebar reads too, so the sidebar and this page
   cannot disagree about what is open. */

/** Stable empty list, so the default cannot break memoization below. */
const NO_CHATS: AssistantConversationOut[] = [];

/** Stand-in for the provider's callbacks when there is no provider. */
const NOOP = () => {};

/** The sidebar's chat/assistant mark, so the recents control matches the nav. */
const ChatIcon = () => (
  <Glyph className="h-[18px] w-[18px]">
    <path d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
  </Glyph>
);
const KebabIcon = () => (
  <Glyph className="h-4 w-4">
    <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
  </Glyph>
);
const PlusIcon = () => (
  <Glyph className="h-4 w-4"><path d="M12 5v14M5 12h14" /></Glyph>
);
const TrashIcon = () => (
  <Glyph className="h-4 w-4">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Glyph>
);

export function AssistantPage() {
  const dock = useAssistantDock();
  // Stable across renders (the dock memoizes it), so it is safe to depend on.
  const clearPrompt = dock?.clearPrompt;
  const clearRecord = dock?.clearRecord;
  const record = dock?.record ?? null;

  const chats = useAssistantChats();
  const conversations = chats?.conversations ?? NO_CHATS;
  const activeId = chats?.activeId ?? null;
  // Optional calls: the hook is null only if this page is ever rendered
  // outside the shell's provider, where a chat that cannot be switched is
  // still better than a crash.
  const setActiveId = chats?.setActiveId;
  const refresh = chats?.refresh;

  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();
  const urlConversationId = searchParams.get("c");
  const seededFromUrl = useRef(false);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const sessionLabel = active?.title ?? "New chat";

  // Seed the open thread from the URL once, so refreshing (or a shared link)
  // lands back on the conversation instead of a blank page.
  useEffect(() => {
    if (seededFromUrl.current) return;
    seededFromUrl.current = true;
    if (urlConversationId) queueMicrotask(() => setActiveId?.(urlConversationId));
  }, [urlConversationId, setActiveId]);

  // Keep the URL in step with the open thread. `replace`, not `push`, so
  // switching chats does not stack history entries.
  useEffect(() => {
    router.replace(activeId ? `/app/assistant?c=${activeId}` : "/app/assistant");
  }, [activeId, router]);

  const resetThread = useCallback(() => {
    setActiveId?.(null);
    setHistoryOpen(false);
    // A prompt or record carried over belongs to the thread it started; asking
    // for a new one puts both down.
    clearPrompt?.();
    clearRecord?.();
  }, [setActiveId, clearPrompt, clearRecord]);

  const pick = useCallback(
    (id: string) => {
      setActiveId?.(id);
      setHistoryOpen(false);
      clearPrompt?.();
      clearRecord?.();
    },
    [setActiveId, clearPrompt, clearRecord],
  );

  const handleCreated = useCallback(
    (id: string) => {
      setActiveId?.(id);
      // Taken: clearing here is what stops the handoff prompt from being
      // replayed the next time this page is opened.
      clearPrompt?.();
      refresh?.();
    },
    [setActiveId, refresh, clearPrompt],
  );

  const deleteChat = useCallback(async () => {
    if (!activeId) return;
    setError("");
    try {
      await api.del(`/assistant/conversations/${activeId}`);
      setActiveId?.(null);
      refresh?.();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }, [activeId, setActiveId, refresh]);

  return (
    <div className={`flex h-[calc(100dvh-4rem)] flex-col lg:h-[calc(100dvh-5rem)]${record ? " md:pr-80 lg:pr-96" : ""}`}>
      {/* Slim toolbar — the page's only chrome. Pulled up out of the shell's
          top padding so it sits tight to the top-left corner. */}
      <div className="relative -mt-3 mb-4 flex shrink-0 items-center justify-between gap-3 lg:-mt-5">
        <div className="flex min-w-0 items-center gap-2">
          {/* Recents: the icon alone opens the chat list. */}
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            aria-expanded={historyOpen}
            aria-haspopup="menu"
            aria-label="Recent chats"
            className="-ml-2 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand/60"
          >
            <ChatIcon />
          </button>

          {/* Current session name — a plain label, not a control. */}
          <span className="max-w-[16rem] truncate text-[14px] font-medium text-foreground">
            {sessionLabel}
          </span>

          {/* Session menu. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Chat options"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground data-[state=open]:bg-foreground/[0.06] data-[state=open]:text-foreground focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand/60"
              >
                <KebabIcon />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-44">
              <DropdownMenuItem onSelect={resetThread}>
                <PlusIcon />
                New chat
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={!activeId} onSelect={() => void deleteChat()}>
                <TrashIcon />
                Delete chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <button
          type="button"
          onClick={resetThread}
          aria-label="New chat"
          title="New chat"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-foreground/15 bg-surface text-foreground transition-colors duration-150 hover:border-foreground/30"
        >
          <PlusIcon />
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

      {error && <div className="mb-3 shrink-0"><Alert onDismiss={() => setError("")}>{error}</Alert></div>}

      {/* Thread. The record panel (when present) is a fixed right rail rendered
          outside this column, so it sits flush to the viewport edge. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatPanel
          conversationId={activeId}
          initialPrompt={dock?.prompt ?? null}
          onCreated={handleCreated}
          onRailRefresh={refresh ?? NOOP}
          onUserMessage={() => clearRecord?.()}
        />
      </div>
      {record && <AssistantRecordPanel record={record} />}
    </div>
  );
}
