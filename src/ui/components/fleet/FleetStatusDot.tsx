import { FleetMetaTone } from "@core/chorus/fleet/protocol";
import { cn } from "@ui/lib/utils";
import { FLEET_TONE_DOT_CLASS } from "./fleetTone";

export function FleetStatusDot({
    tone,
    pulse = false,
    className,
}: {
    tone: FleetMetaTone;
    /** e.g. the supervisor "reviewing now" state, a live/running session. Pure CSS (`animate-pulse`), respects `prefers-reduced-motion` via the `motion-safe:` variant — no JS timer. */
    pulse?: boolean;
    className?: string;
}) {
    return (
        <span
            aria-hidden
            className={cn(
                "inline-block size-1.5 shrink-0 rounded-full",
                FLEET_TONE_DOT_CLASS[tone],
                pulse && "motion-safe:animate-pulse",
                className,
            )}
        />
    );
}
