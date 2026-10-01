"use client";

import { Fragment, type ReactNode } from "react";
import { Glyph } from "@/components/Glyph";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ── RowMenu ──────────────────────────────────────────────────────────────
   The row actions menu used by every table page (from the plans page). Radix
   owns placement, flip/shift, focus return, Escape and outside-press; it
   portals to <body>, so a table's horizontal scroller can never clip it. A
   separator is inserted automatically before the first destructive run. */

export type RowAction = {
  label: string;
  /** Optional 16px glyph rendered as the item's leading icon. */
  icon?: ReactNode;
  onSelect: () => void;
  variant?: "default" | "destructive";
};

function KebabIcon() {
  return (
    <Glyph className="h-4 w-4">
      <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

export function RowMenu({ actions }: { actions: RowAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Row actions"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground data-[state=open]:bg-foreground/[0.06] data-[state=open]:text-foreground focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand/60"
        >
          <KebabIcon />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-44">
        {actions.map((a, i) => (
          <Fragment key={a.label}>
            {a.variant === "destructive" && i > 0 && actions[i - 1]?.variant !== "destructive" && (
              <DropdownMenuSeparator />
            )}
            <DropdownMenuItem variant={a.variant} onSelect={a.onSelect}>
              {a.icon}
              {a.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
