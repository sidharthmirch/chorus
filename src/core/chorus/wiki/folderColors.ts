/**
 * W8 — Wiki Vault. Deterministic folder -> legend-color assignment for the
 * graph views (P4 brief: "folder color legend — companies=accent,
 * concepts=success, sectors=warning, sources=helper — via semantic
 * tokens"). All four buckets are EXISTING semantic tokens (`success`/
 * `warning` were added by W1); this workstream adds no new theme tokens.
 */
import type { WikiFolderColor } from "./types";

const KNOWN_FOLDER_COLORS: Record<string, WikiFolderColor> = {
    companies: "accent",
    concepts: "success",
    sectors: "warning",
    sources: "helper",
};

const FALLBACK_PALETTE: WikiFolderColor[] = ["accent", "success", "warning", "helper"];

function hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash * 31 + value.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

/**
 * Assigns every top-level folder a legend color. The four "known" names
 * from design/wiki.md's example vault map directly to their intended
 * token; any other folder name (a real user's vault won't necessarily use
 * this exact taxonomy) gets a stable hash-based pick from the same
 * four-token palette, so the legend and graph still make sense for an
 * arbitrary vault. The root ("" folder, for files not inside any folder)
 * always gets "helper" -- it isn't a real named category.
 */
export function assignFolderColors(folders: string[]): Map<string, WikiFolderColor> {
    const result = new Map<string, WikiFolderColor>();
    for (const folder of folders) {
        if (folder === "") {
            result.set(folder, "helper");
            continue;
        }
        const key = folder.toLowerCase();
        result.set(
            folder,
            KNOWN_FOLDER_COLORS[key] ?? FALLBACK_PALETTE[hashString(key) % FALLBACK_PALETTE.length],
        );
    }
    return result;
}
