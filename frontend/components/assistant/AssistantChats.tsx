"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "@/lib/api";
import type { AssistantConversationOut } from "@/lib/types";

/* ── AssistantChats ───────────────────────────────────────────────────────
   The chat list, owned once for the whole shell.

   It lives here rather than on the assistant page because two surfaces need it
   and neither contains the other: the sidebar lists recent chats, and
   /app/assistant renders the thread. The sidebar is the page's *sibling* — both
   sit under the app layout, with the page inside <main> — so a provider mounted
   inside the page cannot reach the sidebar. This one sits above both.

   `activeId` lives here for the same reason. Picking a chat in the sidebar has
   to both navigate to the assistant page and tell it which thread to open.
   Because the layout is not remounted when you move between /app routes, state
   set here is still set on the other side of that navigation — the same fact
   the prompt handoff in AssistantDock relies on. The page reads this instead of
   keeping its own copy, so the sidebar's highlight and the open thread cannot
   disagree.

   Keyed by org id where it is mounted: switching orgs must not leave the
   previous tenant's chats on screen. */

interface AssistantChatsValue {
  conversations: AssistantConversationOut[];
  /** Re-read the list — after a new chat is created, or one is deleted. */
  refresh: () => void;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
}

const AssistantChatsContext = createContext<AssistantChatsValue | null>(null);

/** The chat list, for the sidebar and the assistant page alike. */
export function useAssistantChats(): AssistantChatsValue | null {
  return useContext(AssistantChatsContext);
}

/** How many chats the sidebar lists before it offers "More". */
export const SIDEBAR_CHAT_LIMIT = 5;

export function AssistantChatsProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<AssistantConversationOut[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    // Secondary to the thread: a failure must not take the chat down.
    void api
      .get<AssistantConversationOut[]>("/assistant/conversations")
      .then(setConversations)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ conversations, refresh, activeId, setActiveId }),
    [conversations, refresh, activeId],
  );

  return (
    <AssistantChatsContext.Provider value={value}>
      {children}
    </AssistantChatsContext.Provider>
  );
}
