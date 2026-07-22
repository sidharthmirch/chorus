/**
 * W7 — Fleet. Maps `FleetMetaTone` (core/chorus/fleet/protocol.ts) to
 * semantic Tailwind classes — the single place that decides which token
 * backs each tone, per DESIGN.md's Token-Only Rule.
 *
 * `"accent"` uses the Toasted Sand ramp's `600` step (`bg-accent-600` /
 * `text-accent-600`), not the bare `accent` key: `tailwind.config.cjs`
 * defines `colors.accent` twice in the same object literal (once as
 * `{DEFAULT, foreground}` for the muted chip-background role, once as the
 * `colorPalette.accent` 25-900 ramp) — the second literal JS object key
 * wins entirely, so the ramp shadows `DEFAULT`/`foreground` and bare
 * `bg-accent`/`text-accent` do not reliably resolve. `accent-500`/`600`/
 * `700` are the ramp steps already in real use elsewhere (e.g.
 * `AppSidebar.tsx`'s `text-accent-500`, `MultiChat.tsx`'s
 * `bg-accent-600`) — `600` matches the "solid, active/marked state" use
 * elsewhere rather than the lighter `500` hover-only use.
 */

import { FleetMetaTone } from "@core/chorus/fleet/protocol";

export const FLEET_TONE_DOT_CLASS: Record<FleetMetaTone, string> = {
    muted: "bg-muted-foreground/50",
    success: "bg-success",
    warning: "bg-warning",
    accent: "bg-accent-600",
};

export const FLEET_TONE_TEXT_CLASS: Record<FleetMetaTone, string> = {
    muted: "text-muted-foreground",
    success: "text-success",
    warning: "text-warning",
    accent: "text-accent-600",
};

export const FLEET_TONE_BAR_CLASS: Record<FleetMetaTone, string> = {
    muted: "bg-muted-foreground/50",
    success: "bg-success",
    warning: "bg-warning",
    accent: "bg-accent-600",
};
