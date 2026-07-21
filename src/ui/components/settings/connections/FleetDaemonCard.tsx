import { useState } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
    useFleetEndpoint,
    useSetFleetEndpoint,
} from "@core/chorus/fleet/fleetSettings";
import { useFleetConnectionState } from "@core/chorus/fleet/useFleet";
import { cn } from "@ui/lib/utils";

const STATUS_COPY: Record<
    ReturnType<typeof useFleetConnectionState>,
    { label: string; dotClassName: string }
> = {
    connected: { label: "Connected · online", dotClassName: "bg-success" },
    connecting: { label: "Connecting…", dotClassName: "bg-warning" },
    disconnected: { label: "Disconnected", dotClassName: "bg-destructive" },
    "not-configured": {
        label: "Not configured · using mock data",
        dotClassName: "bg-muted-foreground",
    },
};

/** design/settings.md "Connections" Fleetd card — status + protocol note +
 *  a "Configure" affordance for `fleet_endpoint` (app_metadata, W7). */
export function FleetDaemonCard() {
    const endpoint = useFleetEndpoint();
    const setEndpoint = useSetFleetEndpoint();
    const connectionState = useFleetConnectionState();
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(endpoint ?? "");

    const status = STATUS_COPY[connectionState];

    return (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <div className="flex items-center gap-2">
                        <span
                            className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                status.dotClassName,
                            )}
                            aria-hidden
                        />
                        <span className="font-medium text-sm">
                            Fleet daemon
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {status.label}
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        setDraft(endpoint ?? "");
                        setIsEditing((v) => !v);
                    }}
                >
                    Configure
                </Button>
            </div>
            <p className="font-mono text-[11px] text-muted-foreground">
                Own protocol, paseo-compatible
            </p>

            {isEditing && (
                <div className="space-y-2 pt-1">
                    <Input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="http://localhost:4700 (leave empty for mock data)"
                        className="font-mono text-sm"
                    />
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditing(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => {
                                setEndpoint.mutate(draft);
                                setIsEditing(false);
                            }}
                        >
                            Save
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
