"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { gymStatusLabel, gymStatusTone } from "@/lib/format";
import type { GymStatus } from "@/lib/types";

function cx(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(" ");
}

const STATUS_DETAILS: { value: GymStatus; description: string }[] = [
  { value: "open", description: "Accepting members" },
  { value: "closed", description: "Not accepting anyone" },
  { value: "half_day", description: "Limited hours today" },
];

const DOT_COLORS: Record<string, string> = {
  open: "bg-[var(--success)]",
  closed: "bg-[var(--danger)]",
  half_day: "bg-[var(--warning)]",
};

const BG_COLORS: Record<string, string> = {
  open: "bg-[var(--success-bg)] text-[var(--success)] hover:bg-[var(--success-bg)]",
  closed: "bg-[var(--danger-bg)] text-[var(--danger)] hover:bg-[var(--danger-bg)]",
  half_day: "bg-[var(--warning-bg)] text-[var(--warning)] hover:bg-[var(--warning-bg)]",
};

export function GymStatusToggle({
  initialStatus,
  onStatusChange,
}: {
  initialStatus: GymStatus;
  onStatusChange?: (status: GymStatus) => void;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function select(value: GymStatus) {
    if (value === status) {
      setOpen(false);
      return;
    }
    setLoading(value);
    const prev = status;
    setStatus(value);
    try {
      await api.patch("/organizations/me/gym-status", { gym_status: value });
      onStatusChange?.(value);
    } catch {
      setStatus(prev);
    } finally {
      setLoading(null);
      setOpen(false);
    }
  }

  const tone = gymStatusTone(status);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={cx(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
          BG_COLORS[status],
        )}
      >
        <span className={cx("h-2 w-2 rounded-full", DOT_COLORS[status])} />
        <span className="flex-1 text-left">{gymStatusLabel(status)}</span>
        <svg
          className={cx(
            "h-3.5 w-3.5 transition-transform duration-150",
            open && "rotate-180",
          )}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 animate-scale-in rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-lg">
          {STATUS_DETAILS.map((item) => {
            const isActive = status === item.value;
            return (
              <button
                key={item.value}
                type="button"
                disabled={loading !== null}
                onClick={() => select(item.value)}
                className={cx(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left transition-colors",
                  isActive
                    ? "bg-[var(--primary-light)]"
                    : "hover:bg-[var(--background)]",
                )}
              >
                <span
                  className={cx(
                    "h-2 w-2 shrink-0 rounded-full",
                    DOT_COLORS[item.value],
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={cx(
                      "text-sm font-medium leading-tight",
                      isActive
                        ? "text-[var(--foreground)]"
                        : "text-[var(--foreground-muted)]",
                    )}
                  >
                    {gymStatusLabel(item.value)}
                  </div>
                  <div className="text-[11px] text-[var(--muted)] leading-tight">
                    {item.description}
                  </div>
                </div>
                {isActive && (
                  <svg
                    className="h-3.5 w-3.5 shrink-0 text-[var(--foreground)]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
                {loading === item.value && (
                  <svg
                    className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--muted)]"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
