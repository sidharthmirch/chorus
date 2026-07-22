import { useState } from "react";
import {
    FLEET_FOOTER_HINT_BOARD,
    FLEET_FOOTER_HINT_WORKTREES,
} from "@core/chorus/fleet/copy";
import { useFleetEndpoint } from "@core/chorus/fleet/fleetSettings";
import {
    useFleetConnectionState,
    useFleetFeatures,
    useFleetMachines,
    useFleetSessions,
} from "@core/chorus/fleet/useFleet";
import RetroSpinner from "@ui/components/ui/retro-spinner";
import { CostPresetsPanel } from "./CostPresetsPanel";
import { FleetEmptyState } from "./FleetEmptyState";
import { FleetFooterHint } from "./FleetFooterHint";
import { FleetHeader } from "./FleetHeader";
import { FleetViewId } from "./FleetView.types";
import { KanbanBoard } from "./KanbanBoard";
import { MachinesStrip } from "./MachinesStrip";
import { WorktreesView } from "./WorktreesView";

/**
 * `/fleet` — Board (default) + Worktrees. See docs/rework/design/fleet.md
 * for the full spec and docs/rework/agents/W7-fleet.md for the phase plan
 * this was built against.
 */
export default function FleetView() {
    const [view, setView] = useState<FleetViewId>("board");
    const connectionState = useFleetConnectionState();
    const endpoint = useFleetEndpoint();
    const sessionsQuery = useFleetSessions();
    const machinesQuery = useFleetMachines();
    const featuresQuery = useFleetFeatures();

    // Only the default (no-endpoint) Mock adapter reports "connected"
    // instantly — a real, misconfigured/unreachable fleetd should show an
    // honest empty state rather than an empty board (fleet-protocol.md §5).
    const isReachable = connectionState === "connected";
    const isInitialLoad =
        isReachable &&
        (view === "board"
            ? sessionsQuery.isPending || machinesQuery.isPending
            : featuresQuery.isPending);

    return (
        <div className="flex h-full min-h-0 flex-col bg-background">
            <FleetHeader view={view} onViewChange={setView} />

            <div className="flex min-h-0 flex-1 flex-col">
                {!isReachable ? (
                    <FleetEmptyState
                        connectionState={connectionState}
                        endpoint={endpoint}
                        className="flex-1"
                    />
                ) : isInitialLoad ? (
                    <div className="flex flex-1 items-center justify-center">
                        <RetroSpinner />
                    </div>
                ) : view === "board" ? (
                    <KanbanBoard
                        sessions={sessionsQuery.data ?? []}
                        machines={machinesQuery.data ?? []}
                    />
                ) : (
                    <WorktreesView features={featuresQuery.data ?? []} />
                )}
            </div>

            {/*
             * design/fleet.md's two ASCII layouts: Board = cost presets +
             * machines + footer; Worktrees = machines + footer (no cost
             * presets). MachinesStrip is shared, CostPresetsPanel is
             * Board-only. Neither renders while unreachable/loading — no
             * point showing a preset picker or an empty machine strip.
             */}
            {isReachable && !isInitialLoad && (
                <>
                    {view === "board" && <CostPresetsPanel />}
                    <MachinesStrip machines={machinesQuery.data ?? []} />
                </>
            )}

            <FleetFooterHint
                hint={
                    view === "board"
                        ? FLEET_FOOTER_HINT_BOARD
                        : FLEET_FOOTER_HINT_WORKTREES
                }
            />
        </div>
    );
}
