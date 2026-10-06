"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useSettingsDialog } from "@/components/settings/SettingsProvider";
import type { MemberDirectoryItem, PlanOut } from "@/lib/types";

/* ── Sidebar search ───────────────────────────────────────────────────────
   The magnifier in the sidebar header is not a button that *opens* search —
   it *becomes* search. Clicking it morphs the 28px control into a full-width
   field in place, and the same box morphs back on close, so the row never
   reflows and nothing pops.

   Geometry: the field is anchored to the right edge (right: 44px — the 8px
   header padding plus the 28px collapse button plus the 8px gap) and animates
   its *width*, growing leftward over the workspace switcher. Because the whole
   control is `absolute`, changing its width reflows nothing else — the layout
   work is one element, not the row.

   Motion: the width runs on a gently overshooting curve so the field lands
   with a little weight instead of easing politely into place; the icon, input
   and result panel each trail it by a few dozen milliseconds, which is what
   sells the morph as one physical object rather than three crossfades. */

const HEADER_PAD = 8; // px-2
const CONTROL = 28; // h-7 / w-7
const GAP = 8; // gap-2
const ANCHOR_RIGHT = HEADER_PAD + CONTROL + GAP; // right edge of the search control

/** Width morph: ~2% overshoot — enough to feel sprung, not enough to spill. */
const MORPH = "cubic-bezier(0.34, 1.06, 0.64, 1)";
/** Reveals: expo-out. Fast departure, long soft settle — the iOS-sheet feel. */
const SETTLE = "cubic-bezier(0.16, 1, 0.3, 1)";
const MORPH_MS = 380;

const SEARCH_ICON =
  "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z";
const MEMBER_ICON =
  "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z";
const PLAN_ICON =
  "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4";

/** Cap per record group so a big directory can't bury the page results. */
const RECORD_LIMIT = 5;

type Group = "Pages" | "Members" | "Plans";

interface NavEntry {
  href: string;
  label: string;
  icon: string;
}

interface Result {
  id: string;
  group: Group;
  label: string;
  hint?: string;
  icon: string;
  run: () => void;
}

interface SidebarSearchProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** The sidebar's already-resolved nav for the org's industry. */
  items: NavEntry[];
}

function cx(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function SidebarSearch({ open, onOpen, onClose, items }: SidebarSearchProps) {
  const router = useRouter();
  const settings = useSettingsDialog();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [members, setMembers] = useState<MemberDirectoryItem[] | null>(null);
  const [plans, setPlans] = useState<PlanOut[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Records load once per mount; later opens reuse them.
  const loaded = useRef(false);

  // Each open starts on a clean query with the cursor at the top. This is the
  // "adjust state when a prop changes" pattern — resetting during render, not
  // in an effect, so React re-renders before anything paints with stale values.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setActive(0);
    }
  }

  // Focus once the field has finished expanding — focusing a 28px-wide clipped
  // input mid-morph would scroll it into view and hitch the animation.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 140);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    // Best-effort: some roles can't read one or both, so each fails alone.
    void api.get<MemberDirectoryItem[]>("/members").then(setMembers).catch(() => setMembers([]));
    void api.get<PlanOut[]>("/plans").then(setPlans).catch(() => setPlans([]));
  }, [open]);

  // Click anywhere outside the morphed control puts it back.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onClose]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    // Nothing typed, nothing to show — the panel stays shut rather than
    // dumping the whole nav list the moment the field expands.
    if (!q) return [];
    const hit = (text: string) => text.toLowerCase().includes(q);

    const pages: Result[] = items
      .filter((item) => hit(item.label))
      .map((item) => ({
        id: `page:${item.href}`,
        group: "Pages" as const,
        label: item.label,
        icon: item.icon,
        // Settings is a modal, not a route (Notion-style) — same as the sidebar.
        run:
          item.href === "/app/settings"
            ? () => settings?.open()
            : () => router.push(item.href),
      }));

    const memberResults: Result[] = (members ?? [])
      .filter(
        (m) => hit(m.full_name ?? "") || hit(m.display_name ?? "") || hit(m.email),
      )
      .slice(0, RECORD_LIMIT)
      .map((m) => ({
        id: `member:${m.member_id}`,
        group: "Members" as const,
        label: m.display_name || m.full_name || m.email,
        hint: m.email,
        icon: MEMBER_ICON,
        run: () => router.push(`/app/members?member=${m.member_id}`),
      }));

    const planResults: Result[] = (plans ?? [])
      .filter((p) => hit(p.name))
      .slice(0, RECORD_LIMIT)
      .map((p) => ({
        id: `plan:${p.id}`,
        group: "Plans" as const,
        label: p.name,
        hint: `${p.currency} ${p.price}`,
        icon: PLAN_ICON,
        run: () => router.push("/app/plans"),
      }));

    return [...pages, ...memberResults, ...planResults];
  }, [query, items, members, plans, router, settings]);

  // The panel only exists once there is something to search for. An empty box
  // that drops a full nav list the instant you click it reads as a bug, not a
  // shortcut — so the field expands alone and the results wait for a keystroke.
  const showing = open && query.trim().length > 0;

  // The list can shrink under the cursor as you type. Clamped at render time
  // rather than in an effect, so the highlight is never a frame out of range.
  const cursor = results.length ? Math.min(active, results.length - 1) : 0;

  useEffect(() => {
    if (!showing) return;
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor, results, showing]);

  function choose(result: Result) {
    result.run();
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = results[cursor];
      if (picked) choose(picked);
    }
  }

  // Groups stay in fixed order; a heading only paints where the group changes.
  let lastGroup: Group | null = null;

  return (
    <div
      ref={rootRef}
      className="absolute top-0 z-20 flex h-11 items-center"
      style={{
        right: ANCHOR_RIGHT,
        width: open ? `calc(100% - ${ANCHOR_RIGHT + HEADER_PAD}px)` : CONTROL,
        transition: `width ${MORPH_MS}ms ${MORPH}`,
      }}
    >
      {/* The control itself: one box holding both faces. The icon shrinks away
          toward the centre while the input slides in behind it, so the swap
          reads as the same object turning over rather than two elements
          crossfading. */}
      <div
        className={cx(
          "relative h-7 w-full overflow-hidden rounded-md border",
          "transition-[background-color,border-color,box-shadow] duration-300 ease-out",
          open
            ? "border-[var(--border)] bg-secondary shadow-sm focus-within:border-[var(--border-strong)]"
            : "border-transparent bg-transparent",
        )}
      >
        <button
          type="button"
          onClick={onOpen}
          tabIndex={open ? -1 : 0}
          aria-label="Search"
          aria-hidden={open}
          title="Search (⌘K)"
          className={cx(
            "group absolute inset-0 flex items-center justify-center rounded-md text-muted-foreground",
            !open && "hover:bg-foreground/5 hover:text-foreground",
          )}
          style={{
            opacity: open ? 0 : 1,
            transform: open ? "scale(0.55)" : "scale(1)",
            transition: open
              ? `opacity 130ms ease-in, transform 260ms ${SETTLE}`
              : `opacity 220ms ${SETTLE} 90ms, transform 360ms ${MORPH} 70ms, background-color 150ms ease`,
          }}
        >
          {/* Press feedback lives on the glyph, not the button: the button's
              transform is driven inline by the morph, and an inline transform
              beats the `active:scale-*` utility. The child is free of it. */}
          <Icon
            d={SEARCH_ICON}
            className="h-4 w-4 transition-transform duration-100 group-active:scale-90"
          />
        </button>

        <div
          className="absolute inset-0 flex items-center gap-2 px-2"
          style={{
            opacity: open ? 1 : 0,
            transform: open ? "translateX(0)" : "translateX(-7px)",
            pointerEvents: open ? "auto" : "none",
            transition: open
              ? `opacity 240ms ${SETTLE} 110ms, transform 380ms ${SETTLE} 70ms`
              : `opacity 110ms ease-in, transform 170ms ease-in`,
          }}
        >
          <Icon d={SEARCH_ICON} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            tabIndex={open ? 0 : -1}
            placeholder="Search…"
            aria-label="Search pages, members and plans"
            className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Results hang off the header. Always mounted so the panel can animate
          both ways — visibility rides a zero-duration transition with a delay
          on hide, which keeps it painted through the fade but off the a11y
          tree and out of hit-testing the moment it is done. */}
      <div
        ref={listRef}
        aria-hidden={!showing}
        style={{
          transformOrigin: "top",
          opacity: showing ? 1 : 0,
          transform: showing ? "translateY(0) scaleY(1)" : "translateY(-6px) scaleY(0.96)",
          pointerEvents: showing ? "auto" : "none",
          transition: showing
            ? `opacity 200ms ${SETTLE}, transform 320ms ${SETTLE}, visibility 0s`
            : `opacity 130ms ease-in, transform 170ms ease-in, visibility 0s 130ms`,
        }}
        className={cx(
          "absolute left-0 right-0 top-full mt-1 max-h-[60vh] origin-top overflow-y-auto",
          "rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1",
          "shadow-lg shadow-black/10",
          !showing && "invisible",
        )}
      >
        {results.length === 0 && (
          <p className="px-3 py-5 text-center text-[12px] text-muted-foreground">
            No matches.
          </p>
        )}
        {results.map((result, i) => {
          const heading = result.group !== lastGroup ? result.group : null;
          lastGroup = result.group;
          return (
            <div key={result.id}>
              {heading && (
                <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold text-muted-foreground/80">
                  {heading}
                </p>
              )}
              <button
                type="button"
                data-active={i === cursor}
                onMouseMove={() => setActive(i)}
                onClick={() => choose(result)}
                className={cx(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left",
                  "transition-colors duration-100",
                  i === cursor ? "bg-foreground/[0.06]" : "",
                )}
              >
                <Icon d={result.icon} className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">
                  {result.label}
                </span>
                {result.hint && (
                  <span className="shrink-0 truncate text-[11px] text-muted-foreground">
                    {result.hint}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
