"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { Markdown } from "./Markdown";
import type { AssistantMessageOut, AssistantStep } from "@/lib/types";

/* ── ChatThread ───────────────────────────────────────────────────────────
   The transcript: user turns right-aligned, assistant turns left, in a
   centered reading column. Auto-scrolls to follow a streaming reply, but only
   while the reader is already at the bottom — scrolling up to re-read
   something must not be yanked back on every token.

   An assistant turn is two things, in order (ADR 018): an activity panel of
   the reasoning + tool steps that produced it, then the answer as its own
   bubble. This mirrors the familiar chat-assistant layout — steps first,
   collapsible, answer below — whether the turn is still streaming or loaded
   from history. */

interface Approval {
  id: string | null;
  value: unknown;
}

interface ChatThreadProps {
  messages: AssistantMessageOut[];
  /** Reply text arriving right now, or null when nothing is streaming. */
  draft: string | null;
  /** The in-flight turn's reasoning + tool steps. */
  steps?: AssistantStep[];
  /** Duration of the last completed turn, for the "Worked for Xs" header. */
  elapsedMs?: number | null;
  /** True from send until the turn ends. */
  generating: boolean;
  /** A proposed write awaiting confirmation, or null. */
  approval?: Approval | null;
  /** Answer the confirmation card. */
  onDecide?: (approved: boolean) => void;
}

/** How close to the bottom still counts as "following along". */
const PIN_SLACK = 80;

export function ChatThread({
  messages,
  draft,
  steps = [],
  elapsedMs = null,
  generating,
  approval = null,
  onDecide,
}: ChatThreadProps) {
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
  }, [messages, draft, steps, generating, approval]);

  const empty = messages.length === 0 && draft === null && steps.length === 0;
  const showTyping = generating && !draft && steps.length === 0 && !approval;

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6"
    >
      {empty ? (
        <EmptyThread />
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {messages.map((m) => (
            <Turn key={m.id} message={m} />
          ))}

          {steps.length > 0 && (
            <ActivityPanel steps={steps} elapsedMs={elapsedMs} answerStarted={!!draft} live />
          )}

          {draft && (
            <div className="flex justify-start">
              <div className="max-w-[85%] px-1 py-1">
                <Markdown content={draft} />
                <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-brand align-text-bottom" />
              </div>
            </div>
          )}

          {approval && onDecide && <ApprovalCard approval={approval} onDecide={onDecide} />}

          {showTyping && (
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

/** One transcript turn: user bubble, or assistant steps + answer bubble. */
function Turn({ message }: { message: AssistantMessageOut }) {
  const isUser = message.role === "user";
  if (isUser) return <Bubble message={message} />;
  return (
    <div className="flex flex-col gap-2">
      {message.steps && message.steps.length > 0 && (
        <ActivityPanel steps={message.steps} answerStarted={false} />
      )}
      <Bubble message={message} />
    </div>
  );
}

/** Collapsible reasoning + tool steps that precede an assistant answer.
 *
 *  Open while the turn is working, and it folds away on its own the moment the
 *  answer starts — the same rhythm as a chat assistant's "Worked for Xs". A
 *  manual toggle wins and stops the auto-fold. Historical turns start folded. */
function ActivityPanel({
  steps,
  elapsedMs = null,
  answerStarted = false,
  live = false,
}: {
  steps: AssistantStep[];
  elapsedMs?: number | null;
  answerStarted?: boolean;
  live?: boolean;
}) {
  const [open, setOpen] = useState(live);
  const userToggled = useRef(false);

  useEffect(() => {
    if (live && answerStarted && !userToggled.current) setOpen(false);
  }, [live, answerStarted]);

  function toggle() {
    userToggled.current = true;
    setOpen((v) => !v);
  }

  const running = steps.some((s) => s.type === "tool" && !s.done);
  const header = live ? liveLabel(steps, running) : doneLabel(elapsedMs);

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[85%]">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left text-xs text-muted-foreground transition-colors hover:text-[var(--foreground)]"
        >
          <Chevron open={open} />
          <span className="font-medium">{header}</span>
        </button>
        {open && (
          <div className="space-y-2 px-1 pb-2">
            {steps.map((step, i) =>
              step.type === "thinking" ? (
                <ThinkingBlock key={`t-${i}`} text={step.text} />
              ) : (
                <ToolStep key={`s-${i}`} step={step} />
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolStep({ step }: { step: Extract<AssistantStep, { type: "tool" }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-xs"
      >
        <Chevron open={open} />
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
        <span className="font-medium text-[var(--foreground)]">{toolLabel(step.name)}</span>
        {!step.done && <span className="text-muted-foreground">running…</span>}
      </button>
      {open && (
        <div className="space-y-2 py-1 pl-6 text-xs">
          {step.args && Object.keys(step.args).length > 0 && (
            <Mono label="Input" value={JSON.stringify(step.args, null, 2)} />
          )}
          {step.done && step.summary !== undefined && (
            <Mono label="Output" value={step.summary} />
          )}
        </div>
      )}
    </div>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);
  return (
    <div className="px-1 py-1">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Thinking
      </p>
      <div
        ref={ref}
        aria-live="polite"
        className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {text}
      </div>
    </div>
  );
}

function Mono({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <pre className="mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-[var(--card)] px-2 py-1.5 text-[11px] leading-4 text-[var(--foreground)]">
        {value}
      </pre>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

/** Header while the turn is still running. */
function liveLabel(steps: AssistantStep[], running: boolean): string {
  if (running) return "Working…";
  return steps.some((s) => s.type === "thinking") ? "Thinking…" : "Working…";
}

/** Header once the turn is done. */
function doneLabel(elapsedMs: number | null): string {
  if (!elapsedMs) return "Worked";
  const seconds = Math.max(1, Math.round(elapsedMs / 1000));
  return `Worked for ${seconds}s`;
}

/** "list_pending_receipts" -> "List pending receipts". */
function toolLabel(name: string): string {
  const spaced = name.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The human-in-the-loop gate: nothing is written until the user approves. */
function ApprovalCard({
  approval,
  onDecide,
}: {
  approval: Approval;
  onDecide: (approved: boolean) => void;
}) {
  const value = approval.value as { summary?: string } | null;
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-brand/30 bg-brand/5 px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-brand">
          Confirm action
        </p>
        <p className="mt-1 text-sm leading-6 text-[var(--foreground)]">
          {value?.summary ?? "Approve this action?"}
        </p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => onDecide(true)}>
            Approve
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onDecide(false)}>
            Reject
          </Button>
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
            : "max-w-[85%] px-1 py-1 text-sm leading-6 text-[var(--foreground)]"
        }
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <Markdown content={message.content} />
        )}
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
        I can look up members, revenue, plans and payroll — and propose actions
        like refunds for your approval.
      </p>
    </div>
  );
}
