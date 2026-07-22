/**
 * W8 — Wiki Vault. Shared types for the vault core (vault/parse/index) and
 * the UI layer. See docs/rework/design/wiki.md for the design-level shapes
 * this refines, and docs/rework/00-ARCHITECTURE.md §7 for the frozen
 * contract: the vault is a user-chosen directory of `.md` files (Obsidian
 * conventions); disk is always the source of truth; SQLite holds only a
 * rebuildable index cache, never note bodies as a system of record.
 */

/** A single `[[wikilink]]` or `![[embed]]` occurrence found in a note body. */
export interface IWikilinkMatch {
    /** Exact source text, e.g. `[[Blackwell architecture|Blackwell]]`. */
    raw: string;
    /** The note reference before the `|` split, trimmed. May or may not include `.md`. */
    target: string;
    /** Display text after `|`, if present. */
    alias?: string;
    /** True when preceded by `!` (an embed/transclusion mention). */
    isEmbed: boolean;
    /** Character offsets into the source text this match was found in. */
    start: number;
    end: number;
}

export interface IHeading {
    level: number; // 1-6
    text: string;
}

/** Result of parsing one note's raw file contents (parse.ts). Pure and
 *  disk-agnostic -- doesn't know the file's path. */
export interface IParsedNote {
    frontmatter: Record<string, unknown>;
    /** Markdown body with the frontmatter block stripped. */
    body: string;
    links: IWikilinkMatch[];
    headings: IHeading[];
}

/** A fully-loaded note. Always assembled fresh from disk (vault.ts +
 *  parse.ts) -- never served from the SQLite cache, per the "disk is truth"
 *  contract. */
export interface IVaultNote extends IParsedNote {
    /** Vault-relative path, forward-slash separated, e.g. "companies/NVIDIA.md". */
    path: string;
    /** All but the last path segment, e.g. "companies", "sources/questions", or "" for root files. */
    folder: string;
    title: string;
    updatedAt: Date;
}

/** Minimal shape needed to resolve `[[mentions]]` against the vault's file list. */
export interface IResolvableFile {
    path: string;
    title: string;
}

export interface IBacklinkEntry {
    sourcePath: string;
    sourceTitle: string;
    /** ~60-char context snippet around the link mention (design/wiki.md). */
    context: string;
    /** How many times sourcePath links to the target note (usually 1). */
    linkCount: number;
}

export interface ISearchResult {
    path: string;
    title: string;
    folder: string;
    snippet: string;
    /** Backlink count for this file -- design/wiki.md's "(22 links)" badge. */
    linkCount: number;
}

/** The four folder-color legend buckets (00-ARCHITECTURE.md / W8 brief P4),
 *  each backed by an existing semantic token -- no new theme tokens needed. */
export type WikiFolderColor = "accent" | "success" | "warning" | "helper";

export interface IWikiGraphNode {
    /** vault-relative path -- doubles as the node id. */
    id: string;
    label: string;
    folder: string;
    color: WikiFolderColor;
    linkCount: number;
}

export interface IWikiGraphEdge {
    source: string; // path
    target: string; // path
}

export interface IWikiGraph {
    nodes: IWikiGraphNode[];
    edges: IWikiGraphEdge[];
}

/** Cache row shape for the `wiki_index` SQLite table (index.ts). Entirely
 *  derived + rebuildable, keyed by (vaultPath, path) so stale rows from a
 *  previously-chosen vault never collide with the active one. `bodyCache`
 *  exists solely so `searchVault()` can match against note content without
 *  re-reading every file from disk on every keystroke -- it is a cache, not
 *  a copy of record: NoteView always re-reads the real file from disk. */
export interface IWikiIndexRow {
    vaultPath: string;
    path: string;
    title: string;
    folder: string;
    frontmatter: Record<string, unknown>;
    links: IWikilinkMatch[];
    bodyCache: string;
    updatedAt: Date;
    indexedAt: Date;
}

/** A vault tree node, as rendered by VaultTree.tsx. Built by a pure
 *  function (index.ts's `buildVaultTree`) from a flat file list so it's
 *  unit-testable without touching disk. */
export interface IVaultTreeFolder {
    kind: "folder";
    name: string;
    /** Full path from vault root, e.g. "sources/questions". */
    path: string;
    children: IVaultTreeNode[];
    /** Count shown in design/wiki.md's folder row -- total files nested under this folder. */
    fileCount: number;
}

export interface IVaultTreeFile {
    kind: "file";
    name: string;
    path: string;
    /** Backlink count badge (design/wiki.md) -- undefined until the index has a row for this file. */
    linkCount: number | undefined;
}

export type IVaultTreeNode = IVaultTreeFolder | IVaultTreeFile;
