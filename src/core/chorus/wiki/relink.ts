/**
 * W8 — Wiki Vault. Relink queue (orphan-mention / merge / rename
 * suggestions) — the design's relink queue (design/wiki.md,
 * 00-ARCHITECTURE.md §7). **v2, out of scope for this workstream.** This
 * file is a typed seam only: no logic, no UI, so a future pass has a clear
 * landing spot and frozen-ish shapes to target without guessing at how it
 * should plug into index.ts.
 *
 * Sketch of what v2 would do, for context:
 * - "orphan": a `[[mention]]` that never resolves to a real file (today,
 *   index.ts's `resolveAllLinks` just silently drops these from the graph;
 *   the note view surfaces a "create?" affordance per-mention, but there's
 *   no vault-wide queue of them).
 * - "rename": when a file is renamed/moved, find every note whose links
 *   pointed at the old path/basename and offer to rewrite them.
 * - "merge": two notes that are probably the same real-world entity
 *   (similar titles/frontmatter) with mentions split across both.
 */

export type IRelinkSuggestionKind = "orphan" | "rename" | "merge";

export interface IRelinkSuggestion {
    kind: IRelinkSuggestionKind;
    /** The mention text as written, e.g. "mixture-of-experts". */
    mention: string;
    /** Files containing this mention. */
    sourcePaths: string[];
    /** For "rename"/"merge": the path this mention most likely should
     *  resolve to instead. */
    suggestedTargetPath?: string;
}

/**
 * v2. Not implemented -- always returns an empty queue so any future UI
 * that renders "N relink suggestions" reads as a correct, honest zero
 * rather than needing its own feature-flag branch.
 */
export function getRelinkSuggestions(): IRelinkSuggestion[] {
    return [];
}
