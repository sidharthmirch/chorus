/**
 * W8 — Wiki Vault. TanStack Query hooks over vault.ts/index.ts -- the only
 * place UI code reaches for wiki data, mirroring W7's `fleet/useFleet.ts`
 * precedent (hooks live inside the workstream's own folder rather than a
 * new `api/WikiAPI.ts`).
 */
import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as vault from "./vault";
import { noteTitle, resolveWikilinkTarget, titleFromPath } from "./parse";
import {
    getBacklinks,
    getGraph,
    getLocalGraph,
    getNote,
    getResolvableFiles,
    getVaultTree,
    hasIndexedAnyFiles,
    indexFile,
    rebuildIndex,
    removeFileFromIndex,
    searchVault,
    writeNoteFrontmatterSafe,
    type IRebuildProgress,
} from "./index";

const wikiKeys = {
    vaultPath: () => ["wiki", "vaultPath"] as const,
    tree: (vaultPath: string | undefined) => ["wiki", "tree", vaultPath] as const,
    note: (vaultPath: string | undefined, path: string | undefined) =>
        ["wiki", "note", vaultPath, path] as const,
    backlinks: (vaultPath: string | undefined, path: string | undefined) =>
        ["wiki", "backlinks", vaultPath, path] as const,
    search: (vaultPath: string | undefined, query: string) =>
        ["wiki", "search", vaultPath, query] as const,
    graph: (vaultPath: string | undefined) => ["wiki", "graph", vaultPath] as const,
    localGraph: (vaultPath: string | undefined, path: string | undefined) =>
        ["wiki", "localGraph", vaultPath, path] as const,
    resolvableFiles: (vaultPath: string | undefined) =>
        ["wiki", "resolvableFiles", vaultPath] as const,
    hasIndexed: (vaultPath: string | undefined) => ["wiki", "hasIndexed", vaultPath] as const,
};

/** Invalidates every wiki query -- used after anything that can change
 *  vault content (index rebuild, note create/write, an external fs
 *  change). Wiki queries are cheap to refetch and there's no benefit to
 *  hand-picking which ones changed. */
function invalidateAllWikiQueries(queryClient: QueryClient) {
    return queryClient.invalidateQueries({ queryKey: ["wiki"] });
}

function requireVaultPath(vaultPath: string | undefined): string {
    if (!vaultPath) throw new Error("No vault selected yet");
    return vaultPath;
}

export function useVaultPath() {
    return useQuery({
        queryKey: wikiKeys.vaultPath(),
        queryFn: vault.getVaultPath,
    });
}

/** Opens the folder picker, persists the choice, and runs a full index
 *  build before resolving -- so by the time this settles, the vault is
 *  ready to browse. Returns undefined (not an error) if the user cancels. */
export function usePickVault() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["wiki", "pickVault"] as const,
        mutationFn: async (): Promise<string | undefined> => {
            const picked = await vault.pickVaultDirectory();
            if (!picked) return undefined;
            await vault.setVaultPath(picked);
            await rebuildIndex(picked);
            return picked;
        },
        onSuccess: async (picked) => {
            if (!picked) return;
            await invalidateAllWikiQueries(queryClient);
        },
        onError: (error) => {
            toast.error("Couldn't open that vault", {
                description: error instanceof Error ? error.message : undefined,
            });
        },
    });
}

export function useRebuildIndex(vaultPath: string | undefined) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["wiki", "rebuildIndex"] as const,
        mutationFn: async (onProgress?: (progress: IRebuildProgress) => void) => {
            await rebuildIndex(requireVaultPath(vaultPath), onProgress);
        },
        onSuccess: async () => {
            await invalidateAllWikiQueries(queryClient);
        },
        onError: (error) => {
            toast.error("Couldn't rebuild the wiki index", {
                description: error instanceof Error ? error.message : undefined,
            });
        },
    });
}

/** Watches the active vault for external changes (another editor, git
 *  checkout) and invalidates wiki queries on change. Mount once, near the
 *  top of the /wiki route. */
export function useWikiVaultWatcher(vaultPath: string | undefined) {
    const queryClient = useQueryClient();
    useEffect(() => {
        if (!vaultPath) return;
        let cancelled = false;
        let unwatch: (() => void) | undefined;

        void vault.watchVault(vaultPath, () => {
            void invalidateAllWikiQueries(queryClient);
        }).then((fn) => {
            if (cancelled) {
                fn?.();
            } else {
                unwatch = fn;
            }
        });

        return () => {
            cancelled = true;
            unwatch?.();
        };
    }, [vaultPath, queryClient]);
}

export function useVaultTree(vaultPath: string | undefined) {
    return useQuery({
        queryKey: wikiKeys.tree(vaultPath),
        queryFn: () => getVaultTree(requireVaultPath(vaultPath)),
        enabled: vaultPath !== undefined,
    });
}

export function useHasIndexedAnyFiles(vaultPath: string | undefined) {
    return useQuery({
        queryKey: wikiKeys.hasIndexed(vaultPath),
        queryFn: () => hasIndexedAnyFiles(requireVaultPath(vaultPath)),
        enabled: vaultPath !== undefined,
    });
}

export function useNote(vaultPath: string | undefined, path: string | undefined) {
    return useQuery({
        queryKey: wikiKeys.note(vaultPath, path),
        queryFn: () => getNote(requireVaultPath(vaultPath), path ?? ""),
        enabled: vaultPath !== undefined && path !== undefined,
    });
}

export function useBacklinks(vaultPath: string | undefined, path: string | undefined) {
    return useQuery({
        queryKey: wikiKeys.backlinks(vaultPath, path),
        queryFn: () => getBacklinks(requireVaultPath(vaultPath), path ?? ""),
        enabled: vaultPath !== undefined && path !== undefined,
    });
}

export function useSearchVault(vaultPath: string | undefined, query: string) {
    const trimmed = query.trim();
    return useQuery({
        queryKey: wikiKeys.search(vaultPath, trimmed),
        queryFn: () => searchVault(requireVaultPath(vaultPath), trimmed),
        enabled: vaultPath !== undefined && trimmed.length > 0,
    });
}

export function useVaultGraph(vaultPath: string | undefined) {
    return useQuery({
        queryKey: wikiKeys.graph(vaultPath),
        queryFn: () => getGraph(requireVaultPath(vaultPath)),
        enabled: vaultPath !== undefined,
    });
}

export function useLocalGraph(vaultPath: string | undefined, path: string | undefined) {
    return useQuery({
        queryKey: wikiKeys.localGraph(vaultPath, path),
        queryFn: () => getLocalGraph(requireVaultPath(vaultPath), path ?? ""),
        enabled: vaultPath !== undefined && path !== undefined,
    });
}

function useResolvableFiles(vaultPath: string | undefined) {
    return useQuery({
        queryKey: wikiKeys.resolvableFiles(vaultPath),
        queryFn: () => getResolvableFiles(requireVaultPath(vaultPath)),
        enabled: vaultPath !== undefined,
    });
}

/** Resolves a `[[mention]]`'s target to a vault-relative path (or undefined
 *  if no note matches yet) -- what WikiLinkToken uses to decide between
 *  "navigate" and the subdued "create?" affordance. */
export function useResolveWikilink(
    vaultPath: string | undefined,
    target: string,
): string | undefined {
    const { data: files } = useResolvableFiles(vaultPath);
    return useMemo(() => {
        if (!files) return undefined;
        return resolveWikilinkTarget(target, files);
    }, [files, target]);
}

export function useCreateNote(vaultPath: string | undefined) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["wiki", "createNote"] as const,
        mutationFn: async ({ path, initialBody }: { path: string; initialBody?: string }) => {
            const resolvedVaultPath = requireVaultPath(vaultPath);
            const alreadyExists = await vault.noteExistsOnDisk(resolvedVaultPath, path);
            if (alreadyExists) {
                throw new Error(`"${path}" already exists`);
            }
            const body = initialBody ?? `# ${titleFromPath(path)}\n\n`;
            await vault.writeNoteRaw(resolvedVaultPath, path, body);
            await indexFile(resolvedVaultPath, path);
            return path;
        },
        onSuccess: async () => {
            await invalidateAllWikiQueries(queryClient);
        },
        onError: (error) => {
            toast.error("Couldn't create that note", {
                description: error instanceof Error ? error.message : undefined,
            });
        },
    });
}

export function useSaveNote(vaultPath: string | undefined) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["wiki", "saveNote"] as const,
        mutationFn: async ({ path, content }: { path: string; content: string }) => {
            const resolvedVaultPath = requireVaultPath(vaultPath);
            // Frontmatter-safe: a future note editor that only edits the
            // body shouldn't have to round-trip frontmatter it never
            // touched (same reasoning as wiki-mcp's write_note).
            await writeNoteFrontmatterSafe(resolvedVaultPath, path, content);
            return path;
        },
        onSuccess: async () => {
            await invalidateAllWikiQueries(queryClient);
        },
        onError: (error) => {
            toast.error("Couldn't save that note", {
                description: error instanceof Error ? error.message : undefined,
            });
        },
    });
}

export function useDeleteNote(vaultPath: string | undefined) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["wiki", "deleteNote"] as const,
        mutationFn: async (path: string) => {
            const resolvedVaultPath = requireVaultPath(vaultPath);
            await vault.deleteNoteRaw(resolvedVaultPath, path);
            await removeFileFromIndex(resolvedVaultPath, path);
            return path;
        },
        onSuccess: async () => {
            await invalidateAllWikiQueries(queryClient);
        },
        onError: (error) => {
            toast.error("Couldn't delete that note", {
                description: error instanceof Error ? error.message : undefined,
            });
        },
    });
}

/** Re-exported so UI code can build a title suggestion from a path without
 *  its own import of parse.ts. */
export { noteTitle, titleFromPath };
