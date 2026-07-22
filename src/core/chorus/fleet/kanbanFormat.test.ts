import { describe, expect, it } from "vitest";
import {
    buildKanbanCard,
    buildKanbanColumns,
    formatFleetCost,
    formatSessionMeta,
} from "./kanbanFormat";
import { IFleetSession } from "./protocol";
import { minutesAgo } from "./time";

const now = new Date(2026, 6, 21, 18, 0, 0);

function fakeSession(overrides: Partial<IFleetSession>): IFleetSession {
    return {
        id: "s1",
        title: "Some task",
        agent: "claude-code",
        machine: "m4-mini",
        branch: "feat/x",
        status: "queued",
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}

describe("formatFleetCost", () => {
    it("always shows 2 decimal places, matching the design fixture's copy", () => {
        expect(formatFleetCost(0.84)).toBe("$0.84");
        expect(formatFleetCost(0.12)).toBe("$0.12");
    });
});

describe("formatSessionMeta", () => {
    it("formats a queued session as 'queued <elapsed>' in muted tone", () => {
        const session = fakeSession({
            status: "queued",
            createdAt: minutesAgo(now, 4),
        });
        expect(formatSessionMeta(session, now)).toEqual({
            text: "queued 4m",
            tone: "muted",
        });
    });

    it("formats a running session as '<elapsed> · <cost>' in success tone", () => {
        const session = fakeSession({
            status: "running",
            createdAt: minutesAgo(now, 12),
            costUsd: 0.84,
        });
        expect(formatSessionMeta(session, now)).toEqual({
            text: "12m · $0.84",
            tone: "success",
        });
    });

    it("formats a running session with no cost yet as bare elapsed time", () => {
        const session = fakeSession({
            status: "running",
            createdAt: minutesAgo(now, 5),
        });
        expect(formatSessionMeta(session, now)).toEqual({
            text: "5m",
            tone: "success",
        });
    });

    it("formats a needs-review session with a diff as '+added −removed' in warning tone", () => {
        const session = fakeSession({
            status: "needs-review",
            diffAdded: 412,
            diffRemoved: 38,
        });
        expect(formatSessionMeta(session, now)).toEqual({
            text: "+412 −38",
            tone: "warning",
        });
    });

    it("formats a merged session via relative-day formatting in muted tone", () => {
        const session = fakeSession({
            status: "merged",
            updatedAt: new Date(2026, 6, 20, 18, 0, 0), // yesterday, local
        });
        expect(formatSessionMeta(session, now)).toEqual({
            text: "yesterday",
            tone: "muted",
        });
    });
});

describe("buildKanbanCard", () => {
    it("carries the session through and sets hasReviewBadge from awaitingReview", () => {
        const session = fakeSession({ status: "needs-review", awaitingReview: true });
        const card = buildKanbanCard(session, now);
        expect(card.session).toBe(session);
        expect(card.hasReviewBadge).toBe(true);
    });

    it("defaults hasReviewBadge to false when awaitingReview is unset", () => {
        const session = fakeSession({ status: "running" });
        const card = buildKanbanCard(session, now);
        expect(card.hasReviewBadge).toBe(false);
    });
});

describe("buildKanbanColumns", () => {
    it("returns exactly the 4 fixed lanes in fixed order, even when empty", () => {
        const columns = buildKanbanColumns([], now);
        expect(columns.map((c) => c.status)).toEqual([
            "queued",
            "running",
            "needs-review",
            "merged",
        ]);
        expect(columns.every((c) => c.cards.length === 0)).toBe(true);
    });

    it("groups sessions into the matching column", () => {
        const sessions = [
            fakeSession({ id: "a", status: "queued" }),
            fakeSession({ id: "b", status: "running" }),
            fakeSession({ id: "c", status: "running" }),
            fakeSession({ id: "d", status: "merged" }),
        ];
        const columns = buildKanbanColumns(sessions, now);
        const byStatus = new Map(columns.map((c) => [c.status, c]));
        expect(byStatus.get("queued")?.cards).toHaveLength(1);
        expect(byStatus.get("running")?.cards).toHaveLength(2);
        expect(byStatus.get("needs-review")?.cards).toHaveLength(0);
        expect(byStatus.get("merged")?.cards).toHaveLength(1);
    });

    it("sorts each column newest-updated-first", () => {
        const older = fakeSession({
            id: "older",
            status: "running",
            updatedAt: minutesAgo(now, 10),
        });
        const newer = fakeSession({
            id: "newer",
            status: "running",
            updatedAt: minutesAgo(now, 1),
        });
        const columns = buildKanbanColumns([older, newer], now);
        const running = columns.find((c) => c.status === "running");
        expect(running?.cards.map((c) => c.session.id)).toEqual([
            "newer",
            "older",
        ]);
    });

});
