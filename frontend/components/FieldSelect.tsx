"use client";

import type { ReactNode } from "react";
import {
  Select as RadixSelect,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* A labelled Radix Select, for fields that live inside a Sheet. The in-house
   `ui/Select` portals its listbox to <body>, which a Radix dialog (the Sheet)
   makes inert by setting `pointer-events: none` on the body — so its options
   could not be clicked inside the sheet. The Radix-based Select composes as a
   nested layer, so it stays interactive and keeps the sheet open. */
export function FieldSelect({
  label,
  value,
  onChange,
  children,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  /** For the "nothing to pick yet" state — mirrors `ui/Select`'s `disabled`. */
  disabled?: boolean;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-foreground">{label}</span>
      <RadixSelect value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger disabled={disabled} className="h-9 w-full rounded-md border border-foreground/20 bg-card px-3 text-sm text-foreground outline-none transition-colors hover:border-foreground/35 focus:border-brand focus:ring-2 focus:ring-brand/20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </RadixSelect>
    </div>
  );
}

/* Radix reserves the empty string for its own placeholder, so an "Unassigned"
   / "None" row needs a sentinel value that is mapped back to "" on change. */
export const NONE = "__none__";