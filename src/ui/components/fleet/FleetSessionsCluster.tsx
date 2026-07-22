import { useNavigate } from "react-router-dom";
import { agentDisplayName } from "@core/chorus/fleet/agentDisplay";
import { formatElapsedShort } from "@core/chorus/fleet/time";
import { useFleetSessions } from "@core/chorus/fleet/useFleet";
import { FleetMetaTone, IFleetSession } from "@core/chorus/fleet/protocol";
import { cn } from "@ui/lib/utils";
import { FleetStatusDot } from "./FleetStatusDot";
import { FLEET_TONE_TEXT_CLASS } from "./fleetTone";

/**
 * Sidebar "Fleet" cluster (P5) — the one piece of Fleet UI mounted outside
 * `src/ui/components/fleet/`'s own `/fleet` route. `AppSidebar.tsx` only
 * imports and renders this component inside a single, clearly-commented
 * block; all logic — which sessions to show, how to tone/label them —
 * stays here, under this workstream's ownership.
 *
 * Renders `null` (not even a wrapper element) whenever there is nothing
 * live to show — empty-state discipline, fleet-protocol.md §5. With the
 * default `MockFleetAdapter` (no `fleet_endpoint` configured) this is
 * never empty — 5 of its 7 fixture sessions are non-merged — so the
 * cluster is visible out of the box; a real, genuinely idle fleet
 * correctly renders nothing.
 *
 * Sidebar-scoped tokens throughout (`sidebar-foreground`,
 * `sidebar-muted-foreground`, `sidebar-accent`) per DESIGN.md: "Sidebar
 * sits on Sidebar Smoke with its own token family."
 */

/** Design mock's own sidebar sketch shows exactly 3 rows — kept small; the full list lives on `/fleet` itself. */
const MAX_ROWS = 3;

function sessionTone(session: IFleetSession): FleetMetaTone {
    if (session.status === "needs-review") return "warning";
    if (session.status === "running" && !session.paused) return "success";
    return "muted"; // queued, or a paused running session
}

/**
 * Compact status word for a row's trailing label — deliberately not the
 * Board's fuller "queued 4m"/"12m · $0.84" meta text (`kanbanFormat.ts`),
 * which is too wide for the sidebar's narrow column. Derived from the same
 * `status`/`paused` fields the Board reads, so the two surfaces can never
 * disagree about the same session (the design mock's own 3 illustrative
 * sidebar rows use words like "idle"/"review" that don't actually match
 * that session's status in the mock's separate kanban fixture — a fine
 * shortcut for a static prototype, not reproduced literally here).
 */
function sessionTimeLabel(session: IFleetSession, now: Date): string {
    if (session.status === "needs-review") return "review";
    if (session.status === "queued") return "queued";
    if (session.paused) return "paused";
    return formatElapsedShort(now.getTime() - session.createdAt.getTime());
}

export function FleetSessionsCluster() {
    const navigate = useNavigate();
    const { data: sessions } = useFleetSessions();
    const now = new Date();

    const liveSessions = (sessions ?? [])
        .filter((session) => session.status !== "merged")
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .slice(0, MAX_ROWS);

    if (liveSessions.length === 0) return null;

    const goToFleet = () => navigate("/fleet");

    return (
        <div className="mb-2">
            <div className="flex items-center justify-between pt-2 pl-3 pr-3 mb-1">
                <span className="sidebar-label text-sidebar-muted-foreground">
                    Fleet
                </span>
                <button
                    onClick={goToFleet}
                    className="font-geist-mono text-[10px] text-sidebar-muted-foreground hover:text-sidebar-accent-foreground"
                >
                    board →
                </button>
            </div>
            <div className="flex flex-col gap-0.5">
                {liveSessions.map((session) => {
                    const tone = sessionTone(session);
                    return (
                        <button
                            key={session.id}
                            onClick={goToFleet}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left hover:bg-sidebar-accent"
                        >
                            <FleetStatusDot
                                tone={tone}
                                pulse={
                                    session.status === "running" &&
                                    !session.paused
                                }
                            />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm text-sidebar-foreground">
                                    {session.title}
                                </span>
                                <span className="block truncate font-geist-mono text-[10px] text-sidebar-muted-foreground">
                                    {agentDisplayName(session.agent)} ·{" "}
                                    {session.machine}
                                </span>
                            </span>
                            <span
                                className={cn(
                                    "shrink-0 font-geist-mono text-[10px]",
                                    FLEET_TONE_TEXT_CLASS[tone],
                                )}
                            >
                                {sessionTimeLabel(session, now)}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
