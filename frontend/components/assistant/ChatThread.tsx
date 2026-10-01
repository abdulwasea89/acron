"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { AgentTree } from "./AgentTree";
import { Markdown } from "./Markdown";
import { randomThinkingWord } from "@/lib/thinkingWords";
import type {
  AssistantAgentStep,
  AssistantMessageOut,
  AssistantStep,
  AssistantSwarmStep,
} from "@/lib/types";

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
  /** Record a thumbs rating on an assistant turn (not sent as a message). */
  onFeedback?: (messageId: string, feedback: "up" | "down" | null) => void;
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
  onFeedback,
}: ChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const lastCount = useRef(messages.length);

  // A fresh random word each turn, so the wait reads as activity. Chosen once
  // when a turn starts (not per render) so it does not flicker mid-answer.
  const [waitWord, setWaitWord] = useState(() => randomThinkingWord());
  const wasGenerating = useRef(false);
  useEffect(() => {
    if (generating && !wasGenerating.current) setWaitWord(randomThinkingWord());
    wasGenerating.current = generating;
  }, [generating]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < PIN_SLACK;
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // When you send, snap back to the bottom even if you had scrolled away —
    // your own message must be visible. A streaming reply only follows if you
    // are already at the bottom.
    const grew = messages.length > lastCount.current;
    lastCount.current = messages.length;
    if (grew && messages[messages.length - 1]?.role === "user") {
      pinned.current = true;
    }
    if (pinned.current) el.scrollTop = el.scrollHeight;
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
            <Turn key={m.id} message={m} onFeedback={onFeedback} />
          ))}

          {steps.length > 0 && (
            <ActivityPanel
              steps={steps}
              elapsedMs={elapsedMs}
              answerStarted={!!draft}
              liveWord={waitWord}
              live
            />
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
            <div className="px-1 text-sm leading-6 text-[var(--foreground)]">{waitWord}…</div>
          )}
        </div>
      )}
    </div>
  );
}

/** One transcript turn: user bubble, or assistant steps + answer bubble. */
function Turn({
  message,
  onFeedback,
}: {
  message: AssistantMessageOut;
  onFeedback?: (messageId: string, feedback: "up" | "down" | null) => void;
}) {
  const isUser = message.role === "user";
  if (isUser) return <Bubble message={message} />;
  return (
    <div className="flex flex-col gap-2">
      {message.steps && message.steps.length > 0 && (
        <ActivityPanel steps={message.steps} answerStarted={false} />
      )}
      <Bubble message={message} />
      {onFeedback && <Feedback message={message} onFeedback={onFeedback} />}
    </div>
  );
}

/** Thumbs up/down on an assistant answer. Recorded for improvement only; it is
 *  never sent back into the conversation. */
function Feedback({
  message,
  onFeedback,
}: {
  message: AssistantMessageOut;
  onFeedback: (messageId: string, feedback: "up" | "down" | null) => void;
}) {
  const rate = (value: "up" | "down") =>
    onFeedback(message.id, message.feedback === value ? null : value);

  const base =
    "flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand/60";

  return (
    <div className="flex items-center gap-0.5 pl-1">
      <button
        type="button"
        onClick={() => rate("up")}
        aria-label="Good response"
        aria-pressed={message.feedback === "up"}
        className={`${base} ${message.feedback === "up" ? "text-brand hover:text-brand" : ""}`}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill={message.feedback === "up" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => rate("down")}
        aria-label="Bad response"
        aria-pressed={message.feedback === "down"}
        className={`${base} ${message.feedback === "down" ? "text-danger hover:text-danger" : ""}`}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill={message.feedback === "down" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 14V2M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
        </svg>
      </button>
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
  liveWord = "Working",
}: {
  steps: AssistantStep[];
  elapsedMs?: number | null;
  answerStarted?: boolean;
  live?: boolean;
  liveWord?: string;
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

  const agentSteps = steps.filter((s): s is AssistantAgentStep => s.type === "agent");
  const swarmStats = steps.find((s): s is AssistantSwarmStep => s.type === "swarm");
  // The server's own count when it sent one — it is the authoritative total, and
  // using it keeps the header and the tree's own line from ever disagreeing.
  const agentCount = swarmStats?.total ?? agentSteps.length;
  // While the turn is running, the client's stopwatch is the only thing that
  // knows how long it has been; once it has finished, the server's `turn_ms` is
  // better, because it survives a reload and it covers the whole turn rather
  // than from whenever this panel happened to mount.
  const turnMs = swarmStats?.turn_ms ?? elapsedMs;

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[85%]">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={`flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left transition-colors ${
            live
              ? "text-sm leading-6 text-[var(--foreground)] hover:opacity-80"
              : "hover:opacity-80"
          }`}
        >
          <Chevron open={open} />
          {live ? (
            <span className="text-sm leading-6 text-[var(--foreground)]">{liveWord}…</span>
          ) : (
            // One line: what ran, and how long it took. The agent count tells you
            // whether expanding is worth it; the seconds are the number that
            // actually changes between turns.
            <span className="text-xs font-medium text-muted-foreground">
              {workedSummary(agentCount, turnMs)}
            </span>
          )}
        </button>
        {open && (
          <div className="ml-1.5 space-y-2 border-l border-[var(--border)] py-1 pl-3">
            {/* A swarm turn's steps are an agent tree; everything else is the
                flat reasoning + tool list. The two can coexist — a turn that
                fanned out still has thinking and tool steps of its own — so the
                tree goes first, then the rest. */}
            {agentSteps.length > 0 && <AgentTree steps={agentSteps} />}
            {steps.map((step, i) =>
              step.type === "agent" || step.type === "swarm" ? null : step.type === "thinking" ? (
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
        <div className="ml-4 space-y-2 border-l border-[var(--border)] py-1 pl-3 text-xs">
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

/** The model's reasoning, in full. */
function ThinkingBlock({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{text}</div>
  );
}

function Mono({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <pre className="mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-[var(--card)] px-2 py-1.5 text-[10px] leading-4 text-[var(--foreground)]">
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

/** The header line, once the turn is done: "Worked · 45 agents · 3s".
 *
 *  The agent count is what tells you whether expanding is worth it, and
 *  "Worked" alone would hide the difference between one model call and forty
 *  agents. The seconds are the number that changes between turns, so they sit on
 *  the same line rather than in a place of their own — one glance, two facts.
 *
 *  Both parts are optional and the separators only appear between parts that are
 *  actually there. A direct turn has neither, and must not read "Worked · · ". */
function workedSummary(agentCount: number, turnMs?: number | null): string {
  const parts: string[] = [];
  if (agentCount > 0) parts.push(`${agentCount} ${agentCount === 1 ? "agent" : "agents"}`);
  if (turnMs !== null && turnMs !== undefined) parts.push(formatSeconds(turnMs));
  return parts.length > 0 ? `Worked · ${parts.join(" · ")}` : "Worked";
}

/** 20300 -> "20s"; 2400 -> "2.4s"; 400 -> "0.4s". */
function formatSeconds(ms: number): string {
  const seconds = ms / 1000;
  return seconds >= 10 ? `${Math.round(seconds)}s` : `${seconds.toFixed(1)}s`;
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

/** A user's own message: collapsed to a few lines when it is long, with a
 *  "Show more" toggle. A pasted wall of text otherwise dominates the thread.
 *  Clamped with `line-clamp` (no scroll container); the toggle only appears
 *  when the text actually overflows. */
function UserText({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [content, expanded]);

  return (
    <>
      <div
        ref={ref}
        className={`whitespace-pre-wrap ${expanded ? "" : "line-clamp-6"}`}
      >
        {content}
      </div>
      {(overflowing || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium opacity-80 hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
          <svg
            className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}
    </>
  );
}

function Bubble({ message }: { message: AssistantMessageOut }) {
  const isUser = message.role === "user";
  return (
    <div className={`group flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "w-fit max-w-[85%] break-words rounded-3xl border border-foreground/10 bg-foreground/[0.06] px-4 py-2.5 text-sm leading-6 text-[var(--foreground)]"
            : "w-fit max-w-[85%] break-words px-1 py-1 text-sm leading-6 text-[var(--foreground)]"
        }
      >
        {isUser ? (
          <UserText content={message.content} />
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
      <CopyButton text={message.content} />
    </div>
  );
}

/** Copy a turn's text. Revealed on hover/focus so it never crowds the thread. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied (insecure context, permissions). Fail
      // quietly rather than throwing into the thread.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy message"}
      title={copied ? "Copied" : "Copy"}
      className="mb-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-foreground/[0.06] hover:text-foreground focus:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand/60 group-hover:opacity-100"
    >
      {copied ? (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
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
      <h2 className="mt-4 font-heading text-lg text-[var(--foreground)]">Ask about your gym</h2>
      <p className="mt-1.5 text-sm text-[var(--muted)]">
        I can look up members, revenue, plans and payroll — and propose actions
        like refunds for your approval.
      </p>
    </div>
  );
}
