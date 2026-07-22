import { useEffect, useMemo, useState } from "react";
import { Input } from "@ui/components/ui/input";
import RetroSpinner from "@ui/components/ui/retro-spinner";
import { cn } from "@ui/lib/utils";
import { useVaultGraph } from "@core/chorus/wiki/useWiki";
import { layoutGraphByFolder } from "@core/chorus/wiki/graphLayout";
import type { WikiFolderColor } from "@core/chorus/wiki/types";
import { WikiGraphSvg } from "./WikiGraphSvg";
import { WIKI_FOLDER_FILL_CLASS } from "./folderColorClasses";

const GRAPH_WIDTH = 760;
const GRAPH_HEIGHT = 520;

/** Full graph view (design/wiki.md): folder-color legend, a filter query
 *  that dims non-matching nodes with an "N of M nodes" mono readout, click
 *  to navigate. Static SVG layout grouped by folder -- no physics. */
export function GraphView({
    vaultPath,
    initialFilter,
    onNavigate,
}: {
    vaultPath: string | undefined;
    initialFilter?: string;
    onNavigate: (path: string) => void;
}) {
    const [filter, setFilter] = useState(initialFilter ?? "");

    useEffect(() => {
        if (initialFilter !== undefined) setFilter(initialFilter);
    }, [initialFilter]);

    const graphQuery = useVaultGraph(vaultPath);
    const graph = graphQuery.data;

    const positions = useMemo(() => {
        if (!graph) return [];
        return layoutGraphByFolder(graph.nodes, { width: GRAPH_WIDTH, height: GRAPH_HEIGHT });
    }, [graph]);

    const legend = useMemo(() => {
        if (!graph) return [];
        const seen = new Map<string, WikiFolderColor>();
        for (const node of graph.nodes) {
            if (!seen.has(node.folder)) seen.set(node.folder, node.color);
        }
        return Array.from(seen.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [graph]);

    const trimmedFilter = filter.trim().toLowerCase();
    const matchingIds = useMemo(() => {
        if (!graph || !trimmedFilter) return undefined;
        return new Set(
            graph.nodes
                .filter(
                    (n) =>
                        n.label.toLowerCase().includes(trimmedFilter) ||
                        n.folder.toLowerCase().includes(trimmedFilter),
                )
                .map((n) => n.id),
        );
    }, [graph, trimmedFilter]);

    const dimmedIds = useMemo(() => {
        if (!graph || !matchingIds) return undefined;
        return new Set(graph.nodes.filter((n) => !matchingIds.has(n.id)).map((n) => n.id));
    }, [graph, matchingIds]);

    if (graphQuery.isPending) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground">
                <RetroSpinner />
            </div>
        );
    }

    if (!graph || graph.nodes.length === 0) {
        return (
            <p className="p-6 text-sm text-muted-foreground">
                Nothing to graph yet — add some [[wikilinks]] between notes.
            </p>
        );
    }

    return (
        <div className="h-full flex flex-col gap-4 px-6 py-5">
            <div className="flex items-center gap-4 flex-wrap shrink-0">
                <Input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter…"
                    className="max-w-xs"
                />
                <div className="flex items-center gap-3 flex-wrap">
                    {legend.map(([folder, color]) => (
                        <div key={folder} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className={cn("size-2 rounded-full inline-block", WIKI_FOLDER_FILL_CLASS[color])} />
                            {folder || "(root)"}
                        </div>
                    ))}
                </div>
                {matchingIds && (
                    <span className="font-geist-mono text-xs text-muted-foreground ml-auto">
                        {matchingIds.size} of {graph.nodes.length} nodes
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-auto">
                <WikiGraphSvg
                    nodes={graph.nodes}
                    edges={graph.edges}
                    positions={positions}
                    dimmedIds={dimmedIds}
                    onNodeClick={onNavigate}
                    width={GRAPH_WIDTH}
                    height={GRAPH_HEIGHT}
                />
            </div>
        </div>
    );
}
