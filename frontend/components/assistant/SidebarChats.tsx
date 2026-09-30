"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SIDEBAR_CHAT_LIMIT, useAssistantChats } from "./AssistantChats";
import { ChatsDialog } from "./ChatsDialog";

/* ── SidebarChats ─────────────────────────────────────────────────────────
   The Chats section: the few most recent conversations, then "More" for the
   rest. The list is the sidebar's copy of what the assistant page shows in its
   recents dropdown — both read the same provider, so making a chat in the
   thread updates this list without a reload.

   Picking a chat sets the provider's `activeId` and navigates. The provider
   outlives the navigation (it sits in the layout), so the assistant page opens
   the thread the sidebar named. If you are already there, the push is to the
   route you are on and only the state change does work.

   A row is a button, not a link: the destination is always /app/assistant, and
   which thread to open is state, not a URL. */

/** The assistant bubble, same mark the nav uses for /app/assistant. */
const CHAT_ICON =
  "M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z";

export function SidebarChats({ collapsed }: { collapsed: boolean }) {
  const chats = useAssistantChats();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  // Renders nothing until the provider has a list; there is no useful empty
  // state for a section that is about to fill itself in.
  if (!chats) return null;

  const { conversations, activeId, setActiveId } = chats;
  const recent = conversations.slice(0, SIDEBAR_CHAT_LIMIT);
  const hasMore = conversations.length > recent.length;

  function open(id: string | null) {
    setActiveId(id);
    router.push("/app/assistant");
  }

  const dialog = (
    <ChatsDialog
      open={moreOpen}
      onClose={() => setMoreOpen(false)}
      conversations={conversations}
      activeId={activeId}
      onPick={(id) => {
        setMoreOpen(false);
        open(id);
      }}
    />
  );

  // The 52px rail has no room for titles, so it collapses the section to the
  // one control that still makes sense at that width: everything, in a modal.
  if (collapsed) {
    return (
      <>
        <button
          type="button"
          title="Chats"
          onClick={() => setMoreOpen(true)}
          className="mb-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <Icon d={CHAT_ICON} className="h-4 w-4" />
        </button>
        {dialog}
      </>
    );
  }

  return (
    <div className="mb-3">
      <p className="px-2.5 pb-1 text-[10px] font-semibold text-muted-foreground/80">
        Chats
      </p>

      {recent.length === 0 ? (
        <p className="px-2.5 py-1 text-[12px] text-muted-foreground/70">
          No chats yet
        </p>
      ) : (
        <div className="space-y-0.5">
          {recent.map((c) => {
            const active = c.id === activeId;
            return (
              <button
                key={c.id}
                type="button"
                title={c.title}
                aria-current={active ? "true" : undefined}
                onClick={() => open(c.id)}
                className={`flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition-colors ${
                  active
                    ? "bg-foreground/[0.06] font-medium text-foreground"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                }`}
              >
                <Icon
                  d={CHAT_ICON}
                  className={`h-4 w-4 shrink-0 ${active ? "text-foreground/80" : "text-foreground/50"}`}
                />
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Always offered, not only when there is more to see: with the list
          capped, this is also how you reach a chat that just fell off it. */}
      <button
        type="button"
        onClick={() => setMoreOpen(true)}
        className="mt-0.5 flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        {/* The dots carry the button at rest — the label beside them is one
            step down in weight — so they sit at full foreground, thickened
            well past the 1.75 the row icons use. At that weight they read as a
            control instead of three specks. */}
        <Icon
          d="M6.75 12h.008v.008H6.75V12zm5.25 0h.008v.008H12V12zm5.25 0h.008v.008h-.008V12z"
          strokeWidth={3}
          className="h-4 w-4 shrink-0 text-foreground"
        />
        More
        {hasMore && (
          <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">
            {conversations.length}
          </span>
        )}
      </button>

      {dialog}
    </div>
  );
}

/** Local copy of the sidebar's inline line icon. `strokeWidth` is overridable
 *  because the dots on "More" are round-capped zero-length segments: their
 *  whole size *is* the stroke width, so thickening it is the only way to make
 *  them read heavier once the colour is already full foreground. */
function Icon({
  d,
  className,
  strokeWidth = 1.75,
}: {
  d: string;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
