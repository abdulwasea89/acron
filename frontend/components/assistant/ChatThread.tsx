"use client";

import { useEffect, useRef } from "react";
import type { AssistantMessageOut } from "@/lib/types";

/* ── ChatThread ───────────────────────────────────────────────────────────
   The transcript: user turns right-aligned, assistant turns left, in a
   centered reading column. Auto-scrolls to follow a streaming reply, but only
   while the reader is already at the bottom — scrolling up to re-read
   something must not be yanked back on every token.

   Assistant text is rendered as plain text with `whitespace-pre-wrap`, so the
   line breaks and spacing the model produces survive without pulling in a
   markdown renderer (there is none in this project). */

interface ChatThreadProps {
  messages: AssistantMessageOut[];
  /** Reply text arriving right now, or null when nothing is streaming. */
  draft: string | null;
  /** Reasoning trace arriving before the answer, or empty once it starts. */
  thinking?: string;
  /** True from send until the first token lands (shows the typing dots). */
  generating: boolean;
}

/** How close to the bottom still counts as "following along". */
const PIN_SLACK = 80;

export function ChatThread({ messages, draft, thinking = "", generating }: ChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < PIN_SLACK;
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pinned.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, draft, generating]);

  const empty = messages.length === 0 && draft === null;

  return (
    <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
      {empty ? (
        <EmptyThread />
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {messages.map((m) => (
            <Bubble key={m.id} message={m} />
          ))}

          {/* The wait is filled with the model's own reasoning. A reasoning
              model can think for longer than it takes to answer, so showing
              this is the difference between a spinner that looks stuck and a
              reply visibly being worked out. It gives way the moment real
              answer text starts. */}
          {thinking !== "" && !draft && <ThinkingTrace text={thinking} />}

          {draft && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-[var(--border)] bg-card px-4 py-2.5 text-sm leading-6 text-[var(--foreground)]">
                <span className="whitespace-pre-wrap">{draft}</span>
                <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-brand" />
              </div>
            </div>
          )}

          {generating && !draft && thinking === "" && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-[var(--border)] bg-card px-4 py-3">
                <TypingDots />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The model's reasoning, live. Pinned to the newest line and clamped to a few
 *  rows, so a long trace reads as a moving ticker instead of growing without
 *  bound or shoving the answer off screen. */
function ThinkingTrace({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-dashed border-[var(--border)] bg-[var(--background)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" aria-hidden="true" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Thinking
          </span>
        </div>
        <div
          ref={ref}
          aria-live="polite"
          className="mt-1.5 max-h-20 overflow-y-auto text-xs leading-5 text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {text}
        </div>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: AssistantMessageOut }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-md border border-brand/20 bg-brand/10 px-4 py-2.5 text-sm leading-6 text-[var(--foreground)]"
            : "max-w-[85%] rounded-2xl rounded-bl-md border border-[var(--border)] bg-card px-4 py-2.5 text-sm leading-6 text-[var(--foreground)]"
        }
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
        {message.error && (
          // The partial answer above is real text the model produced before it
          // failed; say so rather than showing a silent half-sentence.
          <p className="mt-2 border-t border-[var(--border)] pt-2 text-xs text-[var(--danger)]">
            {message.error}
          </p>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1" aria-label="Thinking">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--muted)]"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

function EmptyThread() {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
        </svg>
      </div>
      <h2 className="mt-4 font-display text-lg text-[var(--foreground)]">Ask about your gym</h2>
      <p className="mt-1.5 text-sm text-[var(--muted)]">
        I can see today&apos;s check-ins, revenue, member counts and your published plans.
      </p>
    </div>
  );
}
