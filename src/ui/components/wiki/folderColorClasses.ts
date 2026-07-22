/**
 * W8 — Wiki Vault. Maps `WikiFolderColor` (core/chorus/wiki/types.ts) to
 * actual Tailwind classes for the graph legend/nodes. Mirrors
 * `fleet/fleetTone.ts`'s already-documented fix for the exact same
 * problem: `tailwind.config.cjs` defines `colors.accent` twice in one
 * object literal (once as `{DEFAULT, foreground}`, once as the
 * `colorPalette.accent` 25-900 ramp) -- the second literal key wins
 * entirely, so bare `fill-accent`/`text-accent` do not reliably resolve.
 * `accent-600` (the ramp step already in real use elsewhere, e.g.
 * `AppSidebar.tsx`'s `text-accent-500`, `fleetTone.ts`'s `bg-accent-600`)
 * is the working form. `success`/`warning`/`helper` are each defined once
 * and resolve fine bare.
 */
import type { WikiFolderColor } from "@core/chorus/wiki/types";

export const WIKI_FOLDER_FILL_CLASS: Record<WikiFolderColor, string> = {
    accent: "fill-accent-600",
    success: "fill-success",
    warning: "fill-warning",
    helper: "fill-helper",
};

export const WIKI_FOLDER_TEXT_CLASS: Record<WikiFolderColor, string> = {
    accent: "text-accent-600",
    success: "text-success",
    warning: "text-warning",
    helper: "text-helper",
};

export const WIKI_FOLDER_BG_CLASS: Record<WikiFolderColor, string> = {
    accent: "bg-accent-600",
    success: "bg-success",
    warning: "bg-warning",
    helper: "bg-helper",
};
