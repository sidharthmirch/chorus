/**
 * W8 — Wiki Vault. Pure builder for the vault tree shown in VaultTree.tsx
 * (design/wiki.md: nested folders with a file count, mono file rows with a
 * backlink-count badge). Takes a flat file list (vault.ts's live disk
 * walk) plus a path -> backlink-count map (index.ts's cache-derived
 * counts) so the tree renders immediately from disk even before the index
 * has caught up -- counts simply fill in as undefined until then.
 */
import type { IVaultTreeFile, IVaultTreeNode } from "./types";

interface Builder {
    folders: Map<string, Builder>;
    files: IVaultTreeFile[];
}

function countFiles(nodes: IVaultTreeNode[]): number {
    return nodes.reduce((sum, node) => sum + (node.kind === "file" ? 1 : node.fileCount), 0);
}

function materialize(builder: Builder, parentPath: string): IVaultTreeNode[] {
    const folderNodes: IVaultTreeNode[] = Array.from(builder.folders.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, child]) => {
            const path = parentPath ? `${parentPath}/${name}` : name;
            const children = materialize(child, path);
            return {
                kind: "folder" as const,
                name,
                path,
                children,
                fileCount: countFiles(children),
            };
        });

    const fileNodes: IVaultTreeNode[] = builder.files
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));

    // Folders before files, matching design/wiki.md's tree mock.
    return [...folderNodes, ...fileNodes];
}

/**
 * Builds a nested tree from a flat list of vault-relative file paths.
 * `linkCounts` (path -> backlink count) is best-effort: a file with no
 * entry (not indexed yet) renders with an undefined count badge rather
 * than a misleading 0.
 */
export function buildVaultTree(
    files: string[],
    linkCounts: Map<string, number>,
): IVaultTreeNode[] {
    const root: Builder = { folders: new Map(), files: [] };

    for (const filePath of files) {
        const segments = filePath.split("/");
        const fileName = segments[segments.length - 1];
        let cursor = root;
        for (let i = 0; i < segments.length - 1; i++) {
            const segment = segments[i];
            let next = cursor.folders.get(segment);
            if (!next) {
                next = { folders: new Map(), files: [] };
                cursor.folders.set(segment, next);
            }
            cursor = next;
        }
        cursor.files.push({
            kind: "file",
            name: fileName,
            path: filePath,
            linkCount: linkCounts.get(filePath),
        });
    }

    return materialize(root, "");
}
