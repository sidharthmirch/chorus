/**
 * W7 — Fleet. Pure functions that turn raw `IFleetSession[]` (the adapter's
 * wire shape) into the Board's `IKanbanColumn[]` view-model — meta text,
 * tone, and column grouping are all derived here so `protocol.ts` stays
 * pure data and `KanbanCard.tsx` stays pure rendering. Unit-tested in
 * `kanbanFormat.test.ts`.
 */

import { FLEET_COLUMN_LABELS, FLEET_COLUMN_ORDER } from "./copy";
import {
    FleetMetaTone,
    FleetSessionStatus,
    IFleetSession,
    IKanbanCard,
    IKanbanColumn,
} from "./protocol";
import { formatElapsedShort, formatRelativeDay } from "./time";

/**
 * Deliberately NOT the app-wide `formatCost` (`api/CostAPI.ts`): that
 * function is tuned for per-message/per-token costs where sub-cent amounts
 * are common and shown to 4 decimal places (e.g. "$0.0023"). A session's
 * *accrued task cost* is a coarser, cent-precision number in the design
 * fixture ("$0.84", "$0.12") — 4-decimal formatting there would render
 * "$0.8400", which reads as a rendering bug rather than precision. Same
 * reasoning as keeping `formatElapsedShort` separate from `displayDate`.
 */
export function formatFleetCost(costUsd: number): string {
    return `$${costUsd.toFixed(2)}`;
}

export function formatSessionMeta(
    session: IFleetSession,
    now: Date,
): { text: string; tone: FleetMetaTone } {
    switch (session.status) {
        case "queued":
            return {
                text: `queued ${formatElapsedShort(now.getTime() - session.createdAt.getTime())}`,
                tone: "muted",
            };
        case "running": {
            const elapsed = formatElapsedShort(
                now.getTime() - session.createdAt.getTime(),
            );
            const text =
                session.costUsd === undefined
                    ? elapsed
                    : `${elapsed} · ${formatFleetCost(session.costUsd)}`;
            return { text, tone: "success" };
        }
        case "needs-review": {
            if (
                session.diffAdded !== undefined &&
                session.diffRemoved !== undefined
            ) {
                return {
                    text: `+${session.diffAdded} −${session.diffRemoved}`,
                    tone: "warning",
                };
            }
            return {
                text: formatElapsedShort(
                    now.getTime() - session.updatedAt.getTime(),
                ),
                tone: "warning",
            };
        }
        case "merged":
            return {
                text: formatRelativeDay(session.updatedAt, now),
                tone: "muted",
            };
    }
}

export function buildKanbanCard(session: IFleetSession, now: Date): IKanbanCard {
    const { text, tone } = formatSessionMeta(session, now);
    return {
        session,
        metaText: text,
        metaTone: tone,
        hasReviewBadge: Boolean(session.awaitingReview),
    };
}

/** Groups sessions into the Board's 4 fixed lanes, in fixed column order, each sorted newest-updated-first. */
export function buildKanbanColumns(
    sessions: IFleetSession[],
    now: Date,
): IKanbanColumn[] {
    const byStatus = new Map<FleetSessionStatus, IFleetSession[]>();
    for (const status of FLEET_COLUMN_ORDER) byStatus.set(status, []);
    for (const session of sessions) {
        const bucket = byStatus.get(session.status);
        if (bucket) bucket.push(session);
        // A status fleetd reports that isn't one of our 4 known lanes is
        // dropped rather than crashing the board — see FleetdAdapter's
        // narrowing of the wire status enum.
    }

    return FLEET_COLUMN_ORDER.map((status) => {
        const sessionsForStatus = [...(byStatus.get(status) ?? [])].sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
        );
        return {
            status,
            label: FLEET_COLUMN_LABELS[status],
            cards: sessionsForStatus.map((session) =>
                buildKanbanCard(session, now),
            ),
        };
    });
}
