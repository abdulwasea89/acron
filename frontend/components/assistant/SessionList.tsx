"use client";

import type { AssistantConversationOut } from "@/lib/types";

/* ── SessionList ──────────────────────────────────────────────────────────
   The recents dropdown: every conversation this user has had in this org,
   newest first, bucketed by how long ago it moved.

   Items are buttons, not links — picking a chat swaps the thread in place
   rather than navigating, so the dashboard URL never changes. */

/** The API sends naive UTC — "2026-09-28T11:24:51.773591", with no offset.
 *  `new Date` reads a bare date-time as *local*, so a chat made a minute ago
 *  would report as many hours old (and land in the wrong bucket). Pin the
 *  zone to UTC unless the string already carries one. */
function parseUTC(iso: string): number {
  const hasZone = /(z|[+-]\d{2}:?\d{2})$/i.test(iso);
  return Date.parse(hasZone ? iso : `${iso}Z`);
}

/** Coarse relative age — enough to order a list by eye. */
function relTime(iso: string): string {
  const then = parseUTC(iso);
  if (Number.isNaN(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

/** Which bucket a conversation's last activity falls into. */
function bucketOf(iso: string): string {
  const then = parseUTC(iso);
  if (Number.isNaN(then)) return "Older";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const DAY = 86_400_000;

  if (then >= startOfToday) return "Today";
  if (then >= startOfToday - DAY) return "Yesterday";
  if (then >= startOfToday - 7 * DAY) return "Previous 7 days";
  if (then >= startOfToday - 30 * DAY) return "Previous 30 days";
  return "Older";
}

/** Bucket order. Buckets with no members are skipped at render time. */
const ORDER = ["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"];

export function SessionList({
  conversations,
  activeId,
  onPick,
}: {
  conversations: AssistantConversationOut[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  // The server returns newest-first, so walking the list once and appending
  // preserves that order inside each bucket.
  const buckets = new Map<string, AssistantConversationOut[]>();
  for (const c of conversations) {
    const key = bucketOf(c.last_message_at);
    const list = buckets.get(key);
    if (list) list.push(c);
    else buckets.set(key, [c]);
  }

  if (conversations.length === 0) {
    return (
      <p className="px-3 py-3 text-xs text-muted-foreground">Past chats will appear here.</p>
    );
  }

  return (
    <nav aria-label="Past chats" className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
      {ORDER.map((label) => {
        const items = buckets.get(label);
        if (!items?.length) return null;
        return (
          <div key={label} className="mb-2 last:mb-0">
            <p className="mb-1 px-2 pt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {label}
            </p>
            <ul>
              {items.map((c) => {
                const active = c.id === activeId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onPick(c.id)}
                      aria-current={active ? "true" : undefined}
                      className={`flex w-full cursor-pointer flex-col rounded-lg px-2.5 py-2 text-left transition-colors duration-150 ${
                        active
                          ? "bg-brand/10 text-foreground"
                          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                      }`}
                    >
                      <span className="w-full truncate text-sm">{c.title}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {relTime(c.last_message_at)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
