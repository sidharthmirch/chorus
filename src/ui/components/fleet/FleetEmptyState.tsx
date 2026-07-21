import { ServerOffIcon } from "lucide-react";
import {
    FLEET_NOT_CONFIGURED_TITLE,
    FLEET_NOT_REACHABLE_TITLE,
} from "@core/chorus/fleet/copy";
import { FleetConnectionState } from "@core/chorus/fleet/protocol";
import { cn } from "@ui/lib/utils";

/**
 * Shown in place of the Board/Worktrees content when a real
 * `fleet_endpoint` is configured but unreachable (or still connecting) —
 * NOT shown for the default no-endpoint case, since that renders
 * `MockFleetAdapter`'s fixture data instead (see `useFleet.ts`'s header
 * comment / fleet-protocol.md §5). A misconfigured real endpoint should
 * read as an honest error, never silently blank.
 */
export function FleetEmptyState({
    connectionState,
    endpoint,
    className,
}: {
    connectionState: FleetConnectionState;
    endpoint?: string;
    className?: string;
}) {
    const title =
        connectionState === "not-configured"
            ? FLEET_NOT_CONFIGURED_TITLE
            : FLEET_NOT_REACHABLE_TITLE;
    const description =
        connectionState === "connecting"
            ? "Connecting…"
            : connectionState === "not-configured"
              ? "Set a fleetd endpoint to see live sessions here."
              : endpoint
                ? `Couldn't reach fleetd at ${endpoint}.`
                : "Couldn't reach fleetd.";

    return (
        <div
            className={cn(
                "flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center",
                className,
            )}
        >
            <ServerOffIcon
                strokeWidth={1.5}
                className="size-5 text-muted-foreground"
            />
            <p className="text-sm text-foreground">{title}</p>
            <p className="max-w-[36ch] text-xs text-muted-foreground">
                {description}
            </p>
        </div>
    );
}
