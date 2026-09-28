"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChatInput } from "@/components/ChatInput";

/* ── AssistantDock ────────────────────────────────────────────────────────
   Puts the floating prompt bar on every dashboard page and hands what you
   type to the assistant's own page.

   The dock owns no chat surface. Sending a prompt records it here and
   navigates to /app/assistant, where the thread is a real page — full width,
   with the recents column beside it. Nothing is rendered at the bottom of
   whatever page you happened to be on.

   The handoff rides on state rather than a query parameter, which works
   because this component lives in the dashboard *layout*: the layout is not
   remounted when you move between /app routes, so the same instance is still
   holding the prompt on the other side of the navigation. The assistant page
   takes it once and clears it, so arriving there later starts a blank thread
   rather than replaying the last thing you asked from somewhere else. */

interface AssistantDockValue {
  /** A prompt typed in the bar, waiting for the assistant page to take it. */
  prompt: string | null;
  /** Record a prompt and go to the assistant page. */
  ask: (prompt: string) => void;
  /** The page has taken the prompt — drop it so a later visit starts blank. */
  clearPrompt: () => void;
}

const AssistantDockContext = createContext<AssistantDockValue | null>(null);

/** Lets any descendant hand a prompt to the assistant. */
export function useAssistantDock(): AssistantDockValue | null {
  return useContext(AssistantDockContext);
}

/** The assistant's own page — where the chat actually lives. */
const ASSISTANT_PATH = "/app/assistant";

export function AssistantDock({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [prompt, setPrompt] = useState<string | null>(null);

  const ask = useCallback(
    (text: string) => {
      setPrompt(text);
      router.push(ASSISTANT_PATH);
    },
    [router],
  );

  const clearPrompt = useCallback(() => setPrompt(null), []);

  const value = useMemo(
    () => ({ prompt, ask, clearPrompt }),
    [prompt, ask, clearPrompt],
  );

  const onAssistantPage = pathname === ASSISTANT_PATH;

  return (
    <AssistantDockContext.Provider value={value}>
      {/* The padding clears the floating bar so it never covers the last row
          of a dense table. The assistant page has no bar AND manages its own
          full height, so padding it would push the page 80px past the
          viewport — which is what made the whole page scroll and drag its
          toolbar and composer off-screen. */}
      <div className={onAssistantPage ? undefined : "pb-20"}>{children}</div>

      {/* On the assistant page the bar is withheld: that page already has the
          composer for the thread you are looking at, and a second input onto
          the same conversation would only be ambiguous. */}
      {!onAssistantPage && <ChatInput />}
    </AssistantDockContext.Provider>
  );
}
