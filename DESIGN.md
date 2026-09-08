# DESIGN.md — Lexsus / Zhilo Labs visual system

> A working reference for the Lexsus marketing site **and** its admin dashboard, distilled from the
> real code (`app/globals.css`, `app/layout.tsx`, `components/**`). Reuse these tokens, type styles,
> spacing rules and component recipes to build new pages, sections, or a whole new app that feels
> native to this product.

**Stack:** Next.js 16 App Router + React 19, Tailwind CSS **v4** (CSS-first config — there is no
`tailwind.config.js`; tokens live in CSS), `next-themes`, `lucide-react` icons, shadcn/ui primitives
in `components/ui/`.

**Source of truth files**
- `app/globals.css` — all themes, tokens, keyframes, utilities (`styles/globals.css` is a stale v0
  leftover with Geist — **do not use it**).
- `app/layout.tsx` — font loading + `<ThemeProvider>` wiring.
- `components/landing/content-shell.tsx` — the canonical inner-page frame.
- `app/admin/(dashboard)/layout.tsx` — the canonical dashboard frame.

---

## 1. Design personality (read this first)

1. **Editorial-technical.** Headlines and display type are a **serif** (Instrument Serif, one weight);
   body is a quiet **sans**; everything meta/technical/label-like is a **monospace**. Three voices, no more.
2. **Green-tinted dark is the default.** The shipped theme is **midnight** (a green-hued near-black),
   not a neutral dark. Accent = a single **green** (`--brand`), used sparingly on top of near-black.
3. **Hairlines everywhere.** Divider lines are `border-foreground/10` (sections, tables, cards) and
   `border-foreground/5` (row-to-row). Borders are **almost always 1px, low-alpha, color-derived** —
   rarely solid black/gray.
4. **Sharp + pill, no middle ground.** Global radius is tuned *down* to ~0–8px (panels, tables,
   inputs feel square/surgical), while the only strong curvature is **`rounded-full`** — CTAs, filter
   chips, theme toggle, pager buttons, the waitlist input. Pills are the "friendly action", squares
   are the "data".
5. **Micro-labels in mono caps.** Section eyebrows, admin breadcrumbs, table headers and stat labels
   all use the same voice: `font-mono`, `uppercase`, `tracking-widest`, tiny (`text-[10px]`–`text-xs`),
   `text-muted-foreground`.
6. **Copy is secondary-colored.** Paragraphs / descriptions are **`text-muted-foreground`**, never raw
   `foreground`; `text-foreground` is reserved for headings, primary text, interactive elements.
7. **Quiet decoration.** A subtle film-grain (`noise-overlay`), faint hairline grids, animated
   stroke-style SVG line art, and drifting word/letter reveals. Nothing loud — texture over color.

---

## 2. Fonts & typography

Loaded in `app/layout.tsx` via `next/font/google` and exposed as CSS vars → Tailwind families in
`@theme inline`. The `<body>` carries `font-sans antialiased`.

| Role | Family | CSS var | Tailwind class | Notes |
|---|---|---|---|---|
| Body / UI | **Instrument Sans** | `--font-instrument` | `font-sans` | default body font |
| Display / headings | **Instrument Serif** | `--font-instrument-serif` | `font-display` | loaded **weight 400 only** — rely on size/leading for hierarchy, not weight |
| Meta / mono | **JetBrains Mono** | `--font-jetbrains` | `font-mono` | labels, code, numbers, breadcrumbs |

```css
--font-sans:     var(--font-instrument), 'Instrument Sans', system-ui, sans-serif;
--font-mono:     var(--font-jetbrains), 'JetBrains Mono', monospace;
--font-display:  var(--font-instrument-serif), 'Instrument Serif', Georgia, serif;
```

### Type rules of thumb
- **Display headings:** `font-display tracking-tight`. Instrument Serif at one weight needs tight
  tracking to feel set. Leading is deliberately compact on big headlines (`leading-[0.9]`–`leading-[1.02]`).
- **Body copy:** `text-base`–`text-lg`, `leading-relaxed`, `text-muted-foreground`, capped measure
  `max-w-[72ch]` (reading) or `max-w-xl`/`max-w-[46ch]` (short intros). You will **not** see
  `text-foreground` on paragraphs.
- **Never put `font-medium`/`font-semibold` on a serif display headline** — serif is 400 only;
  weight contrast belongs to the sans UI text.
- **Bold in copy:** Instrument Sans `font-semibold text-foreground` (see `md-components` `strong`).
- **Tabular numbers** (`tabular-nums`) on counts, page positions, pagination.

### Observed scale (from real pages)
| Element | Classes |
|---|---|
| Landing hero H1 | `text-[clamp(2.75rem,9vw,8rem)] font-display leading-[0.9] tracking-tight` |
| Landing section H2 | `text-4xl lg:text-6xl font-display tracking-tight` |
| Landing card H3 | `text-3xl lg:text-4xl font-display` (features) / `text-xl md:text-[1.5rem] leading-tight` (role title) |
| Inner page H1 (`ContentShell`) | `text-4xl lg:text-6xl font-display tracking-tight leading-[1.02]` |
| In-page H2 (editorial) | `text-xl lg:text-2xl font-display tracking-tight text-foreground` |
| Admin page H1 | `text-3xl font-display tracking-tight` |
| Admin stat number | `text-3xl lg:text-4xl font-display tracking-tight` |
| Markdown H1–H4 | `text-xl/2xl → text-base/lg`, `font-display tracking-tight text-foreground pt-2` |
| Body paragraph | `text-base`–`text-lg leading-relaxed text-muted-foreground` |
| Nav logo | `font-display tracking-tight text-xl`–`text-2xl` |
| Mobile-menu links | `text-5xl font-display text-foreground` |

### The mono micro-label system (very signature — reuse constantly)
```jsx
// Landing / section eyebrow
<span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
  <span className="w-8 h-px bg-foreground/30" />   {/* short dash before the word */}
  Capabilities
</span>

// Admin page breadcrumb
<p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
  /admin/leads
</p>

// Stat tile label
<p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-3">…</p>

// Table column header
<th className="px-5 py-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">…</th>
```

**Inconsistency tolerated on purpose:** landing eyebrows are `text-sm` *not* uppercase; dashboard
labels are `text-[10px]/[11px]` uppercase. Keep the **font-mono + muted + letter-spaced** voice and
match the surrounding page's case/size.

---

## 3. Color & themes

Five themes; default is **midnight**. All except solarized/oled are declared in **OKLCH** (lightness
chroma hue), so a "theme" is really a **hue ramp** — the same token table re-hued.

| Theme | Class | Palette idea | Accent (`--brand`) |
|---|---|---|---|
| **midnight** (default) | `.midnight` | green-tinted near-black | soft green `oklch(0.72 0.16 155)` |
| dark | `.dark` | warm charcoal (hue 90) | mid green `oklch(0.62 0.15 152)` |
| light | `:root` | warm off-white | deeper green `oklch(0.52 0.15 152)` |
| solarized | `.solarized` | classic sand (`#fdf6e3`) | signature blue `#268bd2` |
| oled | `.oled` | pure black `#000` | neon cyan `#22d3ee` |

The site mostly uses **semantic tokens** (`bg-background`, `text-muted-foreground`, `border-foreground/10`,
`bg-brand`) which re-theme automatically. `dark:` Tailwind variants only fire under `.dark`
(`@custom-variant dark`), **not** midnight/oled — so prefer tokens, and only use `dark:` for the few
`components/ui` shadcn primitives that carry them.

### Midnight palette (the look you actually ship)
| Token | OKLCH | Reads as |
|---|---|---|
| `--background` | `0.16 0.012 165` | near-black, faint green cast |
| `--foreground` | `0.95 0.008 160` | near-white text |
| `--card` / `--popover` | `0.205 0.014 165` | raised panel |
| `--secondary` / `--muted` / `--accent` | `0.26 0.016 165` | hover/fill layer |
| `--muted-foreground` | `0.72 0.016 165` | secondary copy |
| `--border` / `--input` | `0.31 0.014 165` | hairline |
| `--ring` | `0.6 0.03 165` | focus ring |
| `--destructive` | `0.62 0.18 25` | red (kept red across themes) |
| **`--brand`** | **`0.72 0.16 155`** | accent green |
| **`--brand-foreground`** | `0.16 0.03 155` | dark green text on brand fills |

### Using the accent
- Brand fills: `bg-brand text-brand-foreground` (buttons, active chips, active nav).
- Brand accents on dark bg: `text-brand`, `border-brand/50`, dots `bg-brand`.
- Brand-tinted surface (the "highlight" card): `border-brand/40 bg-brand/[0.04]`.
- On dark themes, `--brand` is *lighter* (0.72) than on light (0.52) so it reads on near-black.
- **Never** use raw Tailwind `green-*` for brand (only the tiny "all systems operational" dot does).

### Alpha-derivation pattern (color lives through alpha)
Because bg is near-black, "gray" is really `foreground` at low alpha. Memoize this:
`border-foreground/10` lines · `border-foreground/5` row rules · `hover:bg-foreground/[0.02]` row hover ·
`bg-foreground/[0.07]` inline code · `bg-background/80`/`/90` frosted bars. This is how every surface
in this app is derived — few raw colors, many alphas of foreground.

---

## 4. Radius, borders, shadows

```css
:root { --radius: 0.25rem; }          /* 4px  → sm:0 md:2px lg:4px xl:8px (near-square) */
```
- Default panels/tables/inputs are **square-ish**: `border border-foreground/10` with no/little radius.
- Strong curve = **pills**: `rounded-full` on CTAs, chips, toggles, pager, the email input.
- Admin inputs & sidebar items use `rounded-lg` (~4px) — barely there.
- **Shadows are essentially unused.** Depth = hairline borders + subtle `backdrop-blur` on sticky/fixed
  bars (`bg-background/80 backdrop-blur-xl` nav, `bg-background/70 backdrop-blur` sidebar).
- Focus: `focus:border-brand` on inputs; `focus-visible:ring-ring/50 ring-[3px]` on shadcn controls;
  never default browser outlines.

---

## 5. Spacing, grids, page geometry

Base unit is Tailwind's 4px scale (`px-6` = 24px, `py-12` = 48px …). **No custom spacing tokens.**

### Page containers (memorize these three widths)
| Surface | Container | Padding | Notes |
|---|---|---|---|
| Landing sections | `max-w-[1400px] mx-auto` | `px-6 lg:px-12` | hero/footer/nav/footer inner all use it; footer uses `lg:px-12` |
| Inner content pages (`ContentShell`) | `max-w-[1400px] mx-auto` | `px-6 lg:px-12 pt-36 pb-24 lg:pt-44 lg:pb-32` | `pt-*` clears the **fixed** nav (~112–176px) |
| Reading column | `max-w-[72ch] mx-auto` | — | applied to the same element as the shell container when `prose` |
| Admin content | `max-w-[1240px] mx-auto` | `px-5 sm:px-8 py-8 lg:py-10` | narrower than the marketing shell |

### Vertical rhythm
- Landing section block: `py-24 lg:py-32`.
- Landing section header → first row gap: `mb-16 lg:mb-24`.
- Editorial page body blocks: parent `space-y-8`, paragraphs `leading-relaxed`.
- Hero: `min-h-screen`, inner `pt-28 pb-16 lg:pt-40 lg:pb-64` (large bottom pad for the marquee).
- Feature rows (each a bordered unit): `flex gap-8 lg:gap-16 py-12 lg:py-20 border-b border-foreground/10`.
- Footer top block: `py-16 lg:py-24`; bottom bar: `py-8`.

### Grid conventions
- 12-col for dense/technical layouts: careers table `grid grid-cols-12 gap-4` with defined `col-span-*`.
- Marketing 2-up: `grid lg:grid-cols-2 gap-12 lg:gap-24 items-end` (hero intro split).
- Footer link columns: `grid grid-cols-2 md:grid-cols-6 gap-12 lg:gap-8` (brand col `col-span-2`).
- Admin stats: `grid grid-cols-2 lg:grid-cols-4 gap-4`; quick links `grid sm:grid-cols-2 gap-4`.
- Generous gaps are part of the look: marketing gaps 24–96px, dashboard gaps 16px.

---

## 6. Components — anatomy + recipes

### 6.1 Navigation (fixed, transforms on scroll)
`header fixed z-50` + a `nav` that morphs when `scrollY > 20`:
- At top: transparent, `max-w-[1400px]`, inner bar `h-20`, logo `text-2xl`.
- Scrolled: `top-4 left-4 right-4` (detached floating pill card), `rounded max-w-[1200px] bg-background/80 backdrop-blur-xl border border-[#8a8a8a]`, inner `h-14`, logo `text-xl`.
- Desktop links: `text-sm text-foreground/70 hover:text-foreground` with an animated underline
  (`w-0 group-hover:w-full h-px bg-foreground` under each).
- Mobile = full-screen overlay, links `text-5xl font-display`, staggered `75ms` fade/translate.
- Logo lockup = brand dot + serif wordmark + tiny mono `TM`: `font-display tracking-tight` name next
  to a `w-2 h-2 rounded-full bg-brand` dot.

### 6.2 Buttons
Base `Button` is shadcn (`components/ui/button.tsx`): `rounded-md`, `h-9 px-4 text-sm`, variants
default/outline/secondary/ghost/link, sizes sm/h-8, default/h-9, lg/h-10. **The Lexsus look is
achieved by overriding with the brand pill recipe:**
```jsx
// Primary CTA pill (dark theme)
<Button className="bg-brand text-brand-foreground rounded-full px-8 h-14 text-base hover:bg-brand/90 group">
  Join waitlist <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
</Button>

// Smaller pill CTA (nav)
className="px-4 h-8 text-xs rounded-full bg-brand text-brand-foreground hover:bg-brand/90"

// Outline brand (ghost-ish)
className="rounded-full border-brand/50 bg-transparent text-brand hover:bg-brand/10 hover:text-brand"
```
Height/typography ladder used across the app: `h-8 text-xs` (compact), `h-9/10` (default shadcn),
`h-11` (inline forms), `h-14 text-base` (hero/full). Icon arrows (`w-4 h-4`) nudge `translate-x-1` on
group hover.

### 6.3 Filter chips (shared voice across marketing + admin + careers)
```jsx
<button aria-pressed={active}
  className={`inline-flex items-center gap-2 text-xs font-mono px-3 h-9 rounded-full border transition-colors ${
    active ? "border-brand bg-brand text-brand-foreground"
           : "border-foreground/20 text-muted-foreground hover:border-foreground/50 hover:text-foreground" }`}>
  Label
  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
    active ? "bg-brand-foreground/20 text-brand-foreground" : "bg-foreground/5 text-muted-foreground" }`}>
    {count}
  </span>
</button>
```
Careers variant adds a department count bubble; same pill in `text-xs`. Mobile admin nav = the same
pill smaller (`px-3 h-8`).

### 6.4 Tables & list tables
- **Frame:** `<div className="border border-foreground/10 overflow-x-auto"><table className="w-full text-sm">`.
- **Column header:** `text-left font-mono text-[11px] uppercase tracking-widest text-muted-foreground
  border-b border-foreground/10 px-5 py-3`.
- **Row:** `border-b border-foreground/5 last:border-0`; cells `px-5 py-3.5 align-top`.
- **Row hover:** `hover:bg-foreground/[0.02]`; new/unread row tint `bg-brand/[0.04]`.
- Careers uses the same rhythm but as a **CSS grid** (`grid-cols-12`), rows `px-5 md:px-6 py-5 md:py-6`,
  row hover `hover:bg-foreground/[0.02]`, index in `font-mono text-xs`, apply affordance `ArrowRight`.
- **Status pill in a cell:** `text-xs font-mono px-2.5 py-1 border` (`border-foreground/15` neutral,
  `border-brand/50 text-brand` published/brand, `text-red-500` reject).
- **Bulk-select admin table** lives in `components/admin/selectable-table.tsx` (checkboxes, master
  indeterminate, brand-tinted toolbar, `DELETE {ids}`). See that file for the recipe.

### 6.5 Admin stat tile & quick link
```jsx
// Stat
<div className={`border p-6 ${accent ? "border-brand/40 bg-brand/[0.04]" : "border-foreground/10"}`}>
  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-3">{label}</p>
  <p className="text-3xl lg:text-4xl font-display tracking-tight">{value}</p>
</div>

// Quick link (border box, icon box, arrow nudge)
<Link className="group flex items-center justify-between gap-4 border border-foreground/10 hover:border-foreground/30 p-5">
  <span className="w-9 h-9 border border-foreground/15 inline-flex items-center justify-center">{icon}</span>
  … title + sub (text-xs muted) …
  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-all" />
</Link>
```

### 6.6 Inputs & forms
Heights vary by context; **borders are `border-foreground/20`**, focus swaps to `focus:border-brand`,
placeholder `placeholder:text-muted-foreground`.
- Hero waitlist email: `h-14 px-6 md:px-8 text-base rounded-full border border-foreground/20 bg-background`.
- Admin search boxes: `h-11 pl-10 pr-9 text-sm rounded-lg` with a `Search` icon absolutely positioned
  left (`w-4 h-4 text-muted-foreground pointer-events-none`) and an `X` clear link on the right.
- Admin editor labels follow `font-mono text-[11px] uppercase tracking-widest text-muted-foreground`.

### 6.7 Empty & unavailable states
Bordered callout: `border border-foreground/10 p-8` for info, `border border-dashed border-foreground/15
p-8/10 text-center text-sm` for empty data; body `text-muted-foreground`, `code`/inline mono for env
var names. This "configured?" guard pattern (`isSupabaseConfigured()`) appears on every admin list.

---

## 7. Page scaffolds (copy these)

### 7.1 New marketing section on the landing page
```jsx
<section id="…" className="relative py-24 lg:py-32">
  <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
    <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
      <span className="w-8 h-px bg-foreground/30" /> Eyebrow
    </span>
    <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-16 lg:mb-24">
      Heading line. <br/><span className="text-muted-foreground">Second line muted.</span>
    </h2>
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{/* cards: border border-foreground/10 p-6 */}</div>
  </div>
</section>
```

### 7.2 New inner page (blog/research/legal style)
```jsx
<ContentShell eyebrow="Blog" title="The page title" prose>
  {/* prose = centered 72ch column, text-lg muted, space-y-8 */}
  <PageParagraph>…</PageParagraph>
  <PageHeading>Subsection</PageHeading>
  <PageList items={["a", "b"]} />   {/* brand-dot bullets */}
  <PageNote>…</PageNote>             {/* mono, left border-l-2 */}
</ContentShell>
```
`ContentShell` props: `eyebrow`, `title`, `wide` (bento/table grids at full 1400 shell), `prose`
(centered reading column). Markdown bodies render through `ArticleBody` → `md-components.tsx` so CMS
content matches hand-written pages.

### 7.3 New admin list page
Wrap in the shell (`app/admin/(dashboard)/layout.tsx` gives sidebar + `max-w-[1240px]` column), then:
```jsx
<div className="space-y-8">
  <header>
    <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">/admin/thing</p>
    <h1 className="text-3xl font-display tracking-tight">Things</h1>
  </header>
  {/* stat tiles or quick links or <SelectableTable noun="thing" deleteEndpoint="/api/admin/things" headers=… rows=… /> */}
</div>
```

---

## 8. Motion & micro-interaction language

- **Reveal-on-scroll:** `opacity-0 translate-y-4/8/12` → visible; IntersectionObserver threshold
  0.1–0.2; stagger via inline `transitionDelay: index * 75–100ms`. Transitions `duration-500/700`.
- **Hover:** arrows & CTAs `translate-x-1` (`group-hover`); serif titles `group-hover:translate-x-2`
  (features) / `translate-x-1` (careers); row highlight `hover:bg-foreground/[0.02]`; text links shift
  color `foreground/70 → foreground`.
- **Spring-ish ease on lift:** `transition transform .4s cubic-bezier(0.34,1.56,0.64,1)` (`hover-lift`,
  `.letter-spin`).
- **Marquees:** `.marquee` (30s) / `.marquee-reverse` (25s), duplicated content, `translateX(-50%)`.
- **Word/letter intros:** `.animate-word-fade`, `.animate-char-in` (blur 40px + rise), `.line-reveal`
  (clip-path wipe).
- **Floating nav:** 500ms ease; scrolled state adds the pill card.
- **Icon arrows** are the universal "navigate" affordance (ArrowRight / ArrowUpRight `w-3–4 h-3/4`,
  appear-on-hover pattern in the footer social links: `opacity-0 -translate-x-1 group-hover:opacity-100`).

---

## 9. Utilities & decorations in `globals.css`

`noise-overlay` (film grain ::after, opacity .03), `text-stroke` (outlined type), `marquee`,
`marquee-reverse`, `line-reveal`, `hover-lift`, `letter-spin`, `animate-char-in`, `animate-word-fade`,
`no-scrollbar`, `border-sketch` (dashed-pattern border). Ambient **line-art SVGs** (sphere, tetrahedron,
wave, feature visuals) are stroke-based, `text-foreground`, and animated via SMIL `<animate>` at low
opacity over `bg-background`.

---

## 10. Dashboard construction — how the Lexsus admin looks

This is the recipe for a **data-dense admin/dashboard** that still reads as Lexsus. It's deliberately
the *same* design language as the marketing site — same fonts, same mono labels, same hairline
`foreground/10` borders, same brand green — but square, quieter, and denser. If the marketing site is
a broadsheet, the dashboard is its stock ticker.

### 10.1 Anatomy & route structure

Two layout layers (route groups in `app/admin/`):

```text
app/admin/layout.tsx              → outermost: <div class="min-h-screen bg-background text-foreground noise-overlay">{children}</div>
app/admin/(dashboard)/layout.tsx  → the shell below (sidebar + content column)
app/admin/login/page.tsx          → outside the (dashboard) group → clean full-screen centered card
app/admin/(dashboard)/page.tsx    → overview (stats + quick links + charts + recent table)
app/admin/(dashboard)/{leads,content,jobs,applications}/page.tsx  → each a list page (§10.5)
```

### 10.2 The shell (sidebar + content column)

```jsx
// app/admin/(dashboard)/layout.tsx — essence
<div className="lg:flex lg:min-h-screen">
  {/* Desktop sidebar */}
  <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen
                    border-r border-foreground/10 bg-background/70 backdrop-blur">
    <div className="h-16 shrink-0 flex items-center gap-2 px-6 border-b border-foreground/10">
      <span className="w-2 h-2 rounded-full bg-brand" />      {/* brand dot */}
      <Link className="font-display tracking-tight text-lg">Lexsus Admin</Link>
    </div>
    <div className="flex-1 overflow-y-auto py-6 px-3"><SidebarNav /></div>
    <div className="shrink-0 px-6 py-4 border-t border-foreground/10">
      <p className="font-mono text-xs text-muted-foreground truncate mb-3">{admin.email}</p>
      <SignOutButton />   {/* ghost: LogOut w-3.5 + text-muted-foreground hover:text-foreground */}
    </div>
  </aside>

  {/* Content column */}
  <div className="flex-1 min-w-0 flex flex-col">
    <main className="flex-1 w-full mx-auto max-w-[1240px] px-5 sm:px-8 py-8 lg:py-10">{children}</main>
  </div>
</div>
```

Key numbers: sidebar **`w-64` (256px)**, hairline `border-r`, frosted `bg-background/70 backdrop-blur`;
top bar **`h-16`**; nav gutter `px-3`; account strip **`px-6 py-4`** with the email in tiny mono.
Content column is centered, capped **`max-w-[1240px]`**, `px-5 sm:px-8`, `py-8 lg:py-10`.
On `< lg` the sidebar is replaced by a sticky mobile header `h-14` + a horizontal, scrollable
pill nav (`MobileTopNav`). The brand dot + serif wordmark lockup opens the whole dashboard and the
login card.

### 10.3 Sidebar navigation item

```jsx
// active vs idle (see components/admin/sidebar-nav.tsx)
className={`flex items-center gap-3 px-3.5 h-10 rounded-lg text-sm transition-colors ${
  active
    ? "bg-brand text-brand-foreground font-medium"
    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
}`}
// <Icon className="w-4 h-4 shrink-0" />  Label
```
Idle = muted, hover tints the row; **active = a solid brand pill**. Vertical list is `space-y-1`.
This active-is-a-pill rule is the single strongest "I am on a dashboard" signal — reuse it for any
admin left-nav.

### 10.4 Overview page anatomy (top → bottom)

1. **Page header** — the exact same voice as every inner page:
   ```jsx
   <header>
     <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">/admin · email</p>
     <h1 className="text-3xl font-display tracking-tight">Overview</h1>
   </header>
   ```
2. **Stat tiles** — `grid grid-cols-2 lg:grid-cols-4 gap-4`. Each tile:
   ```jsx
   <div className={`border p-6 ${accent ? "border-brand/40 bg-brand/[0.04]" : "border-foreground/10"}`}>
     <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-3">Label</p>
     <p className="text-3xl lg:text-4xl font-display tracking-tight">1,204</p>
     {hint && <p className="mt-1 text-xs text-muted-foreground">note</p>}
   </div>
   ```
   Square `border p-6`. Use the **brand tint** (`border-brand/40 bg-brand/[0.04]`) to draw the eye to
   *one* headline number, never all of them.
3. **Quick links** — `grid sm:grid-cols-2 gap-4`; each a bordered box `p-5` with an icon in a
   `w-9 h-9 border border-foreground/15` square, a `font-medium` title, a `text-xs muted` subtitle,
   and a right `ArrowRight` that nudges `translate-x-1` on group hover; hover swaps the box border
   `hover:border-foreground/30`.
4. **Charts** — see §10.6.
5. **Recent-leads table** — section label row: mono caps title on the left, an
   `All leads →` link on the right (`gap-1.5`, arrow `w-3.5`, `group-hover:gap-2.5`).

Every block on the page is separated by `space-y-10`; row groups inside a section by `space-y-4`/`space-y-3`.

### 10.5 List pages (leads / content / jobs / applications)

Same header, then (all server components + a small client table for selection chrome):

- **Filter chips row** (`role="group"`): the §6.3 pill. Clicking changes the URL query
  (`?status=…&jobId=…&search=…`) — filters are **state in the URL**, not local state.
- **Search box** — `h-11 rounded-lg border border-foreground/20`, `Search` icon absolutely placed
  `left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none`, an `X`
  clear link at right; submits a GET form to the same page.
- **Counts on chips** reflect what *picking that chip would return* (they ignore that chip's own
  filter but honor the others) — a deliberate micro-UX worth copying.
- **"Showing X of Y"** footer line in `font-mono text-xs text-muted-foreground` with a
  `Clear filters` (X + underline) link when filtered.
- **Empty states:** bordered callout `border border-dashed border-foreground/15 p-8/10
  text-center text-sm text-muted-foreground`, copy explains *how to make data appear*.
- **The data table** = `SelectableTable` (`components/admin/selectable-table.tsx`) for the four
  resources: server renders `<th>`/`<td>`, client owns the checkbox column, master indeterminate
  checkbox, a **brand-tinted bulk toolbar** (`border-brand/40 bg-brand/[0.05] rounded-lg px-4 py-2.5`)
  showing "N selected · clear" + a red `Delete` button (`bg-red-500/10 border-red-500/40
  text-red-500 hover:bg-red-500/20`), then `DELETE {ids}` → `router.refresh()`.
- **Row styles:** `border-b border-foreground/5 last:border-0`, cells `px-5 py-3.5 align-top`;
  brand-new/new rows get a faint tint `bg-brand/[0.04]` + a tiny `New` mono capsule
  (`text-[10px] font-mono uppercase tracking-widest border border-brand/50 text-brand px-1.5 py-0.5`);
  cell-level **status = bordered mono capsule** (`text-xs font-mono px-2.5 py-1 border border-foreground/15`;
  `border-brand/50 text-brand` for good status; `text-red-500` for rejected).
- **Per-row actions** sit right-aligned in the last cell (`flex items-center justify-end gap-4`) —
  icon links (Eye, PencilLine `w-4`/`w-3.5`, muted → hover foreground) plus a small menu button for
  status changes; single-row delete confirms via `window.confirm`.

**Action/menu controls** (`application-actions`, `lead-actions`, `job-filter`, `article-buttons`) are
thin client components that call the admin API then `router.refresh()`. Keep the visual part small:
a bordered pill or icon button + a dropdown/confirm — no heavyweight modals for everyday actions.

### 10.6 Charts (recharts, theme-aware)

Charts live in `components/admin/dashboard-charts.tsx`. The styling recipe:

- **Panel:** `border border-foreground/10 p-6`; header `h2` in the mono-caps voice + a `text-xs
  text-muted-foreground` subtitle. A chart never sits bare on the page background.
- **Layout:** charts row = `grid lg:grid-cols-3 gap-4` — trend chart `lg:col-span-2`, donut `1`.
- **Segmented window control** (7d/14d/30d): `inline-flex items-center border border-foreground/15
  rounded-full overflow-hidden`; each button `text-xs font-mono px-3.5 h-8`, active
  `bg-brand text-brand-foreground`, idle `text-muted-foreground hover:text-foreground`.
- **Theme colors are read from CSS at runtime** (not hardcoded): `getComputedStyle` on
  `--brand`/`--foreground`, re-applied via a `MutationObserver` watching `class` on `<html>` — this is
  how the same chart looks right in midnight **and** solarized. (See `readColors()` in that file.)
- **Line/area:** horizontal-only grid `CartesianGrid strokeOpacity={0.08}`, axis lines/tickLines off,
  ticks `{ fill: foreground, opacity: 0.55, fontSize: 11 }`; area = brand with a vertical gradient
  fill fading `0.45 → 0.02`; the secondary series (visits) is `foreground` at `opacity 0.55`, 1.5px,
  dashed `4 3` — brand is the hero series, foreground is the supporting one.
- **Donut:** single-hue, `innerRadius 56 outerRadius 86`, `paddingAngle 3`; slices are the *same
  brand* color at decreasing `fillOpacity` (`max(0.16, 1 - i * 0.16)`) — rank by opacity, don't bring
  in a rainbow. Legend swatches match (`w-2.5 h-2.5 rounded-sm`), values in `font-mono text-xs`.
- **Tooltip:** `border border-foreground/15 bg-background/95 backdrop-blur px-3 py-2 text-xs
  font-mono` (this is one of the *only* sanctioned `shadow-lg`s).
- **Empty chart states:** `h-[240px]/[260px] flex items-center justify-center border
  border-dashed border-foreground/15 text-sm text-muted-foreground` ("No traffic or signups…").
- Pre-hydration placeholder so there's no color flash: a `border border-foreground/10` box that says
  "Loading charts…".

### 10.7 Login page

Full-screen centered (`min-h-screen flex flex-col items-center justify-center px-6 py-20`), a
`max-w-md` column: brand dot + `Lexsus Admin` in `font-display` at top, then a `border
border-foreground/10 p-8` card — `h1 text-2xl font-display tracking-tight`, a short `text-sm
text-muted-foreground` explanation paragraph (`mb-8`), then the form. The form is left on a
`bg-background` page (no noise needed) so it reads as a clean entry point.

### 10.8 Dashboard rules of thumb

- Everything is square-edged (`border`) + hairline; the *only* pills in the dashboard are filters,
  segmented windows, pager buttons and the nav CTAs — curvature marks "you can click to change the
  view", square marks "this is data".
- Section and page titles stay serif `font-display`; every label/count/header/breadcrumb is mono caps.
- One brand-tint element per view is the accent budget (a stat, a chip, a legend); everything else is
  `foreground` alphas.
- Numbers read in `font-mono` (dates, counts, percentages, indices); human names and titles read in
  `text-foreground` sans; descriptions in `text-sm/text-xs text-muted-foreground`.
- Responsive is `lg`-centric: sidebar ≤ hidden, columns collapse 4→2→1, tables scroll
  (`overflow-x-auto`, `min-w-[720px]` on the table).
- No theme-grays: use `bg-background`, `bg-card`, `text-muted-foreground` and the theme-aware chart
  colors so midnight/oled/solarized all hold without work.

## 11. Checklist — "does it feel like Lexsus?"

- [ ] Near-square panels with `border-foreground/10`; pills only for actions/filters.
- [ ] Headline is serif `font-display tracking-tight`; description is `text-muted-foreground`.
- [ ] Any label/count/table-header/breadcrumb is mono + uppercase + letterspaced + muted.
- [ ] Brand green appears ≤ 3 places on a view (a fill, a dot, a hairline) — restraint.
- [ ] Two-tone heading trick (`text-foreground` + `text-muted-foreground` line) where it fits.
- [ ] Container is 1400 marketing / 1240 admin / `72ch` reading; paddings from §5.
- [ ] Interactive rows change alpha, not color; arrows nudge right on hover.
- [ ] Status uses semantic tokens, not hardcoded grays, so midnight/oled/solarized all hold.
- [ ] New page is inside the right shell (ContentShell vs dashboard layout) so nav/footer/theme are free.
