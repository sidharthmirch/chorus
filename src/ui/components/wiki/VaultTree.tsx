import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@ui/lib/utils";
import type { IVaultTreeNode } from "@core/chorus/wiki/types";

const INDENT_PER_DEPTH = 14;
const BASE_PADDING = 10;
/** Files have no expand chevron -- nudge them to align under a folder's label. */
const FILE_EXTRA_PADDING = 16;

function TreeNodeRow({
    node,
    depth,
    activePath,
    collapsedFolders,
    onToggleFolder,
    onSelectFile,
}: {
    node: IVaultTreeNode;
    depth: number;
    activePath: string | undefined;
    collapsedFolders: Set<string>;
    onToggleFolder: (path: string) => void;
    onSelectFile: (path: string) => void;
}) {
    if (node.kind === "folder") {
        const isCollapsed = collapsedFolders.has(node.path);
        return (
            <div>
                <button
                    type="button"
                    className="w-full flex items-center gap-1.5 py-1 pr-2 rounded hover:bg-muted text-muted-foreground"
                    style={{ paddingLeft: BASE_PADDING + depth * INDENT_PER_DEPTH }}
                    onClick={() => onToggleFolder(node.path)}
                >
                    {isCollapsed ? (
                        <ChevronRightIcon className="size-3 shrink-0" strokeWidth={1.5} />
                    ) : (
                        <ChevronDownIcon className="size-3 shrink-0" strokeWidth={1.5} />
                    )}
                    <span className="text-sm truncate flex-1 text-left">{node.name}</span>
                    <span className="font-geist-mono text-xs text-muted-foreground shrink-0">
                        ({node.fileCount})
                    </span>
                </button>
                {!isCollapsed &&
                    node.children.map((child) => (
                        <TreeNodeRow
                            key={child.path}
                            node={child}
                            depth={depth + 1}
                            activePath={activePath}
                            collapsedFolders={collapsedFolders}
                            onToggleFolder={onToggleFolder}
                            onSelectFile={onSelectFile}
                        />
                    ))}
            </div>
        );
    }

    const isActive = node.path === activePath;
    return (
        <button
            type="button"
            className={cn(
                "w-full flex items-center gap-1.5 py-1 pr-2 rounded hover:bg-muted text-left",
                isActive ? "bg-muted text-foreground" : "text-muted-foreground",
            )}
            style={{ paddingLeft: BASE_PADDING + depth * INDENT_PER_DEPTH + FILE_EXTRA_PADDING }}
            onClick={() => onSelectFile(node.path)}
        >
            <span className="text-sm truncate flex-1 font-geist-mono">{node.name}</span>
            {node.linkCount !== undefined && (
                <span className="font-geist-mono text-xs text-muted-foreground shrink-0">
                    ({node.linkCount})
                </span>
            )}
        </button>
    );
}

/** Vault tree (design/wiki.md: nested folders with a file count, mono file
 *  rows with a backlink-count badge, active highlight). Expansion state is
 *  local and defaults everyone open (an empty "collapsed" set). */
export function VaultTree({
    tree,
    activePath,
    onSelectFile,
}: {
    tree: IVaultTreeNode[];
    activePath: string | undefined;
    onSelectFile: (path: string) => void;
}) {
    const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

    const onToggleFolder = (path: string) => {
        setCollapsedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    };

    if (tree.length === 0) {
        return <p className="px-3 py-2 text-sm text-muted-foreground">No notes found.</p>;
    }

    return (
        <div className="flex flex-col py-2">
            {tree.map((node) => (
                <TreeNodeRow
                    key={node.path}
                    node={node}
                    depth={0}
                    activePath={activePath}
                    collapsedFolders={collapsedFolders}
                    onToggleFolder={onToggleFolder}
                    onSelectFile={onSelectFile}
                />
            ))}
        </div>
    );
}
