import { useMemo } from "react";
import { cn } from "@ui/lib/utils";
import type { IGraphNodePosition } from "@core/chorus/wiki/graphLayout";
import type { IWikiGraphEdge, IWikiGraphNode } from "@core/chorus/wiki/types";
import { WIKI_FOLDER_FILL_CLASS } from "./folderColorClasses";

const REGULAR_RADIUS = 9;
const FOCUS_RADIUS = 13;

function truncateLabel(label: string, max = 16): string {
    return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

/**
 * Shared static-SVG graph renderer (local 1-hop graph + full graph view).
 * No physics/force layout -- `positions` are computed ahead of time by
 * `core/chorus/wiki/graphLayout.ts`; this component only draws. Nodes:
 * diamond = focus/main (design/wiki.md: ◆), circle = everything else (●).
 */
export function WikiGraphSvg({
    nodes,
    edges,
    positions,
    focusId,
    dimmedIds,
    onNodeClick,
    width,
    height,
}: {
    nodes: IWikiGraphNode[];
    edges: IWikiGraphEdge[];
    positions: IGraphNodePosition[];
    focusId?: string;
    /** Node ids to render at reduced opacity -- graph view's filter query
     *  dimming non-matches (design/wiki.md). */
    dimmedIds?: Set<string>;
    onNodeClick: (id: string) => void;
    width: number;
    height: number;
}) {
    const positionById = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions]);
    const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="overflow-visible"
        >
            <g>
                {edges.map((edge) => {
                    const from = positionById.get(edge.source);
                    const to = positionById.get(edge.target);
                    if (!from || !to) return null;
                    const dimmed = dimmedIds?.has(edge.source) || dimmedIds?.has(edge.target);
                    return (
                        <line
                            key={`${edge.source}->${edge.target}`}
                            x1={from.x}
                            y1={from.y}
                            x2={to.x}
                            y2={to.y}
                            className={cn("stroke-border", dimmed && "opacity-30")}
                            strokeWidth={1}
                        />
                    );
                })}
            </g>
            <g>
                {positions.map((pos) => {
                    const node = nodeById.get(pos.id);
                    if (!node) return null;
                    const isFocus = pos.id === focusId;
                    const dimmed = dimmedIds?.has(pos.id);
                    const radius = isFocus ? FOCUS_RADIUS : REGULAR_RADIUS;
                    const fillClass = WIKI_FOLDER_FILL_CLASS[node.color];

                    return (
                        <g
                            key={pos.id}
                            role="button"
                            tabIndex={0}
                            className={cn("cursor-pointer", dimmed && "opacity-30")}
                            onClick={() => onNodeClick(pos.id)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") onNodeClick(pos.id);
                            }}
                        >
                            <title>{node.label}</title>
                            {isFocus ? (
                                <rect
                                    x={pos.x - radius}
                                    y={pos.y - radius}
                                    width={radius * 2}
                                    height={radius * 2}
                                    transform={`rotate(45 ${pos.x} ${pos.y})`}
                                    className={cn(fillClass, "hover:opacity-80 transition-opacity")}
                                />
                            ) : (
                                <circle
                                    cx={pos.x}
                                    cy={pos.y}
                                    r={radius}
                                    className={cn(fillClass, "hover:opacity-80 transition-opacity")}
                                />
                            )}
                            <text
                                x={pos.x}
                                y={pos.y + radius + 12}
                                textAnchor="middle"
                                className="fill-muted-foreground font-geist-mono text-xs select-none"
                            >
                                {truncateLabel(node.label)}
                            </text>
                        </g>
                    );
                })}
            </g>
        </svg>
    );
}
