---
name: Chorus
description: Native Mac multi-model AI chat — a quiet, warm, terminal-literate workspace
colors:
  ink: "#292522"
  ink-deep: "#1c1917"
  paper-white: "#ffffff"
  warm-mist: "#f6f6f4"
  hairline: "#ecebe9"
  field-edge: "#dcd9d6"
  helper-gray: "#bfb9b5"
  muted-voice: "#938c85"
  quiet-slate: "#6c6660"
  sidebar-smoke: "#fdfdfc"
  toasted-sand: "#cda174"
  saddle: "#6a5139"
  sand-wash: "#f8f2ec"
  focus-salmon: "#daa48b"
  signal-red: "#ea4334"
typography:
  body:
    fontFamily: "SF Pro, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "0.14px"
  title:
    fontFamily: "SF Pro, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "24px"
  label:
    fontFamily: "Geist Mono, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: "12px"
    letterSpacing: "0.6px"
  small:
    fontFamily: "SF Pro, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  code:
    fontFamily: "Geist Mono, monospace"
    fontSize: "85%"
    fontWeight: 400
rounded:
  xs: "4px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.lg}"
    height: "40px"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.quiet-slate}"
    rounded: "{rounded.lg}"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "40px"
  input-default:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "32px"
    padding: "8px 12px"
  card-default:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink-deep}"
    rounded: "{rounded.xl}"
    padding: "24px"
---

# Design System: Chorus

> **Normative sources.** The canonical color values are the HSL triplets in
> `src/ui/themes/index.ts` (`colorPalette` + `defaultTheme`), exposed as CSS
> variables (`--background`, `--foreground`, `--accent`, …) and mapped in
> `tailwind.config.cjs`. The hex values in the frontmatter are sRGB
> approximations for tooling. **When writing code, always use the semantic
> Tailwind classes (`bg-background`, `text-muted-foreground`, `border-border`,
> `ring-special`…), never raw hex or new HSL literals.**

## 1. Overview

**Creative North Star: "The Warm Terminal"**

Chorus is a native Mac tool that puts many AIs in one quiet room. The interface
is a warm-neutral workspace — warm grays, hairline borders, generous whitespace —
with a monospace, terminal-literate accent voice (Geist Mono micro-labels, ASCII
flourishes, a retro loader). Design serves the product: the chat content is the
star, and the chrome disappears into the task. Density is moderate; states are
rich; motion is feedback, never decoration.

The system explicitly rejects: SaaS gradient-dashboard styling, glassmorphism,
purple-AI-tool branding, decorative cards, and any component that would look
foreign next to Linear, Raycast, or a well-set terminal.

**Key Characteristics:**
- Warm gray ramp (`gray` palette, hue 12–60, chroma tiny) on every surface; true white content canvas in light, near-black `#1c1917` in dark.
- One accent family (toasted warm sand, `accent` ramp) used for highlights and selection only — never for decoration.
- Monospace micro-labels (10px, uppercase, 0.6px tracking, Geist Mono) as the signature "voice" element.
- Hairline borders (`--border`) carry structure; shadows are nearly absent.
- Full light/dark parity via CSS variables — every new surface must work in both without new literals.

## 2. Colors

A restrained warm-neutral system: one gray ramp, one warm accent ramp, two signals.

### Primary
- **Ink** (`--foreground`, gray-900 ≈ #292522): primary text and — inverted — the primary button surface. The strongest voice in the room.
- **Toasted Sand** (`accent-500` ≈ #cda174, ramp `accent-25…900`): the brand's warmth. Selection highlights (`--highlight`), shimmer text, model-pill accents. Used on well under 10% of any screen.

### Neutral
- **Paper White / Ink Deep** (`--background`, #ffffff light / gray-950 #1c1917 dark): the content canvas.
- **Sidebar Smoke** (`--sidebar-background`, gray-25 light / gray-900 dark): the second neutral layer for sidebar, toolbars, panels — one step warmer/dimmer than the canvas.
- **Warm Mist** (`--muted`, gray-100): hover fills, muted chips, table headers.
- **Muted Voice** (`--muted-foreground`, gray-500): secondary text. Never used below 12px on tinted fills.
- **Hairline** (`--border`, gray-200 light / gray-800 dark): every structural line.
- **Helper Gray** (`--helper`, gray-400): placeholder-level hints.

### Tertiary (signals)
- **Focus Salmon** (`--special`, hsl(19 51% 70%) ≈ #daa48b): focus rings on inputs (`focus:ring-special`). Focus is the only job this color has.
- **Signal Red** (`--destructive`, hsl(5 81% 56%)): destructive actions and errors only.

### Named Rules
**The Token-Only Rule.** New UI never introduces hex/HSL literals. If a color
isn't reachable through a semantic token (`bg-background`, `text-foreground`,
`bg-muted`, `border-border`, `ring-special`, `text-destructive`, sidebar-*,
highlight-*), the design is wrong or the token belongs in
`src/ui/themes/index.ts` first.

**The Quiet Accent Rule.** Toasted Sand marks *state* (selection, highlight,
activity) — never headings, never fills for emphasis, never gradients.

## 3. Typography

**Body Font:** SF Pro (system-ui fallback) — `--font-sans`
**Label/Mono Font:** Geist Mono — `--font-mono` (code blocks may use user-selected monos: JetBrains Mono, Fira Code, Monaspace family)

**Character:** A neutral, native-feeling sans for everything task-shaped, with a
monospace counter-voice for metadata, labels, and code. One family per role; no
display fonts anywhere.

### Hierarchy
- **Title** (`text-lg`, 16/24, weight 500): dialog titles, section headers. The largest UI text there is — Chorus has no hero type.
- **Body** (`text-base`, 14/20, weight 400, tracking 0.14px): messages, controls, prose. Prose column capped at `max-w-prose` (70ch).
- **Small** (`text-sm`, 12/16): dense metadata, secondary controls.
- **Label** (`.sidebar-label`: 10px, uppercase, `tracking-wider` 0.6px, Geist Mono): the signature micro-label for sidebar sections and grouped controls.
- **Code** (Geist Mono, 85% of context size): inline code and code blocks; Atom One Light/Dark syntax themes (`App.css`).

### Named Rules
**The One Kicker Rule.** The mono micro-label is Chorus's *single* deliberate
kicker pattern. Reuse `.sidebar-label` exactly; do not invent second eyebrow
styles, and do not scatter it on every section of a new screen.

**The Fixed Scale Rule.** Sizes come only from the four registered steps
(`xs 10, sm 12, base 14, lg 16`). No clamp(), no arbitrary `text-[13px]`.
Weights come only from the registered set (250 light / 400 / 450 medium /
500 semibold) — note these are intentionally lighter than Tailwind defaults.

## 4. Elevation

Chorus is flat-by-default. Depth is conveyed by the two-layer neutral system
(canvas vs. sidebar/panel smoke) and hairline borders, not shadows. Cards carry
`shadow-sm` at most; the single richer shadow, `shadow-diffuse`
(`0 8px 30px rgb(0 0 0 / 5%)`), is reserved for floating surfaces (popovers,
command menu). Two inset shadows (`focus-inset-shadow-sm`,
`hover-inset-shadow-xs`) give pressed/tactile feedback on special controls.

### Named Rules
**The Border-Not-Shadow Rule.** If a container needs separation, reach for
`border-border` or a `bg-sidebar`/`bg-muted` tint first. A drop shadow on an
in-flow element is a design smell.

## 5. Components

All primitives live in `src/ui/components/ui/` (shadcn/Radix). Use them; do not
fork styling inline.

### Buttons (`button.tsx` + `buttonVariants.ts`)
- **Shape:** rounded-lg (8px); heights 40px default / 36 sm / 32 xs / 28 iconSm.
- **Primary (`default`):** inverted ink — `bg-foreground text-background`, hover 90% opacity. Confident, colorless.
- **Ghost:** transparent, `text-foreground/80`, hover `bg-muted`. The workhorse for toolbars.
- **Outline:** `border-input bg-background`, hover `bg-muted`.
- **Destructive:** *quiet* — plain background with `text-destructive`, hover 10% red tint. Never a solid red slab.
- **Focus:** `focus-visible:outline-none` — button focus is deliberately minimal; disabled is 50% opacity, pointer-events none.
- Icons inside buttons are 12px (`[&_svg]:size-3`).

### Inputs (`input.tsx`, `textarea.tsx`)
- **Style:** 32px tall, tight 4px radius, `ring-1 ring-border` instead of border, `bg-background`.
- **Focus:** ring switches to Focus Salmon (`focus:ring-special`). No glow, no offset.
- **Placeholder:** `text-muted-foreground`.

### Cards / Containers (`card.tsx`)
- **Corner Style:** rounded-xl (12px) — the roundest thing in the app.
- **Background:** `bg-card` (= canvas); **Border:** hairline; **Shadow:** `shadow-sm`.
- **Padding:** 24px header/content rhythm.
- Cards are rare in Chorus — chat surfaces and panels dominate. Don't gridify new screens into card mosaics.

### Navigation (sidebar, `sidebar.tsx` + `AppSidebar.tsx`)
- Sidebar sits on Sidebar Smoke with its own token family (`sidebar-*`).
- Section headers use `.sidebar-label`; items are 14px sans with `sidebar-accent` hover fill and `sidebar-accent-foreground` text.
- Resizable panels (`resizable.tsx` / `ResizablePanelGroup`) are the standard mechanism for any split view (chat columns, drawers, future side panels).

### Signature Components
- **Model pills (`ModelPills.tsx`)** — compact chips identifying models per column; provider logos via `provider-logo.tsx`.
- **Retro loader / spinner (`retro-loader.tsx`)** — terminal-flavored progress; use instead of generic spinners.
- **Shimmer text (`.shimmer`)** — streaming/"thinking" indicator; the only sanctioned animated text treatment.
- **kbd** — Geist Mono 12px, muted; keyboard hints appear inline next to actions.

## 6. Do's and Don'ts

### Do:
- **Do** build every new surface from `src/ui/components/ui/` primitives and semantic tokens; extend `themes/index.ts` if a genuinely new role is needed (both light *and* dark values).
- **Do** verify both themes: toggle light/dark before calling any screen done.
- **Do** keep transitions 150–250ms, ease-out, state-conveying (`transition-colors` on hover, accordion-down for reveals). Respect `prefers-reduced-motion`.
- **Do** use `ResizablePanelGroup` for new split layouts and `Sheet`/`Popover`/`DropdownMenu` from the existing kit for overlays.
- **Do** give every interactive component its full state set: hover, focus, active, disabled, loading (retro loader / skeleton), error, empty.
- **Do** keep destructive actions text-red-on-quiet, gated by `ConfirmButton` where irreversible.

### Don't:
- **Don't** introduce hex/HSL/OKLCH literals, new fonts, new font sizes, or arbitrary Tailwind values (`text-[13px]`, `z-[999]`) in feature code.
- **Don't** use gradients, gradient text, glassmorphism/backdrop-blur decoration, colored side-stripe borders, or hero-metric cards — all prohibited.
- **Don't** ship dark-mode-only or light-mode-only styling; every token must resolve in both.
- **Don't** use solid red buttons; destructive stays quiet (text + 10% tint hover).
- **Don't** add drop shadows to in-flow content (The Border-Not-Shadow Rule).
- **Don't** invent second kicker/eyebrow styles beyond `.sidebar-label` (The One Kicker Rule).
- **Don't** replace standard affordances with novelties — no custom scrollbar restyling beyond the existing 7px thumb, no non-Radix modals, no display fonts in UI labels.
- **Don't** exceed the app's quiet register: no orchestrated page-load choreography; Chorus loads into the task.
