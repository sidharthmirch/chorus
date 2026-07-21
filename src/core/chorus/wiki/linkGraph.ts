/**
 * W8 — Wiki Vault. Pure link-resolution logic shared by backlinks, search
 * ranking, and both graph views. Given the vault's known files and each
 * file's raw `[[mention]]`s, resolves mentions to real paths (via
 * parse.ts's `resolveWikilinkTarget`) and derives edges/counts from that.
 * Deliberately disk/DB-agnostic -- index.ts feeds this the rows it already
 * has, so this stays fully unit-testable.
 */
import { resolveWikilinkTarget } from "./parse";
import type { IResolvableFile, IWikilinkMatch } from "./types";

export interface IIndexedFileForGraph extends IResolvableFile {
    links: IWikilinkMatch[];
}

export interface IResolvedEdge {
    source: string;
    target: string;
    link: IWikilinkMatch;
}

/**
 * Resolves every file's raw mentions against the vault's known file list.
 * Mentions that don't resolve to an existing note are dropped here (the UI
 * shows those as a "create?" affordance inline, not as a graph edge/
 * backlink); self-links are dropped too (a note linking to itself isn't a
 * meaningful backlink).
 */
export function resolveAllLinks(files: IIndexedFileForGraph[]): IResolvedEdge[] {
    const resolvable: IResolvableFile[] = files.map((f) => ({ path: f.path, title: f.title }));
    const edges: IResolvedEdge[] = [];
    for (const file of files) {
        for (const link of file.links) {
            const target = resolveWikilinkTarget(link.target, resolvable);
            if (target && target !== file.path) {
                edges.push({ source: file.path, target, link });
            }
        }
    }
    return edges;
}

export function computeBacklinkCounts(edges: IResolvedEdge[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const edge of edges) {
        counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
    }
    return counts;
}

export function getBacklinkEdgesFor(edges: IResolvedEdge[], targetPath: string): IResolvedEdge[] {
    return edges.filter((e) => e.target === targetPath);
}

export function getOutlinkEdgesFor(edges: IResolvedEdge[], sourcePath: string): IResolvedEdge[] {
    return edges.filter((e) => e.source === sourcePath);
}
