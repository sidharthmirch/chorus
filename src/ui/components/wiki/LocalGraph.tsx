import { useMemo } from "react";
import RetroSpinner from "@ui/components/ui/retro-spinner";
import { useLocalGraph } from "@core/chorus/wiki/useWiki";
import { layoutLocalGraph } from "@core/chorus/wiki/graphLayout";
import { WikiGraphSvg } from "./WikiGraphSvg";

// design/wiki.md: "~300px wide, 200px tall" for the note view's local graph.
const GRAPH_WIDTH = 280;
const GRAPH_HEIGHT = 220;

/** The note view's right-rail 1-hop graph: the current note plus everything
 *  it links to and everything that links to it. Static SVG, no physics. */
export function LocalGraph({
    vaultPath,
    path,
    onNavigate,
}: {
    vaultPath: string | undefined;
    path: string;
    onNavigate: (path: string) => void;
}) {
    const { data: graph, isPending } = useLocalGraph(vaultPath, path);

    const positions = useMemo(() => {
        if (!graph) return [];
        return layoutLocalGraph(graph.nodes.map((n) => n.id), path, {
            width: GRAPH_WIDTH,
            height: GRAPH_HEIGHT,
        });
    }, [graph, path]);

    if (isPending) {
        return (
            <div
                className="flex items-center justify-center text-muted-foreground"
                style={{ width: GRAPH_WIDTH, height: GRAPH_HEIGHT }}
            >
                <RetroSpinner />
            </div>
        );
    }

    if (!graph || graph.nodes.length <= 1) {
        return (
            <p className="text-sm text-muted-foreground" style={{ width: GRAPH_WIDTH }}>
                No connections yet.
            </p>
        );
    }

    return (
        <WikiGraphSvg
            nodes={graph.nodes}
            edges={graph.edges}
            positions={positions}
            focusId={path}
            onNodeClick={onNavigate}
            width={GRAPH_WIDTH}
            height={GRAPH_HEIGHT}
        />
    );
}
