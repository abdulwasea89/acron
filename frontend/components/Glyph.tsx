import type { ReactNode } from "react";

/** Consistent stroke-icon wrapper: one stroke voice, sizing left to the
 *  consumer via `className`. */
export function Glyph({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
