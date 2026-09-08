"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

export type MenuAction = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
};

function KebabIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}

/** Row actions popover — a shared clone of the per-page kebab used on the
 *  members/plans pages, so the office pages don't each re-implement it. */
export function KebabMenu({ actions }: { actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function toggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const flipUp = spaceBelow < 140;
      setPos({
        left: Math.max(8, rect.right - 130),
        top: flipUp ? rect.top - 4 : rect.bottom + 4,
      });
    }
    setOpen((s) => !s);
  }

  return (
    <div ref={menuRef} className="relative inline-flex items-center">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-[var(--foreground)]"
        aria-label="Row actions"
      >
        <KebabIcon />
      </button>
      {open && (
        <div
          style={{ left: pos.left, top: pos.top, position: "fixed" }}
          className="z-50 min-w-[130px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
        >
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => { setOpen(false); a.onClick(); }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                a.danger
                  ? "text-danger hover:bg-danger-bg"
                  : "text-[var(--foreground)] hover:bg-[var(--background)]"
              }`}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
