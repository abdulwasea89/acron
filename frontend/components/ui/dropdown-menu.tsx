"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"

function cn(...inputs: (string | false | null | undefined)[]) {
  return inputs.filter(Boolean).join(" ")
}

/* ── DropdownMenu ─────────────────────────────────────────────────────────
   shadcn-shaped wrapper over Radix, styled to match ui/select.tsx so a menu and
   a select opened side by side are the same surface.

   Radix is doing the work the old hand-rolled popover did not: the menu portals
   to the body, flips and shifts to stay in the viewport, traps focus, returns
   focus to the trigger on close, and closes on Escape / outside-press / scroll
   of an ancestor. The previous implementation positioned itself with
   `position: fixed` at `rect.bottom + 4` and a `spaceBelow < 140` guess, which
   is why it read as "a div stuck under the button" — it could not flip on the
   real available height, and it left the trigger's focus ring behind.

   Width and rhythm follow the table-row spec: 176px wide, 4px of padding, 32px
   rows, 16px icons. */

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuGroup = DropdownMenuPrimitive.Group
const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[11rem] overflow-hidden rounded-lg border border-[var(--border)] bg-popover p-1 shadow-lg shadow-black/10",
        // Collision-aware height before the menu starts scrolling.
        "max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto",
        "data-[state=open]:animate-pop-in",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

/**
 * `variant="destructive"` tints the row and its icon with the danger colour.
 * It does not use a red background — only the label and glyph carry the tone,
 * so a menu with two dangerous rows does not read as a warning panel.
 */
const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    variant?: "default" | "destructive"
  }
>(({ className, variant = "default", ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] leading-5 outline-none transition-colors",
      "[&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
      variant === "default" &&
        "text-foreground [&>svg]:text-[var(--muted-foreground)] data-[highlighted]:bg-foreground/[0.06]",
      variant === "destructive" &&
        "text-danger data-[highlighted]:bg-danger-bg data-[highlighted]:text-danger",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuLabel = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn("px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground", className)}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-[var(--border)]", className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
}
