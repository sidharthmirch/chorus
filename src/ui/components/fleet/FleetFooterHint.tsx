/**
 * The Fleet screen's persistent bottom bar: a static identity tagline
 * (left) + the view-specific hint (right) — exact copy + layout from the
 * design mock's own footer row (`fleetFootHint` sits next to the tagline,
 * not below it).
 */
export function FleetFooterHint({ hint }: { hint: string }) {
    return (
        <div className="flex shrink-0 items-center gap-3 border-t border-border px-4 py-2 font-geist-mono text-[11px] text-muted-foreground">
            <span className="truncate">
                own protocol · paseo-compatible runners · fusion-style fan-out
                planned
            </span>
            <span className="ml-auto shrink-0 truncate">▸ {hint}</span>
        </div>
    );
}
