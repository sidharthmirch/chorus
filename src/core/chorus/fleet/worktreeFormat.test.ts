import { describe, expect, it } from "vitest";
import { formatFeatureBadge, formatTicketMeta } from "./worktreeFormat";
import { IFeature, ITicket } from "./protocol";
import { minutesAgo } from "./time";

const now = new Date(2026, 6, 21, 18, 0, 0);

function fakeTicket(overrides: Partial<ITicket>): ITicket {
    return {
        id: "T-1",
        title: "Some ticket",
        worktreePath: "wt/x/t1",
        status: "queued",
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}

function fakeFeature(overrides: Partial<IFeature>): IFeature {
    return {
        id: "feat-1",
        branch: "feat/x",
        title: "Feature X",
        worktreePath: "~/fleet/wt/x",
        status: "building",
        tickets: [],
        supervisor: { state: "idle", note: "" },
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}

describe("formatFeatureBadge", () => {
    it("shows 'supervising' in warning tone regardless of ticket counts", () => {
        const feature = fakeFeature({
            status: "supervising",
            tickets: [fakeTicket({ status: "awaiting-merge" })],
        });
        expect(formatFeatureBadge(feature)).toEqual({
            text: "supervising",
            tone: "warning",
        });
    });

    it("derives 'building · merged/total merged' from the ticket list, not a stored count", () => {
        const feature = fakeFeature({
            status: "building",
            tickets: [
                fakeTicket({ id: "T-1", status: "merged" }),
                fakeTicket({ id: "T-2", status: "merged" }),
                fakeTicket({ id: "T-3", status: "running" }),
            ],
        });
        expect(formatFeatureBadge(feature)).toEqual({
            text: "building · 2/3 merged",
            tone: "success",
        });
    });
});

describe("formatTicketMeta", () => {
    it("shows '<pct>% · <elapsed>' for a running ticket in success tone", () => {
        const ticket = fakeTicket({
            status: "running",
            progressPct: 64,
            createdAt: minutesAgo(now, 12),
        });
        expect(formatTicketMeta(ticket, now)).toEqual({
            text: "64% · 12m",
            tone: "success",
        });
    });

    it("shows 'awaiting merge' in warning tone", () => {
        const ticket = fakeTicket({ status: "awaiting-merge" });
        expect(formatTicketMeta(ticket, now)).toEqual({
            text: "awaiting merge",
            tone: "warning",
        });
    });

    it("shows 'merged ✓' in accent tone — distinct from a merged session's muted tone", () => {
        const ticket = fakeTicket({ status: "merged" });
        expect(formatTicketMeta(ticket, now)).toEqual({
            text: "merged ✓",
            tone: "accent",
        });
    });

    it("falls back to plain 'queued' when a ticket hasn't started", () => {
        const ticket = fakeTicket({ status: "queued" });
        expect(formatTicketMeta(ticket, now)).toEqual({
            text: "queued",
            tone: "muted",
        });
    });
});
