/**
 * W8 — Wiki Vault. Deterministic, physics-free node layout for the graph
 * views (00-ARCHITECTURE.md §7 / P4 brief: "static SVG, hand-placed-node
 * aesthetic -- no physics lib"). `reagraph` is already a project
 * dependency (added for some other purpose) but is a WebGL force-directed
 * engine and is deliberately unused here.
 *
 * Two layouts: a radial ring for the 1-hop local graph (focus node
 * centered, its neighbors evenly spaced around it), and a grid-of-clusters
 * for the full graph (one cluster per top-level folder, arranged in a
 * grid; nodes within a cluster arranged in their own small grid). Both are
 * pure functions of their inputs -- same graph in, same layout out, every
 * time, so re-renders never jitter.
 */

export interface IGraphNodePosition {
    id: string;
    x: number;
    y: number;
}

export interface IGraphLayoutBounds {
    width: number;
    height: number;
}

const RING_MARGIN = 24;

/**
 * Focus node at the center; every other node evenly spaced on a ring
 * around it, in a stable (sorted) order.
 */
export function layoutLocalGraph(
    nodeIds: string[],
    focusId: string,
    { width, height }: IGraphLayoutBounds,
): IGraphNodePosition[] {
    const centerX = width / 2;
    const centerY = height / 2;
    const others = nodeIds.filter((id) => id !== focusId).sort();
    const radius = Math.max(0, Math.min(width, height) / 2 - RING_MARGIN);

    const positions: IGraphNodePosition[] = [{ id: focusId, x: centerX, y: centerY }];
    const count = others.length;
    others.forEach((id, i) => {
        const angle = (2 * Math.PI * i) / count - Math.PI / 2;
        positions.push({
            id,
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
        });
    });
    return positions;
}

function layoutCluster(
    ids: string[],
    centerX: number,
    centerY: number,
    cellWidth: number,
    cellHeight: number,
): IGraphNodePosition[] {
    if (ids.length === 0) return [];
    const cols = Math.max(1, Math.ceil(Math.sqrt(ids.length)));
    const rows = Math.max(1, Math.ceil(ids.length / cols));
    const spacingX = cellWidth / (cols + 1);
    const spacingY = cellHeight / (rows + 1);

    return ids.map((id, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return {
            id,
            x: centerX + (col - (cols - 1) / 2) * spacingX,
            y: centerY + (row - (rows - 1) / 2) * spacingY,
        };
    });
}

/** One grid cell per folder (sorted for determinism), each containing its
 *  own small grid of nodes. `nodesByFolder` values should already be in a
 *  stable order (callers typically sort by id first). */
export function layoutFullGraph(
    nodesByFolder: Map<string, string[]>,
    { width, height }: IGraphLayoutBounds,
): IGraphNodePosition[] {
    const folders = Array.from(nodesByFolder.keys()).sort();
    if (folders.length === 0) return [];

    const cols = Math.max(1, Math.ceil(Math.sqrt(folders.length)));
    const rows = Math.max(1, Math.ceil(folders.length / cols));
    const cellWidth = width / cols;
    const cellHeight = height / rows;

    return folders.flatMap((folder, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        return layoutCluster(
            nodesByFolder.get(folder) ?? [],
            cellWidth * col + cellWidth / 2,
            cellHeight * row + cellHeight / 2,
            cellWidth,
            cellHeight,
        );
    });
}

/** Convenience over layoutFullGraph for callers holding a flat node list
 *  (index.ts's `IWikiGraphNode[]` shape: anything with `id` + `folder`). */
export function layoutGraphByFolder(
    nodes: Array<{ id: string; folder: string }>,
    bounds: IGraphLayoutBounds,
): IGraphNodePosition[] {
    const byFolder = new Map<string, string[]>();
    for (const node of [...nodes].sort((a, b) => a.id.localeCompare(b.id))) {
        const list = byFolder.get(node.folder);
        if (list) {
            list.push(node.id);
        } else {
            byFolder.set(node.folder, [node.id]);
        }
    }
    return layoutFullGraph(byFolder, bounds);
}
