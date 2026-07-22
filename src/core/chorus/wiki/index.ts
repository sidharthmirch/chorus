/**
 * W8 — Wiki Vault. The index: link graph, backlinks with context snippets,
 * a search cache, and the vault tree -- all backed by the `wiki_index`
 * SQLite table (migration v148). This is the only module that reads/writes
 * that table. It is entirely DERIVED data: `rebuildIndex` fully regenerates
 * it from disk, and the single source of truth for note CONTENT remains
 * the file on disk (`getNote` below always re-reads live -- it never
 * serves from this cache). See .rework/w8-PROGRESS.md's decisions log for
 * why `body_cache` exists despite that principle (search needs indexed
 * content; it's still fully derived + disposable).
 *
 * Pure graph/snippet/tree math lives in sibling files (linkGraph.ts,
 * snippets.ts, folderColors.ts, vaultTree.ts) so it can be unit-tested
 * without a database; this file is the thin orchestration glue.
 */
import { db } from "../DB";
import * as vaultFs from "./vault";
import {
    folderOfPath,
    noteTitle,
    parseFrontmatter,
    parseNote,
    stringifyNote,
    topFolderOfPath,
} from "./parse";
import {
    computeBacklinkCounts,
    getBacklinkEdgesFor,
    getOutlinkEdgesFor,
    resolveAllLinks,
    type IIndexedFileForGraph,
} from "./linkGraph";
import { buildSnippet, findFirstMatchIndex } from "./snippets";
import { assignFolderColors } from "./folderColors";
import { buildVaultTree } from "./vaultTree";
import type {
    IBacklinkEntry,
    IResolvableFile,
    ISearchResult,
    IVaultNote,
    IVaultTreeNode,
    IWikiGraph,
    IWikiGraphEdge,
    IWikiGraphNode,
    IWikiIndexRow,
    IWikilinkMatch,
} from "./types";

// SQLite's naive UTC timestamp strings need a "Z" to parse as UTC -- same
// trick as ProviderAccountsAPI.ts / ui/lib/utils.ts's convertDate,
// reimplemented locally rather than importing a ui/ util into core/.
function sqliteDate(value: string): Date {
    return new Date(value + "Z");
}

interface WikiIndexDbRow {
    vault_path: string;
    path: string;
    title: string;
    folder: string;
    frontmatter_json: string;
    links_json: string;
    body_cache: string;
    updated_at: string;
    indexed_at: string;
}

function rowToIndexed(row: WikiIndexDbRow): IWikiIndexRow {
    return {
        vaultPath: row.vault_path,
        path: row.path,
        title: row.title,
        folder: row.folder,
        // case (c), orchestration.md's as-policy: DB row -> typed mapping;
        // this column is JSON we serialized ourselves in upsertRow below.
        frontmatter: JSON.parse(row.frontmatter_json) as Record<string, unknown>,
        links: JSON.parse(row.links_json) as IWikilinkMatch[],
        bodyCache: row.body_cache,
        updatedAt: sqliteDate(row.updated_at),
        indexedAt: sqliteDate(row.indexed_at),
    };
}

async function getIndexRows(vaultPath: string): Promise<IWikiIndexRow[]> {
    const rows = await db.select<WikiIndexDbRow[]>(
        "SELECT * FROM wiki_index WHERE vault_path = ?",
        [vaultPath],
    );
    return rows.map(rowToIndexed);
}

async function upsertRow(row: IWikiIndexRow): Promise<void> {
    await db.execute(
        `INSERT OR REPLACE INTO wiki_index
            (vault_path, path, title, folder, frontmatter_json, links_json, body_cache, updated_at, indexed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            row.vaultPath,
            row.path,
            row.title,
            row.folder,
            JSON.stringify(row.frontmatter),
            JSON.stringify(row.links),
            row.bodyCache,
            row.updatedAt.toISOString(),
            row.indexedAt.toISOString(),
        ],
    );
}

function toGraphInput(rows: IWikiIndexRow[]): IIndexedFileForGraph[] {
    return rows.map((r) => ({ path: r.path, title: r.title, links: r.links }));
}

/** Parses + upserts a single file's index row (incremental update: used by
 *  the vault watcher's change handler and right after wiki-mcp's
 *  `write_note`). */
export async function indexFile(vaultPath: string, relativePath: string): Promise<void> {
    const raw = await vaultFs.readNoteRaw(vaultPath, relativePath);
    const parsed = parseNote(raw);
    const updatedAt = await vaultFs.getNoteMtime(vaultPath, relativePath);
    await upsertRow({
        vaultPath,
        path: relativePath,
        title: noteTitle(relativePath, parsed.frontmatter),
        folder: folderOfPath(relativePath),
        frontmatter: parsed.frontmatter,
        links: parsed.links,
        bodyCache: parsed.body,
        updatedAt,
        indexedAt: new Date(),
    });
}

/**
 * Frontmatter-safe write: if `newContent` carries no YAML frontmatter of
 * its own and the note already exists with some, the EXISTING frontmatter
 * is preserved and only the body is replaced (write_note's "frontmatter-
 * safe" requirement — a model rewriting "just the intro" shouldn't silently
 * erase `type`/`tags`/etc.). Re-indexes afterwards. Works for both create
 * and update -- there's nothing to preserve on a brand-new file.
 */
export async function writeNoteFrontmatterSafe(
    vaultPath: string,
    relativePath: string,
    newContent: string,
): Promise<void> {
    const { frontmatter: newFrontmatter, body: newBody } = parseFrontmatter(newContent);
    const hasOwnFrontmatter = Object.keys(newFrontmatter).length > 0;

    let finalContent = newContent;
    if (!hasOwnFrontmatter && (await vaultFs.noteExistsOnDisk(vaultPath, relativePath))) {
        const existingRaw = await vaultFs.readNoteRaw(vaultPath, relativePath);
        const { frontmatter: existingFrontmatter } = parseFrontmatter(existingRaw);
        if (Object.keys(existingFrontmatter).length > 0) {
            finalContent = stringifyNote(newBody, existingFrontmatter);
        }
    }

    await vaultFs.writeNoteRaw(vaultPath, relativePath, finalContent);
    await indexFile(vaultPath, relativePath);
}

export async function removeFileFromIndex(vaultPath: string, relativePath: string): Promise<void> {
    await db.execute("DELETE FROM wiki_index WHERE vault_path = ? AND path = ?", [
        vaultPath,
        relativePath,
    ]);
}

export interface IRebuildProgress {
    done: number;
    total: number;
}

/** Concurrency cap for rebuildIndex's fs reads -- keeps a ~1k-file vault
 *  from firing that many simultaneous Tauri IPC calls at once. */
const REBUILD_CONCURRENCY = 25;

/**
 * Fully regenerates the index from disk: walks every `.md` file, re-parses
 * and upserts it, then drops any cached row for a file that no longer
 * exists. This is the "Rebuild index" action's implementation, and is also
 * safe to call after picking a fresh vault.
 */
export async function rebuildIndex(
    vaultPath: string,
    onProgress?: (progress: IRebuildProgress) => void,
): Promise<void> {
    const files = await vaultFs.listVaultFiles(vaultPath);
    let done = 0;
    onProgress?.({ done, total: files.length });

    for (let i = 0; i < files.length; i += REBUILD_CONCURRENCY) {
        const batch = files.slice(i, i + REBUILD_CONCURRENCY);
        await Promise.all(
            batch.map(async (relativePath) => {
                try {
                    await indexFile(vaultPath, relativePath);
                } catch (error) {
                    console.error(`wiki: failed to index ${relativePath}`, error);
                }
                done += 1;
                onProgress?.({ done, total: files.length });
            }),
        );
    }

    const currentPaths = new Set(files);
    const existingRows = await getIndexRows(vaultPath);
    const stalePaths = existingRows.map((r) => r.path).filter((p) => !currentPaths.has(p));
    for (const stalePath of stalePaths) {
        await removeFileFromIndex(vaultPath, stalePath);
    }
}

/** Loads one note fresh from disk -- always the source of truth, never the
 *  cache (see this file's header comment). */
export async function getNote(vaultPath: string, relativePath: string): Promise<IVaultNote> {
    const raw = await vaultFs.readNoteRaw(vaultPath, relativePath);
    const parsed = parseNote(raw);
    const updatedAt = await vaultFs.getNoteMtime(vaultPath, relativePath);
    return {
        ...parsed,
        path: relativePath,
        folder: folderOfPath(relativePath),
        title: noteTitle(relativePath, parsed.frontmatter),
        updatedAt,
    };
}

export async function getBacklinks(
    vaultPath: string,
    targetPath: string,
): Promise<IBacklinkEntry[]> {
    const rows = await getIndexRows(vaultPath);
    const edges = resolveAllLinks(toGraphInput(rows));
    const rowsByPath = new Map(rows.map((r) => [r.path, r]));

    const bySource = new Map<string, IBacklinkEntry>();
    for (const edge of getBacklinkEdgesFor(edges, targetPath)) {
        const sourceRow = rowsByPath.get(edge.source);
        if (!sourceRow) continue;
        const existing = bySource.get(edge.source);
        if (existing) {
            existing.linkCount += 1;
            continue;
        }
        bySource.set(edge.source, {
            sourcePath: edge.source,
            sourceTitle: sourceRow.title,
            context: buildSnippet(sourceRow.bodyCache, edge.link.start, edge.link.end),
            linkCount: 1,
        });
    }
    return Array.from(bySource.values()).sort((a, b) => a.sourceTitle.localeCompare(b.sourceTitle));
}

const SEARCH_ROW_LIMIT = 200;

export async function searchVault(vaultPath: string, query: string): Promise<ISearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const matchedRows = (
        await db.select<WikiIndexDbRow[]>(
            `SELECT * FROM wiki_index
             WHERE vault_path = ?
               AND (title LIKE '%' || ? || '%' OR body_cache LIKE '%' || ? || '%')
             LIMIT ${SEARCH_ROW_LIMIT}`,
            [vaultPath, trimmed, trimmed],
        )
    ).map(rowToIndexed);

    const allRows = await getIndexRows(vaultPath);
    const backlinkCounts = computeBacklinkCounts(resolveAllLinks(toGraphInput(allRows)));

    const scored = matchedRows.map((row) => {
        const titleMatches = findFirstMatchIndex(row.title, trimmed) !== undefined;
        const bodyMatchIndex = findFirstMatchIndex(row.bodyCache, trimmed);
        const snippet =
            bodyMatchIndex !== undefined
                ? buildSnippet(row.bodyCache, bodyMatchIndex, bodyMatchIndex + trimmed.length)
                : row.bodyCache.replace(/\s+/g, " ").trim().slice(0, 60);
        const result: ISearchResult = {
            path: row.path,
            title: row.title,
            folder: row.folder,
            snippet,
            linkCount: backlinkCounts.get(row.path) ?? 0,
        };
        return { result, titleMatches };
    });

    return scored
        .sort((a, b) => {
            if (a.titleMatches !== b.titleMatches) return a.titleMatches ? -1 : 1;
            return a.result.title.localeCompare(b.result.title);
        })
        .map((s) => s.result);
}

function dedupeEdges(edges: IWikiGraphEdge[]): IWikiGraphEdge[] {
    const seen = new Set<string>();
    const result: IWikiGraphEdge[] = [];
    for (const edge of edges) {
        const key = [edge.source, edge.target].sort().join("::");
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(edge);
    }
    return result;
}

function buildGraphFromRows(rows: IWikiIndexRow[]): IWikiGraph {
    const edges = resolveAllLinks(toGraphInput(rows));
    const backlinkCounts = computeBacklinkCounts(edges);
    const topFolders = Array.from(new Set(rows.map((r) => topFolderOfPath(r.path))));
    const colors = assignFolderColors(topFolders);

    const nodes: IWikiGraphNode[] = rows.map((r) => {
        const topFolder = topFolderOfPath(r.path);
        return {
            id: r.path,
            label: r.title,
            folder: topFolder,
            color: colors.get(topFolder) ?? "helper",
            linkCount: backlinkCounts.get(r.path) ?? 0,
        };
    });

    return { nodes, edges: dedupeEdges(edges.map((e) => ({ source: e.source, target: e.target }))) };
}

export async function getGraph(vaultPath: string): Promise<IWikiGraph> {
    return buildGraphFromRows(await getIndexRows(vaultPath));
}

/** 1-hop subgraph around `focusPath`: the note itself, everything it links
 *  to, and everything that links to it (design/wiki.md's "Local graph"). */
export async function getLocalGraph(vaultPath: string, focusPath: string): Promise<IWikiGraph> {
    const rows = await getIndexRows(vaultPath);
    const edges = resolveAllLinks(toGraphInput(rows));

    const relevantPaths = new Set<string>([focusPath]);
    for (const edge of getOutlinkEdgesFor(edges, focusPath)) relevantPaths.add(edge.target);
    for (const edge of getBacklinkEdgesFor(edges, focusPath)) relevantPaths.add(edge.source);

    const relevantRows = rows.filter((r) => relevantPaths.has(r.path));
    const graph = buildGraphFromRows(relevantRows);
    // Keep only edges that actually touch the focus node -- buildGraphFromRows
    // resolves links among ALL relevant rows, which would otherwise also
    // surface an incidental edge between two of the focus node's neighbors.
    const edgesTouchingFocus = graph.edges.filter(
        (e) => e.source === focusPath || e.target === focusPath,
    );
    return { nodes: graph.nodes, edges: edgesTouchingFocus };
}

/** The vault tree (VaultTree.tsx): built from the LIVE disk listing (fast,
 *  no parsing) with backlink counts filled in from the cache -- so the
 *  tree renders immediately even before the first index rebuild finishes. */
export async function getVaultTree(vaultPath: string): Promise<IVaultTreeNode[]> {
    const [files, rows] = await Promise.all([
        vaultFs.listVaultFiles(vaultPath),
        getIndexRows(vaultPath),
    ]);
    const backlinkCounts = computeBacklinkCounts(resolveAllLinks(toGraphInput(rows)));
    return buildVaultTree(files, backlinkCounts);
}

/** The vault's known files as `{path, title}` pairs -- what
 *  `resolveWikilinkTarget` (parse.ts) needs to turn a `[[mention]]` into a
 *  real path for click-to-navigate / the "create?" affordance. Prefers the
 *  cached title, but falls back to a filename-derived one for a file that
 *  exists on disk but hasn't been indexed yet (just created, watcher
 *  hasn't caught up). */
export async function getResolvableFiles(vaultPath: string): Promise<IResolvableFile[]> {
    const [files, rows] = await Promise.all([
        vaultFs.listVaultFiles(vaultPath),
        getIndexRows(vaultPath),
    ]);
    const titleByPath = new Map(rows.map((r) => [r.path, r.title]));
    return files.map((path) => ({ path, title: titleByPath.get(path) ?? noteTitle(path, {}) }));
}

/** Whether the index has caught up to the vault at all (used to distinguish
 *  "empty vault" from "not indexed yet" in the UI's empty states). */
export async function hasIndexedAnyFiles(vaultPath: string): Promise<boolean> {
    const rows = await db.select<{ count: number }[]>(
        "SELECT COUNT(*) as count FROM wiki_index WHERE vault_path = ?",
        [vaultPath],
    );
    return (rows[0]?.count ?? 0) > 0;
}
