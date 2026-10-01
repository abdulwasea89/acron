"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAssistantChats } from "@/components/assistant/AssistantChats";
import { useAssistantDock } from "@/components/assistant/AssistantDock";

/* ── ChatInput ────────────────────────────────────────────────────────────
   The assistant's entry point on every dashboard page: a compact circular
   button in the bottom-right corner that expands into a horizontal prompt bar
   to its left.

   It starts a chat; it never renders one. Submitting hands the prompt to
   AssistantDock, which carries it to /app/assistant and navigates there — that
   page's ChatPanel creates the conversation and streams the reply, so exactly
   one code path talks to the model.

   The bar is anchored to the button (which stays put at the corner) and grows
   leftward, so the reveal reads as the circle stretching into a field rather
   than a panel dropping over the page. Position is viewport-relative (`fixed`);
   z-40 keeps it *below* dialogs, selects and menus (z-50), so opening a modal
   still wins the stacking order.

   Keyboard: ⌘K / Ctrl+K (or "/") opens the bar and focuses the field from
   anywhere on the page; "/" is ignored while the user is already typing in a
   field. Escape (or a click outside) collapses it. Enter sends. */

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

const PLACEHOLDER = "Ask anything about your plans…";

/* The button is 52px and the bar sits 8px to its left; both are 52px tall. */
const BUTTON_SIZE = 52;
const GAP = 8;

/* The expanded bar's length. A fixed 22rem felt cramped for a real prompt, so it
   scales with the viewport up to a comfortable reading width. Applied to both
   the clipping wrapper and the form inside it, which must stay the same width
   for the reveal to read as one box growing. */
const BAR_WIDTH =
  "w-[min(calc(100vw-6.5rem),22rem)] sm:w-[min(calc(100vw-6.5rem),28rem)] lg:w-[min(calc(100vw-6.5rem),34rem)]";

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M12 8.5 13.6 12l3.5 1.6-3.5 1.6L12 18.7l-1.6-3.5L6.9 13.6 10.4 12z" />
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

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

export function ChatInput() {
  const dock = useAssistantDock();
  const chats = useAssistantChats();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [focusSignal, setFocusSignal] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Return focus to the launcher when the bar collapses, so a keyboard user is
  // not dropped back at the top of the document.
  useEffect(() => {
    if (wasOpen.current && !open) launcherRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // Focus the field whenever the bar opens or the shortcut bumps the signal.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, focusSignal]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        setFocusSignal((n) => n + 1);
        return;
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target)) {
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
    // A bar prompt starts a fresh thread. If one is already open, the assistant
    // page would otherwise append to it and never consume the handed-over
    // prompt — so drop the active thread first.
    chats?.setActiveId(null);
    dock.ask(prompt);
  }, [value, dock, chats]);

  // Escape collapses the bar; so does a press outside it. Both handlers stay off
  // the document unless the bar is open, so Escape in a dialog above still wins.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const canSend = value.trim().length > 0;

  return (
    <div ref={containerRef} className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
      <div className="relative flex items-center justify-end">
        {/* The prompt bar: anchored to the left of the button, growing leftward.
            `overflow-hidden` + a fixed-width inner form means the reveal is a
            clean clip rather than the field reflowing as it widens. */}
        <div
          className={`absolute origin-right overflow-hidden transition-[width,opacity] duration-200 ease-out ${
            open ? `${BAR_WIDTH} opacity-100` : "w-0 opacity-0"
          }`}
          style={{ right: BUTTON_SIZE + GAP }}
        >
          <form
            onSubmit={(e) => { e.preventDefault(); submit(); }}
            className={`flex h-[52px] ${BAR_WIDTH} items-center gap-1.5 rounded-full border border-foreground/15 bg-popover pl-4 pr-1.5 shadow-xl shadow-black/25`}
          >
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={PLACEHOLDER}
              aria-label="Ask the assistant"
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand text-brand-foreground transition duration-150 hover:bg-brand/90 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand/60"
            >
              <SendIcon className="h-4 w-4" />
            </button>
          </form>
        </div>

        <button
          ref={launcherRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close the assistant" : "Open the assistant"}
          aria-expanded={open}
          className="relative flex h-[52px] w-[52px] cursor-pointer items-center justify-center rounded-full border border-foreground/15 bg-popover text-foreground shadow-xl shadow-black/25 transition duration-150 hover:border-foreground/25 hover:text-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand/60"
        >
          <span className="relative flex h-5 w-5 items-center justify-center">
            <SparkIcon
              className={`absolute h-5 w-5 transition-all duration-200 ease-out ${
                open ? "-rotate-45 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
              }`}
            />
            <CloseIcon
              className={`absolute h-4 w-4 transition-all duration-200 ease-out ${
                open ? "rotate-0 scale-100 opacity-100" : "rotate-45 scale-50 opacity-0"
              }`}
            />
          </span>
        </button>
      </div>
    </div>
  );
}
