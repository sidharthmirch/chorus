import { describe, expect, it } from "vitest";
import {
    daysAgo,
    formatElapsedShort,
    formatRelativeDay,
    hoursAgo,
    minutesAgo,
} from "./time";

describe("minutesAgo / hoursAgo / daysAgo", () => {
    const now = new Date("2026-07-21T18:00:00Z");

    it("subtracts minutes", () => {
        expect(minutesAgo(now, 4).toISOString()).toBe("2026-07-21T17:56:00.000Z");
    });

    it("subtracts hours", () => {
        expect(hoursAgo(now, 2).toISOString()).toBe("2026-07-21T16:00:00.000Z");
    });

    it("subtracts days", () => {
        expect(daysAgo(now, 1).toISOString()).toBe("2026-07-20T18:00:00.000Z");
    });
});

describe("formatElapsedShort", () => {
    it("floors sub-minute durations to 1m rather than 0m", () => {
        expect(formatElapsedShort(10_000)).toBe("1m");
    });

    it("formats minutes", () => {
        expect(formatElapsedShort(4 * 60_000)).toBe("4m");
        expect(formatElapsedShort(12 * 60_000)).toBe("12m");
    });

    it("formats hours once past 60 minutes", () => {
        expect(formatElapsedShort(2 * 60 * 60_000)).toBe("2h");
    });

    it("formats days once past 24 hours", () => {
        expect(formatElapsedShort(3 * 24 * 60 * 60_000)).toBe("3d");
    });

    it("clamps negative durations to zero instead of going negative", () => {
        expect(formatElapsedShort(-5000)).toBe("1m");
    });
});

describe("formatRelativeDay", () => {
    // `formatRelativeDay` (via `time.ts`'s `startOfDay`) compares LOCAL
    // calendar days. Built with the local-time `Date` constructor (not UTC
    // ISO strings) so this test is deterministic regardless of the machine
    // running it's timezone offset.
    const now = new Date(2026, 6, 21, 18, 0, 0); // 2026-07-21, local

    it("falls back to short-elapsed formatting for same local calendar day", () => {
        const earlierToday = new Date(2026, 6, 21, 6, 0, 0);
        expect(formatRelativeDay(earlierToday, now)).toBe("12h");
    });

    it("reads 'yesterday' exactly one calendar day back", () => {
        const yesterday = new Date(2026, 6, 20, 18, 0, 0);
        expect(formatRelativeDay(yesterday, now)).toBe("yesterday");
    });

    it("reads 'Nd ago' for two or more calendar days back", () => {
        const twoDaysAgo = new Date(2026, 6, 19, 18, 0, 0);
        expect(formatRelativeDay(twoDaysAgo, now)).toBe("2d ago");
    });
});
