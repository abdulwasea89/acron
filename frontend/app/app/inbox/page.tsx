"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CategoryTabs,
  EmptyState,
  Input,
  Spinner,
} from "@/components/ui";
import { LiveIndicator, useRealtimeEvent } from "@/components/Realtime";
import { useModuleGate } from "@/hooks/useModuleGate";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api, ApiError } from "@/lib/api";
import { titleCase } from "@/lib/format";
import type { InboxConversation, InboxStats, InboxThread } from "@/lib/types";

/* ─── Shared team inbox (#20) ───
   One place for every member conversation across channels. Left: the queue with
   filters. Right: the thread + reply, with an AI draft and assign-to-me. No
   channel provider is wired yet — inbound arrives via the ingest hook and
   outbound is stored/marked sent. */

type Filter = "open" | "unassigned" | "mine" | "resolved";

const CHANNELS: Record<string, { label: string; d: string }> = {
  whatsapp: { label: "WhatsApp", d: "M8 10.5h8M8 14h5M21 12a9 9 0 11-4.2-7.6" },
  sms: { label: "SMS", d: "M8 10h8M8 14h5M4 4h16v12H8l-4 4V4z" },
  email: { label: "Email", d: "M3 6h18v12H3zM3 7l9 6 9-6" },
  instagram: { label: "Instagram", d: "M4 8a4 4 0 014-4h8a4 4 0 014 4v8a4 4 0 01-4 4H8a4 4 0 01-4-4zM12 8a4 4 0 100 8 4 4 0 000-8zM17 7h.01" },
  messenger: { label: "Messenger", d: "M12 3c5 0 9 3.6 9 8s-4 8-9 8c-1 0-2-.1-2.9-.4L5 20l1-3.3C4.8 15.3 4 13.7 4 11c0-4.4 4-8 8-8z" },
  line: { label: "LINE", d: "M4 4h16v12H8l-4 4z" },
  wechat: { label: "WeChat", d: "M9 4C5 4 2 6.7 2 10c0 1.9 1 3.6 2.5 4.7L4 18l3-1.5c.7.2 1.4.3 2 .3h.3M15 8c3.3 0 6 2.2 6 5s-2.7 5-6 5c-.6 0-1.2-.1-1.8-.3L11 19l.4-2.2" },
  telegram: { label: "Telegram", d: "M21 5L3 12l4 1.5L9 20l3-3.5 5 3L21 5z" },
  web_chat: { label: "Web chat", d: "M4 5h16v10H8l-4 4z" },
  phone: { label: "Phone", d: "M4 5c0 8 7 15 15 15l2-3-4-2-2 2c-3-1.5-5.5-4-7-7l2-2-2-4z" },
  walk_in: { label: "Walk-in", d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21v-2a5 5 0 015-5h6a5 5 0 015 5v2" },
  other: { label: "Other", d: "M8 12h.01M12 12h.01M16 12h.01M4 4h16v14H8l-4 4z" },
};

const STATUS_TONE: Record<string, "success" | "warning" | "info" | "neutral"> = {
  open: "success",
  pending: "warning",
  snoozed: "info",
  resolved: "neutral",
};

function channelOf(channel: string) {
  return CHANNELS[channel] ?? CHANNELS.other;
}

function relTime(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso + "Z").getTime()) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso + "Z").toLocaleDateString([], { month: "short", day: "numeric" });
}

function clockTime(iso: string): string {
  return new Date(iso + "Z").toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={channelOf(channel).d} />
    </svg>
  );
}

export default function InboxPage() {
  const { ready } = useModuleGate("inbox");
  const me = useCurrentUser();

  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState<InboxConversation[] | null>(null);
  const [stats, setStats] = useState<InboxStats | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<InboxThread | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const myId = me?.user_id ?? null;

  const loadList = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter === "unassigned") params.set("unassigned", "true");
    else if (filter === "mine" && myId) params.set("assigned_to", myId);
    else if (filter === "resolved") params.set("status", "resolved");
    if (query.trim()) params.set("q", query.trim());
    try {
      setConversations(await api.get<InboxConversation[]>(`/inbox/conversations?${params}`));
    } catch (e) {
      setError((e as ApiError).message);
      setConversations([]);
    }
  }, [filter, query, myId]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await api.get<InboxStats>("/inbox/stats"));
    } catch {
      /* stats are secondary */
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadStats());
  }, [loadStats]);

  // Refetch when the filter or search changes; debounce typing (immediate for an
  // empty query / filter switch).
  useEffect(() => {
    const id = setTimeout(() => void loadList(), query.trim() ? 250 : 0);
    return () => clearTimeout(id);
  }, [loadList, query]);

  const openThread = useCallback(async (id: string) => {
    setActiveId(id);
    setError("");
    try {
      setThread(await api.get<InboxThread>(`/inbox/conversations/${id}`));
    } catch (e) {
      setError((e as ApiError).message);
      setThread(null);
    }
  }, []);

  useRealtimeEvent(["inbox.changed"], () => {
    void loadList();
    void loadStats();
    if (activeId) void openThread(activeId);
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread?.messages.length]);

  const act = useCallback(
    async (id: string, path: string, body?: unknown) => {
      setBusy(id);
      setError("");
      try {
        const updated = await api.post<InboxThread>(`/inbox/conversations/${id}/${path}`, body);
        setThread(updated);
        void loadList();
        void loadStats();
      } catch (e) {
        setError((e as ApiError).message);
      } finally {
        setBusy(null);
      }
    },
    [loadList, loadStats],
  );

  async function sendReply() {
    if (!thread || !reply.trim()) return;
    const id = thread.id;
    const body = reply;
    setReply("");
    await act(id, "reply", { body });
  }

  async function draft() {
    if (!thread) return;
    setBusy(thread.id);
    setError("");
    try {
      const res = await api.post<{ body: string }>(`/inbox/conversations/${thread.id}/draft`);
      setReply(res.body);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  }

  const tabs = useMemo(
    () => [
      { value: "open" as Filter, label: "Open", count: stats?.unread || undefined },
      { value: "unassigned" as Filter, label: "Unassigned", count: stats?.unassigned || undefined },
      { value: "mine" as Filter, label: "Mine" },
      { value: "resolved" as Filter, label: "Resolved" },
    ],
    [stats],
  );

  if (!ready) return <Spinner label="Loading inbox…" />;

  const who = (c: InboxConversation) => c.member_name || c.contact_name || c.contact_handle;

  // Belt-and-suspenders: narrow the fetched page client-side too, so typing
  // always filters immediately regardless of the server round-trip.
  const q = query.trim().toLowerCase();
  const visible = (conversations ?? []).filter((c) => {
    if (!q) return true;
    return (
      (c.member_name ?? "").toLowerCase().includes(q) ||
      (c.contact_name ?? "").toLowerCase().includes(q) ||
      c.contact_handle.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <PageHeader title="Inbox" subtitle="Every member conversation, one shared queue" action={<LiveIndicator />} />

      {error && (
        <div className="mb-3">
          <Alert onDismiss={() => setError("")}>{error}</Alert>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* Queue */}
        <Card className="flex flex-col overflow-hidden" >
          <div className="border-b border-foreground/10 p-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, handle…"
              aria-label="Search conversations"
              size="sm"
            />
            <div className="mt-2">
              <CategoryTabs variant="underline" tabs={tabs} value={filter} onChange={setFilter} />
            </div>
          </div>
          <div className="min-h-[50vh] flex-1 overflow-y-auto lg:h-[calc(100vh-19rem)]">
            {conversations === null ? (
              <div className="p-5"><Spinner label="Loading conversations…" /></div>
            ) : visible.length === 0 ? (
              <EmptyState
                title={query.trim() ? "No matches" : "Inbox zero"}
                hint={query.trim() ? `No conversations match “${query.trim()}”.` : "No conversations in this view."}
              />
            ) : (
              <ul className="divide-y divide-foreground/[0.06]">
                {visible.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => openThread(c.id)}
                      className={`flex w-full cursor-pointer items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-foreground/[0.03] ${
                        c.id === activeId ? "bg-foreground/[0.05]" : ""
                      }`}
                    >
                      <Avatar name={who(c)} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-medium text-foreground">{who(c)}</span>
                          <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
                            {relTime(c.last_message_at)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <ChannelIcon channel={c.channel} className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {c.preview_direction === "outbound" ? "You: " : ""}
                            {c.preview ?? "—"}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          {c.unread_count > 0 && <Badge tone="info" size="sm">{c.unread_count} new</Badge>}
                          {c.assigned_name ? (
                            <span className="text-[10px] text-muted-foreground">· {c.assigned_name}</span>
                          ) : (
                            <Badge tone="warning" size="sm">Unassigned</Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Thread */}
        <Card className="flex flex-col overflow-hidden">
          {!thread ? (
            <EmptyState
              title="Select a conversation"
              hint="Pick a thread on the left to read and reply."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/10 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-semibold text-foreground">{who(thread)}</span>
                    <Badge tone="neutral" size="sm">
                      <span className="inline-flex items-center gap-1">
                        <ChannelIcon channel={thread.channel} className="h-3 w-3" />
                        {channelOf(thread.channel).label}
                      </span>
                    </Badge>
                    <Badge tone={STATUS_TONE[thread.status] ?? "neutral"} size="sm">{titleCase(thread.status)}</Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{thread.contact_handle}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {thread.assigned_to === myId ? (
                    <Button variant="secondary" disabled={busy === thread.id} onClick={() => act(thread.id, "assign", { user_id: null })}>
                      Unassign
                    </Button>
                  ) : (
                    <Button variant="secondary" disabled={busy === thread.id} onClick={() => act(thread.id, "assign", { user_id: myId })}>
                      Assign to me
                    </Button>
                  )}
                  <select
                    aria-label="Conversation status"
                    value={thread.status}
                    onChange={(e) => act(thread.id, "status", { status: e.target.value })}
                    className="h-8 cursor-pointer rounded-md border border-foreground/20 bg-card px-2 text-[12px] text-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  >
                    {["open", "pending", "snoozed", "resolved"].map((s) => (
                      <option key={s} value={s}>{titleCase(s)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div ref={scrollRef} className="min-h-[40vh] flex-1 space-y-3 overflow-y-auto px-4 py-4 lg:h-[calc(100vh-26rem)]">
                {thread.messages.map((m) => {
                  const out = m.direction === "outbound";
                  return (
                    <div key={m.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                          out
                            ? "rounded-br-sm bg-brand text-brand-foreground"
                            : "rounded-bl-sm bg-surface text-foreground"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={`mt-1 text-right text-[10px] ${out ? "text-brand-foreground/70" : "text-muted-foreground"}`}>
                          {clockTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-foreground/10 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Button variant="ghost" disabled={busy === thread.id} onClick={draft}>
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3l1.6 4.6L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.4L12 3zM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15z" />
                    </svg>
                    AI draft
                  </Button>
                  <span className="text-[11px] text-muted-foreground">Drafts a reply you can edit before sending.</span>
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendReply();
                      }
                    }}
                    rows={2}
                    placeholder="Write a reply… (Enter to send, Shift+Enter for a new line)"
                    className="max-h-40 min-h-[44px] w-full resize-none rounded-md border border-foreground/20 bg-card px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                  <Button
                    disabled={!reply.trim() || busy === thread.id}
                    onClick={sendReply}
                    loading={busy === thread.id}
                  >
                    Send
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
