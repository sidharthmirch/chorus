import { useMemo } from "react";
import { buildKanbanColumns } from "@core/chorus/fleet/kanbanFormat";
import { IFleetSession, IMachine } from "@core/chorus/fleet/protocol";
import { KanbanColumn } from "./KanbanColumn";

/** The Board's 4 horizontally-scrollable kanban lanes (design/fleet.md). */
export function KanbanBoard({
    sessions,
    machines,
}: {
    sessions: IFleetSession[];
    machines: IMachine[];
}) {
    // `now` is captured once per sessions/machines change, not every
    // render — meta text like "queued 4m" only needs to be roughly live,
    // and pinning it to render count keeps buildKanbanColumns referentially
    // stable for a given input.
    const columns = useMemo(
        () => buildKanbanColumns(sessions, new Date()),
        [sessions],
    );

    return (
        <div className="flex h-full min-h-0 gap-3 overflow-x-auto px-4 py-3">
            {columns.map((column) => (
                <KanbanColumn
                    key={column.status}
                    column={column}
                    machines={machines}
                />
            ))}
        </div>
    );
}
