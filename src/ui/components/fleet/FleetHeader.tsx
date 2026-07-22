import { Tabs, TabsList, TabsTrigger } from "@ui/components/ui/tabs";
import { FleetViewId } from "./FleetView.types";

/**
 * "Fleet · self-hosted runner mesh · fleetd v0.3" + the Board/Worktrees
 * segmented control — exact copy from the design mock's Fleet Board header.
 * Segmented-control styling mirrors `ArtifactPanel.tsx`'s Preview/Code tabs
 * (`data-[state=active]:bg-foreground data-[state=active]:text-background`),
 * the established pattern for this kind of pill switcher in this codebase.
 */
export function FleetHeader({
    view,
    onViewChange,
}: {
    view: FleetViewId;
    onViewChange: (view: FleetViewId) => void;
}) {
    return (
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex min-w-0 flex-1 items-baseline gap-2">
                <h1 className="text-lg text-foreground">Fleet</h1>
                <span className="truncate font-geist-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    self-hosted runner mesh · fleetd v0.3
                </span>
            </div>
            <Tabs
                value={view}
                onValueChange={(value) =>
                    onViewChange(value === "worktrees" ? "worktrees" : "board")
                }
            >
                <TabsList className="h-7 gap-0.5 bg-muted p-0.5">
                    <TabsTrigger
                        value="board"
                        className="h-6 rounded-sm px-2.5 text-xs data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none"
                    >
                        Board
                    </TabsTrigger>
                    <TabsTrigger
                        value="worktrees"
                        className="h-6 rounded-sm px-2.5 text-xs data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none"
                    >
                        Worktrees
                    </TabsTrigger>
                </TabsList>
            </Tabs>
        </div>
    );
}
