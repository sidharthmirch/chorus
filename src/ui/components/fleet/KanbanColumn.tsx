import { FLEET_COLUMN_DOT_TONE } from "@core/chorus/fleet/copy";
import { IKanbanColumn, IMachine } from "@core/chorus/fleet/protocol";
import { KanbanCard } from "./KanbanCard";
import { FleetStatusDot } from "./FleetStatusDot";

/** One of the Board's 4 fixed lanes — see design/fleet.md's Kanban Board Component Inventory. */
export function KanbanColumn({
    column,
    machines,
}: {
    column: IKanbanColumn;
    machines: IMachine[];
}) {
    return (
        <div className="flex h-full w-72 shrink-0 flex-col">
            <div className="flex items-center gap-1.5 px-1 pb-2">
                <FleetStatusDot tone={FLEET_COLUMN_DOT_TONE[column.status]} />
                <h3 className="text-sm text-foreground">{column.label}</h3>
                <span className="font-geist-mono text-[10px] tabular-nums text-muted-foreground">
                    {column.cards.length}
                </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2">
                {column.cards.length === 0 ? (
                    <p className="px-1 text-xs text-muted-foreground">
                        Nothing here.
                    </p>
                ) : (
                    column.cards.map((card) => (
                        <KanbanCard
                            key={card.session.id}
                            card={card}
                            machines={machines}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
