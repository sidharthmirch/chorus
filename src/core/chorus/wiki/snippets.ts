/**
 * W8 — Wiki Vault. Pure text-snippet helpers for backlink context lines and
 * search results (design/wiki.md: "…co-dependencies…", capped ~60 chars).
 */

/**
 * Extracts a short, single-line, whitespace-collapsed preview of `text`
 * centered on the [start, end) range, capped at `maxLen` characters with
 * ellipses where the window doesn't reach an edge of the text.
 */
export function buildSnippet(text: string, start: number, end: number, maxLen = 60): string {
    if (text.length === 0) return "";
    const matchLen = Math.max(0, end - start);
    const radius = Math.max(10, Math.floor((maxLen - matchLen) / 2));
    const from = Math.max(0, start - radius);
    const to = Math.min(text.length, end + radius);

    let snippet = text.slice(from, to).replace(/\s+/g, " ").trim();
    const truncated = snippet.length > maxLen;
    if (truncated) {
        snippet = snippet.slice(0, maxLen).trim();
    }

    const prefixEllipsis = from > 0 ? "…" : "";
    const suffixEllipsis = to < text.length || truncated ? "…" : "";
    return `${prefixEllipsis}${snippet}${suffixEllipsis}`;
}

/** Case-insensitive first-match index of `query` in `text`, or undefined. */
export function findFirstMatchIndex(text: string, query: string): number | undefined {
    if (!query) return undefined;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    return idx === -1 ? undefined : idx;
}
