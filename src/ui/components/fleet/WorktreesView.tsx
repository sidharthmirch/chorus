import { IFeature } from "@core/chorus/fleet/protocol";
import { FeatureCard } from "./FeatureCard";

/** Secondary Fleet screen: feature branch → ticket worktrees → on-demand supervisor (design/fleet.md). */
export function WorktreesView({ features }: { features: IFeature[] }) {
    // A real wall-clock "now" for elapsed-time formatting — NOT a
    // per-feature `updatedAt`, which would make a still-running ticket's
    // "12m" reading only as fresh as the last time fleetd touched the
    // feature itself, not the actual current time. Computed directly
    // (no useMemo — `Date.now()` doesn't depend on `features`, so there is
    // no dependency to memoize against; it's cheap enough to recompute on
    // every render, which conveniently keeps it fresh across data refreshes).
    const now = new Date();

    if (features.length === 0) {
        return (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                No active feature worktrees.
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
            {features.map((feature) => (
                <FeatureCard key={feature.id} feature={feature} now={now} />
            ))}
            <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
                Every ticket runs in its own git worktree branched off the
                feature worktree. When all tickets land, a supervisor is{" "}
                <strong className="font-medium text-foreground">
                    spawned on demand
                </strong>
                : it reviews each diff, merges child worktrees into the
                feature branch, then opens the PR to main and exits.
            </p>
        </div>
    );
}
