"use client";

import { useCallback, useEffect, useRef, useState, type Ref } from "react";
import { ChatComposer } from "@/components/assistant/ChatComposer";
import { useAssistantDock } from "@/components/assistant/AssistantDock";

/* ── ChatInput ────────────────────────────────────────────────────────────
   The assistant's entry point on every dashboard page: a compact launcher in
   the bottom-right corner that opens a floating panel with a welcome state,
   suggested prompts, and the prompt field.

   It starts a chat; it never renders one. Submitting hands the prompt to
   AssistantDock, which carries it to /app/assistant and navigates there — that
   page's ChatPanel creates the conversation and streams the reply, so exactly
   one code path talks to the model. The panel therefore shows the *welcome*
   state rather than a transcript, and closes as soon as a prompt is sent.

   Position is viewport-relative (`fixed`), not tied to the content column the
   way the old bottom bar was — a corner affordance belongs to the viewport
   corner. z-40 keeps it *below* dialogs, selects and menus (z-50), so opening
   a modal still wins the stacking order.

   Keyboard: ⌘K / Ctrl+K (or "/") opens the panel and focuses the field from
   anywhere on the page; "/" is ignored while the user is already typing in a
   field. Escape closes. Shift+Enter inserts a newline (Enter sends). */

/** True when the event target is a field that should keep its keystrokes. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

/* The panel placeholder is deliberately a conversational constant rather than
   the per-page hint the old bar used: "Ask about your space plans…" read like a
   label on a search box, and the panel now has a greeting to carry the page
   context instead. */
const PLACEHOLDER = "Ask anything about your plans…";

/* Example questions shown while the panel is empty. These describe things the
   assistant can actually answer in any vertical, so the global launcher never
   promises a page-specific capability it does not have. */
const SUGGESTIONS = [
  "How many active plans?",
  "Which plans are in draft?",
  "What needs my attention today?",
  "Summarize this month's revenue",
] as const;

const PANEL_ID = "ai-assistant-panel";

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M12 8.5 13.6 12l3.5 1.6-3.5 1.6L12 18.7l-1.6-3.5L6.9 13.6 10.4 12z" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/** The collapsed affordance: one compact circle, not a glowing call to action.
 *  It only renders while the panel is closed, so it has no expanded state of
 *  its own — the panel carries its own close control. */
function AssistantLauncher({
  onOpen,
  buttonRef,
}: {
  onOpen: () => void;
  buttonRef: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onOpen}
      aria-label="Open the assistant"
      className="flex h-[52px] w-[52px] cursor-pointer items-center justify-center rounded-full border border-foreground/15 bg-popover text-foreground shadow-xl shadow-black/25 transition duration-150 hover:scale-[1.02] hover:border-foreground/25 hover:text-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand/60"
    >
      <SparkIcon className="h-5 w-5" />
    </button>
  );
}

function SuggestionRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.02] px-3 py-2 text-left text-[13px] leading-5 text-foreground transition duration-150 hover:border-foreground/20 hover:bg-foreground/[0.05] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand/60"
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5" />
    </button>
  );
}

interface AssistantPanelProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSuggestion: (prompt: string) => void;
  onClose: () => void;
  focusSignal: number;
}

function AssistantPanel({
  value,
  onChange,
  onSubmit,
  onSuggestion,
  onClose,
  focusSignal,
}: AssistantPanelProps) {
  return (
    <section
      id={PANEL_ID}
      role="dialog"
      aria-label="AI Assistant"
      className="flex max-h-[calc(100dvh-2.5rem)] w-[380px] max-w-[calc(100vw-24px)] animate-dialog-in flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-popover shadow-xl shadow-black/25"
    >
      <header className="flex shrink-0 items-center gap-2.5 border-b border-foreground/[0.08] px-4 py-3.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <SparkIcon className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-semibold text-foreground">AI Assistant</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
          Online
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the assistant"
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand/60"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </header>

      {/* The welcome state is the panel's only body today: the dock starts a
          chat rather than rendering one. It scrolls so the composer can stay
          pinned when the panel is shorter than its content (short viewports). */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <h2 className="text-[15px] font-semibold leading-6 text-foreground">Hello 👋</h2>
        <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
          I can help you understand your plans, pricing, billing, and operations.
        </p>

        <div className="mt-4 space-y-2">
          {SUGGESTIONS.map((suggestion) => (
            <SuggestionRow
              key={suggestion}
              label={suggestion}
              onClick={() => onSuggestion(suggestion)}
            />
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-foreground/[0.08] px-3 py-2.5">
        <ChatComposer
          variant="panel"
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          autoFocus
          focusSignal={focusSignal}
          placeholder={PLACEHOLDER}
        />
        <p className="mt-2 px-1 text-center text-[10px] leading-4 text-muted-foreground">
          AI can make mistakes. Verify important information.
        </p>
      </div>
    </section>
  );
}

export function ChatInput() {
  const dock = useAssistantDock();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [focusSignal, setFocusSignal] = useState(0);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Return focus to the launcher when the panel closes (Escape or the ×), so a
  // keyboard user is not dropped back at the top of the document.
  useEffect(() => {
    if (wasOpen.current && !open) launcherRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        setFocusSignal((n) => n + 1);
        return;
      }
      if (
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isTypingTarget(e.target)
      ) {
        e.preventDefault();
        setOpen(true);
        setFocusSignal((n) => n + 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const submit = useCallback(() => {
    const prompt = value.trim();
    if (!prompt || !dock) return;
    // Clear immediately: the chat surface takes over and owns the text from
    // here, so leaving it in the field would show the same prompt twice.
    setValue("");
    setOpen(false);
    dock.ask(prompt);
  }, [value, dock]);

  // A suggestion is just a prompt the user did not have to type — it takes the
  // exact same handoff to the assistant page.
  const onSubmitSuggestion = useCallback(
    (prompt: string) => {
      if (!dock) return;
      setValue("");
      setOpen(false);
      dock.ask(prompt);
    },
    [dock],
  );

  // Escape closes, but only while the panel is open — the handler stays off the
  // document otherwise so it never swallows Escape from a dialog above this.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
      {open ? (
        <AssistantPanel
          value={value}
          onChange={setValue}
          onSubmit={submit}
          onSuggestion={onSubmitSuggestion}
          onClose={() => setOpen(false)}
          focusSignal={focusSignal}
        />
      ) : (
        <AssistantLauncher onOpen={() => setOpen(true)} buttonRef={launcherRef} />
      )}
    </div>
  );
}
