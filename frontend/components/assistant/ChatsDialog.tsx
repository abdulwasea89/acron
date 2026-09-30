"use client";

import { Dialog } from "@/components/Dialog";
import type { AssistantConversationOut } from "@/lib/types";
import { SessionList } from "./SessionList";

/* ── ChatsDialog ──────────────────────────────────────────────────────────
   The sidebar's "More": every chat this user has in this org, as a modal
   rather than a page, so opening it doesn't cost you the screen you were on —
   the same reasoning as the settings modal.

   It renders the assistant page's own SessionList, so the buckets
   (Today / Yesterday / Previous 7 days …) and the relative ages are literally
   the same component, not a lookalike that drifts. This dialog is that list
   with more room; the sidebar shows the first few and defers here. */

export function ChatsDialog({
  open,
  onClose,
  conversations,
  activeId,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  conversations: AssistantConversationOut[];
  activeId: string | null;
  onPick: (id: string) => void;
}) {
  const count = conversations.length;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Chats"
      subtitle={count === 1 ? "1 conversation" : `${count} conversations`}
      className="max-w-xl"
    >
      {/* SessionList carries its own padding and scroll cap; the negative
          margin lets its rows run to the panel's edges like the dropdown. */}
      <div className="-mx-2">
        <SessionList
          conversations={conversations}
          activeId={activeId ?? ""}
          onPick={onPick}
        />
      </div>
    </Dialog>
  );
}
