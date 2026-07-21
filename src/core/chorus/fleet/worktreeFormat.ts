/**
 * W7 — Fleet. Pure formatting for the Worktrees view — mirrors
 * `kanbanFormat.ts`'s role for the Board. See that file's header for why
 * this logic lives outside `protocol.ts`.
 */

import { FleetMetaTone, IFeature, ITicket } from "./protocol";
import { formatElapsedShort } from "./time";

/**
 * "building · 2/3 merged" / "supervising" — the merged-count fragment is
 * always derived from `tickets` rather than trusted as server-sent text, so
 * it can never drift from the actual per-ticket data.
 */
export function formatFeatureBadge(
    feature: IFeature,
): { text: string; tone: FleetMetaTone } {
    if (feature.status === "supervising") {
        return { text: "supervising", tone: "warning" };
    }
    const merged = feature.tickets.filter((t) => t.status === "merged").length;
    const total = feature.tickets.length;
    return { text: `building · ${merged}/${total} merged`, tone: "success" };
}

export function formatTicketMeta(
    ticket: ITicket,
    now: Date,
): { text: string; tone: FleetMetaTone } {
    switch (ticket.status) {
        case "queued":
            return { text: "queued", tone: "muted" };
        case "running": {
            const elapsed = formatElapsedShort(
                now.getTime() - ticket.createdAt.getTime(),
            );
            const pct =
                ticket.progressPct === undefined
                    ? ""
                    : `${Math.round(ticket.progressPct)}% · `;
            return { text: `${pct}${elapsed}`, tone: "success" };
        }
        case "awaiting-merge":
            return { text: "awaiting merge", tone: "warning" };
        case "merged":
            // Distinct from a merged kanban card's tone — see
            // FleetMetaTone's doc comment in protocol.ts.
            return { text: "merged ✓", tone: "accent" };
    }
}
