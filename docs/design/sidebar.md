# Design: Sidebar

> The admin shell's left rail. This is the spec we build against — type sizes,
> heights, tokens, states, and the collapse rules. Every value here is read off
> the real code; if you change `Sidebar.tsx` or `OrgSwitcher.tsx`, change this
> file in the same commit.

**Source of truth**

| File | Owns |
|---|---|
| `frontend/components/Sidebar.tsx` | shell, header, quick row, section nav, footer, mobile header |
| `frontend/components/OrgSwitcher.tsx` | workspace tile + dropdown menu |
| `frontend/app/globals.css` | themes and `--radius-*` scale |
| `frontend/app/app/layout.tsx` | where `<Sidebar>` is mounted and what it's passed |

**Origin:** the rail follows the Notion settings chrome — a flat surface, small
muted labels, `foreground`-alpha hovers, and a single low-contrast fill for the
active row. It deliberately **does not** use the solid brand pill that
`DESIGN.md` §10.3 prescribes (see [Divergences](#9-divergences-from-designmd)).

---

## 1. Anatomy

```
┌───────────────────────────────┐
│ [J] jvwn               «      │  h-11  header: workspace switcher + collapse
├───────────────────────────────┤
│ ⌂  💬  📊                     │  h-8   quick-icon row (Overview group)
│                               │
│ Operations                    │  text-[11]  section label
│ ▪ Space plans                 │  h-8   nav row (active)
│   Desks & rooms               │  h-8
│   Seat-holders                │
│                               │
│ Money                         │
│   Invoices · Payments · …     │
│                               │
│ Organization                  │
│   Staff · Audit · Settings    │
├───────────────────────────────┤
│ ( New chat )              (✎) │  h-9   footer: assistant shortcuts
│ ⌐ Sign out                    │
└───────────────────────────────┘
```

Collapsed (`lg:w-[52px]`) the same tree renders as a rail — sections keep their
grouping but lose their labels, every row becomes a centred square, and the
workspace switcher drops out of the header onto its own row.

---

## 2. Shell geometry

```tsx
<aside className="hidden lg:sticky lg:top-0 lg:z-30 lg:flex lg:h-screen
                  lg:shrink-0 lg:flex-col
                  border-r border-foreground/10 bg-surface
                  transition-[width] duration-150
                  lg:w-64  |  lg:w-[52px]" />
```

| Property | Expanded | Collapsed |
|---|---|---|
| Width | `lg:w-64` — **256px** | `lg:w-[52px]` |
| Vertical | `lg:sticky lg:top-0 lg:h-screen` | same |
| Background | `bg-surface` (a token — see §5) | same |
| Right edge | `border-r border-foreground/10` | same |
| Transition | `transition-[width] duration-150` | same |
| Below `lg` | `hidden` — `MobileNavigation` takes over | — |

**`lg:z-30` is load-bearing, not decoration.** `sticky` creates a stacking
context, so the workspace menu's `z-50` is trapped inside it. Without a
z-index the aside shares the `z-auto` band with the content column, which comes
*later* in the DOM and therefore paints over it — page cards cover the open
menu. `z-30` also stays below the assistant bar (`z-40`), page popovers
(`z-50`), and the settings modal (`z-[70]`).

**No frosted glass.** `DESIGN.md` §10.2 specifies `bg-background/70 backdrop-blur`
for the rail; Acron uses the flat `bg-surface` token instead.

---

## 3. Height ladder

Every control in the rail sizes off one of five heights. Stick to these — a
new element picks the height of the row it lives in.

| Element | Class | px |
|---|---|---|
| Header row | `h-11` | 44 |
| Workspace trigger (expanded) | `h-9` | 36 |
| New chat pill | `h-9` | 36 |
| Quick-icon item / nav row | `h-8` | 32 |
| Workspace tile button (collapsed) | `h-8` | 32 |
| Collapse button | `h-7` | 28 |

---

## 4. Typography

Four voices. Sizes are hard-coded (no `text-*` scale token) so they stay stable
across the rail's narrow measure.

| Element | Classes | Notes |
|---|---|---|
| Brand wordmark (mobile only) | `font-display text-lg leading-none tracking-tight` | serif; the desktop brand row no longer exists |
| Workspace name | `text-[13px] font-medium text-foreground` | only sans-bold-ish text in the rail |
| Nav row label | `text-sm` | inherits `text-muted-foreground` → `text-foreground` on active/hover |
| Section label | `text-[11px] font-semibold text-muted-foreground/80` | **sentence case, sans** — see §9 |
| Sign out | `text-[13px] text-muted-foreground` | |
| Menu row | `text-[13px] text-foreground` | |
| Menu subtitle | `text-[11px] text-muted-foreground` | e.g. `Pro Plan · 12 members` |
| Mobile org line / Sign out | `font-mono text-[11px] uppercase tracking-widest` | the only mono caps in the shell |
| Mobile chip | `text-[13px]` | |

**Rule:** the desktop rail uses **no mono and no uppercase**. Mono caps are
reserved for the mobile header and for page-level breadcrumbs/table headers.
This is the single biggest typographic difference from the rest of the design
system.

---

## 5. Color & surfaces

### Tokens the rail uses

| Token | Applied to |
|---|---|
| `bg-surface` | the `<aside>` itself |
| `bg-secondary` | New chat pill, compose button |
| `bg-brand` | mobile brand dot, mobile active chip |
| `border-foreground/10` | the rail's right hairline |
| `var(--border)` | menu border, menu dividers |
| `text-muted-foreground` | idle rows, icons, secondary text |
| `text-foreground` | active rows, workspace name, menu rows |

### Alpha-derivation (the whole hover system)

The rail never names a gray. Every state is `foreground` at low alpha:

| State | Class |
|---|---|
| Active row fill | `bg-foreground/[0.06]` |
| Hover fill (rows, buttons) | `hover:bg-foreground/5` |
| Hover fill (New chat pill) | `hover:bg-foreground/10` |
| Idle nav icon | `text-foreground/50` |
| Active nav icon | `text-foreground/80` |
| New chat label (idle) | `text-foreground/70` |

### `bg-surface` moves with the theme — check both

This trips people up, because `--surface` is not consistently "lighter than the
page":

| Theme | `--background` | `--surface` | Sidebar reads as |
|---|---|---|---|
| `:root` (light) | `oklch(0.985 0.002 90)` | `oklch(1 0 0)` | **lighter** than the page |
| `.notion` | `#ffffff` | `#f7f7f5` | **darker** than the page |
| `.dark` | `oklch(0.17 0.006 90)` | `oklch(0.21 0.008 90)` | lighter (raised) |
| `.midnight` | `oklch(0.16 0.012 165)` | `oklch(0.205 0.014 165)` | lighter (raised) |

So any new sidebar surface must use the token, never a literal — and should be
eyeballed in **both light and notion**, which disagree about which side of the
page the rail sits on.

### Workspace tile palette

Name-hashed, so one workspace keeps its color everywhere. 7 colors, picked by
`hash(name) % 7`:

```
#e03e3e  #d9730d  #cb912f  #448361  #2383e2  #9065d0  #c14c8a
```

Tile = `h-6 w-6 rounded-md`, white initial, `text-[11px] font-semibold`.
In the menu the workspace name sits on a chip tinted with **that same color at
8% alpha** (`${tileColor(name)}14`) — the only place a raw hex enters the rail.

---

## 6. Component recipes

### 6.1 Header row

```tsx
<div className={cx("flex h-11 shrink-0 items-center px-2",
                  collapsed ? "justify-center" : "gap-2")}>
  {!collapsed && <div className="min-w-0 flex-1"><OrgSwitcher … /></div>}
  <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md
                     text-muted-foreground transition-colors
                     hover:bg-foreground/5 hover:text-foreground" />
</div>
```

Expanded: switcher is `flex-1`, collapse button pinned right.
Collapsed: `justify-center`, **only** the button — 52px has no room for both
side by side, and pushing them together drags the tile off the nav icons'
centre line. The tile moves to its own row right below:

```tsx
{collapsed && <div className="px-2 pb-1"><OrgSwitcher … compact /></div>}
```

**Collapse button:** icon is a double chevron-left
(`M18.75 19.5l-7.5-7.5 7.5-7.5M12.75 19.5l-7.5-7.5 7.5-7.5`) at `h-4 w-4`,
and gets `rotate-180` when collapsed so it always points "outward".
`aria-label` flips between `Expand sidebar` / `Collapse sidebar`.

### 6.2 Nav row (the core pattern)

```tsx
className={cx(
  "flex h-8 items-center rounded-md text-sm transition-colors",
  collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
  active
    ? "bg-foreground/[0.06] font-medium text-foreground"
    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
)}
```

- Icon: `h-4 w-4 shrink-0`, `text-foreground/80` when active, `text-foreground/50` idle.
- Active rows carry `aria-current="page"`; every row carries `title={label}` so
  the collapsed rail still has tooltips.
- Label is hidden when collapsed (`{!collapsed && item.label}`).
- Rows sit in a `space-y-0.5` list inside a `mb-3` group.

**Settings is a `<button>`, not a `<Link>`** — it opens the settings modal
rather than navigating. Same row classes, plus `w-full text-left`.

### 6.3 Quick-icon row (Overview group)

```tsx
<div className={cx("flex items-center gap-0.5 px-2 pt-1", collapsed && "flex-col")} />
```

Same `h-8 rounded-md` row, but idle items are a fixed **`w-8` square** and the
active one is the only one that grows to show its label:

```tsx
active
  ? cx("gap-2 bg-foreground/[0.06] font-medium text-foreground",
       collapsed ? "w-8 justify-center px-0" : "px-2.5")
  : "w-8 justify-center text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
```

Icons here are `h-[18px] w-[18px]` — one step up from the nav's 16px, because
they stand alone without labels.

### 6.4 Section label

```tsx
<p className="px-2.5 pb-1 text-[11px] font-semibold text-muted-foreground/80">{group}</p>
```

Rendered only when `!collapsed`. Groups in order: `Operations`, `Money`,
`Organization` (`OVERVIEW` is the quick row above, which renders no label).

### 6.5 Footer

```tsx
<div className="shrink-0 p-2">
  <div className={cx("flex items-center gap-1.5", collapsed && "flex-col")} />
  <button /* Sign out */ className="mt-0.5 …" />
</div>
```

- **New chat** — `h-9 rounded-full bg-secondary text-sm text-foreground/70`.
  Expanded: `flex-1 gap-2 px-3` with a label. Collapsed: `w-9 justify-center`.
  This is one of the rail's few pills — curvature is reserved for it and the
  compose button beside it.
- **Compose** (`✎`) — `h-9 w-9 rounded-full bg-secondary`, expanded only.
- **Sign out** — `rounded-md text-[13px] text-muted-foreground`; expanded
  `w-full gap-2.5 px-2.5 py-2`, collapsed `h-9 w-full justify-center px-0`.
  Square, not a pill: it is a row, not an action.

### 6.6 Workspace menu (`OrgSwitcher`)

```tsx
<div className="absolute left-0 top-full z-50 mt-1 w-64 animate-fade-in
                rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1
                shadow-lg shadow-black/10" />
```

- Trigger (expanded): `h-9 w-full rounded-md px-2` with tile + name + chevron.
- Trigger (collapsed): `mx-auto h-8 w-8 rounded-md`, tile only.
- Chevron: **single** `M19.5 8.25l-7.5 7.5-7.5-7.5` at `h-3.5 w-3.5`, rotating
  180° when open. (A double up/down chevron was tried and rejected — two chevrons
  in a 24-unit viewBox blur into a blob at 14–16px.)
- Menu rows: `flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px]`
  with a `h-4 w-4` muted icon; hover `hover:bg-foreground/5`.
- Section breaks: `<div className="my-1 h-px bg-[var(--border)]" />`.
- Portals nowhere — it's `absolute` inside a `relative` wrapper, so it inherits
  the aside's `z-30` context. **Do not portal this menu to `<body>`** without
  revisiting the z-index story in §2.

---

## 7. Icon system

One inline helper, used everywhere in the rail:

```tsx
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
     strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
```

Sizes: `h-[18px]` quick row · `h-4 w-4` nav rows, menu rows, sign out ·
`h-3.5 w-3.5` the workspace chevron · `h-2 w-2` the mobile brand dot.

Stroke is `1.75` — not `2`. Bumping it makes the rail's 16px icons look heavy
against the hairlines.

---

## 8. Mobile (`< lg`)

The rail is `hidden`; `MobileNavigation` renders instead.

- Header: `sticky top-0 z-20 border-b border-foreground/10 bg-background/80 backdrop-blur`,
  inner `flex h-14 items-center gap-3 px-4`.
- Brand lockup: `h-2 w-2 rounded-full bg-brand` dot + `font-display text-lg` wordmark.
- Org line: right-aligned `font-mono text-[11px] uppercase tracking-widest`.
- Page nav: a horizontally scrollable chip strip
  (`no-scrollbar flex items-center gap-1.5 overflow-x-auto px-4 pb-2.5`),
  chips `h-8 rounded-full px-3.5 text-[13px]`.
- **Active chip is a solid brand pill** (`bg-brand text-brand-foreground`) —
  unlike the desktop rail's `foreground/[0.06]`. §9 explains why.
- The strip auto-centres the active chip on navigation via `scrollIntoView`.

---

## 9. Divergences from `DESIGN.md`

`DESIGN.md` documents a different app (Lexsus marketing + admin). Three of its
rules do **not** hold in Acron's rail. Follow this file, not those sections:

| `DESIGN.md` says | Acron does | Where |
|---|---|---|
| §10.3 active nav = **solid brand pill** (`bg-brand text-brand-foreground`) | Active = `bg-foreground/[0.06] font-medium` | desktop nav + quick rows |
| §6.6 / §2 labels are **mono caps, letterspaced** | Section labels are **sans, sentence case**, `text-[11px] font-semibold` | section groups |
| §10.2 rail = `bg-background/70 backdrop-blur` | Rail = flat `bg-surface` | the `<aside>` |

The solid brand pill survives only in the **mobile** chip strip. The desktop
rail contains **no brand green at all** — `bg-brand` appears exactly twice in
`Sidebar.tsx` (line 357, the mobile brand dot; line 383, the mobile active
chip), both inside `MobileNavigation`, and never in `OrgSwitcher.tsx`.
Everything in the desktop rail is `foreground` alpha.

---

## 10. Checklist for a new sidebar element

- [ ] Picked a height from the §3 ladder (`h-11` / `h-9` / `h-8` / `h-7`) — no new heights.
- [ ] Type size from §4; **no mono, no uppercase** on desktop.
- [ ] Surfaces use `bg-surface` / `bg-secondary`; hover+active use `foreground` alpha, never a named gray.
- [ ] Active state is `bg-foreground/[0.06] font-medium text-foreground` — resist the brand pill.
- [ ] Whole row is the hit target (`h-8` + `rounded-md`), and it carries `title`.
- [ ] Renders correctly collapsed: label hidden, content centred, `px-0`.
- [ ] Icon at `h-4 w-4` (or `h-[18px]` if standalone), `strokeWidth 1.75`.
- [ ] Checked in **light** *and* **notion** — `--surface` flips sides between them (§5).
- [ ] If it introduces a new layer, re-read §2 before adding a z-index.
