"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

function cx(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(" ");
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  hideTitle?: boolean;
}

/* Notion-style modal: a centered popover on a soft scrim. The panel rises and
   settles on open — no layout pop. */
export function Dialog({ open, onClose, title, subtitle, children, className, hideTitle }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 pb-12 pt-[12vh]"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="fixed inset-0 animate-fade-in bg-black/40 backdrop-blur-[2px]" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || undefined}
        className={cx(
          "relative z-10 w-full animate-dialog-in rounded-lg border border-[var(--border)] bg-popover shadow-2xl",
          className || "max-w-lg",
        )}
      >
        {!hideTitle && (
          <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
            <div className="min-w-0">
              <h2 className="text-[14px] font-semibold leading-tight text-foreground">{title}</h2>
              {subtitle && <p className="mt-1 text-[12px] text-muted-foreground">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
              aria-label="Close"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className={cx(hideTitle ? "p-6" : "px-5 pb-5 pt-1")}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
