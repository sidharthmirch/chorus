import { FleetMetaTone } from "@core/chorus/fleet/protocol";
import { cn } from "@ui/lib/utils";
import { FLEET_TONE_BAR_CLASS } from "./fleetTone";

/**
 * design/fleet.md's card-anatomy progress bar: "4px tall, full width,
 * `bg-muted` with fill % in `success` (running) or `warning` (needs
 * review)". Not the shadcn `ui/progress.tsx` primitive — that component
 * hardcodes its indicator to `bg-foreground` with no color override, and
 * this bar needs a status-dependent fill color; a two-`div` bar is simpler
 * than threading a color prop through a shared primitive other
 * workstreams also depend on.
 */
export function FleetProgressBar({
    pct,
    tone,
    className,
}: {
    pct: number;
    tone: FleetMetaTone;
    className?: string;
}) {
    const clamped = Math.min(100, Math.max(0, pct));
    return (
        <div
            role="progressbar"
            aria-valuenow={clamped}
            aria-valuemin={0}
            aria-valuemax={100}
            className={cn("h-1 w-full overflow-hidden rounded-full bg-muted", className)}
        >
            <div
                className={cn(
                    "h-full rounded-full transition-all",
                    FLEET_TONE_BAR_CLASS[tone],
                )}
                style={{ width: `${clamped}%` }}
            />
        </div>
    );
}
