/* ── Table design ─────────────────────────────────────────────────────────
   The list-table language used across the app, taken from the plans table:
   borderless, one hairline under each row, a quiet uppercase header, and a
   single column gutter. Import the pieces and add only per-column width or
   alignment; the shared parts must not be restyled per page or the pages drift
   apart again.

   Gutters: the first column carries only right padding and the last only left
   padding, so the row's content aligns to the table's own edges. Middle columns
   are padded on both sides. */

export const TABLE = "w-full text-sm";

export const THEAD_ROW =
  "text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground";

/** Header cell. Pair with FIRST_CELL / LAST_CELL / CELL for the column's gutter. */
export const TH = "pb-3 font-medium";

/** Body row: the hairline separator, and no border on the last row. */
export const TR = "border-b border-foreground/[0.06] last:border-0";

/** Add to TR when the whole row is a click target. */
export const TR_INTERACTIVE = "cursor-pointer transition-colors hover:bg-foreground/[0.02]";

/** Body cell. Always pair with a gutter class and `py-*`. */
export const TD = "align-middle";

/** Column gutters. */
export const CELL = "px-4"; // middle columns
export const CELL_FIRST = "pr-4"; // first column
export const CELL_LAST = "pl-4"; // last column
