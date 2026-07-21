import { FLEET_MACHINE_DOT_TONE } from "@core/chorus/fleet/copy";
import { IMachine } from "@core/chorus/fleet/protocol";
import { FleetStatusDot } from "./FleetStatusDot";

/** "m4-mini (2/2) · hetzner-01 (1/4) · gpu-box (0/1)" — design/fleet.md's Machines Strip. */
export function MachinesStrip({ machines }: { machines: IMachine[] }) {
    if (machines.length === 0) return null;

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm text-muted-foreground">
            {machines.map((machine) => (
                <span key={machine.id} className="inline-flex items-center gap-1.5">
                    <FleetStatusDot tone={FLEET_MACHINE_DOT_TONE[machine.status]} />
                    <span className="text-foreground">{machine.name}</span>
                    <span className="font-geist-mono text-[11px] tabular-nums text-muted-foreground">
                        {machine.load.current}/{machine.load.max}
                    </span>
                </span>
            ))}
        </div>
    );
}
