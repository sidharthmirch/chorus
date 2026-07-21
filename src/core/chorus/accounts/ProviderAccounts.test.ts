import { describe, expect, it } from "vitest";
import {
    QUOTA_WARN_THRESHOLD,
    deriveQuotaLevel,
    formatQuotaLabel,
    formatQuotaResetWindow,
    isProviderAccountId,
    isProviderAccountStatus,
    isProviderAuthKind,
    makeQuotaSnapshot,
} from "./ProviderAccounts";

describe("deriveQuotaLevel", () => {
    it("returns ok below the warn threshold", () => {
        expect(deriveQuotaLevel(0)).toBe("ok");
        expect(deriveQuotaLevel(0.62)).toBe("ok");
        expect(deriveQuotaLevel(QUOTA_WARN_THRESHOLD - 0.01)).toBe("ok");
    });

    it("returns warn at or above the warn threshold", () => {
        expect(deriveQuotaLevel(QUOTA_WARN_THRESHOLD)).toBe("warn");
        expect(deriveQuotaLevel(0.84)).toBe("warn");
        expect(deriveQuotaLevel(1)).toBe("warn");
    });
});

describe("makeQuotaSnapshot", () => {
    it("carries the used fraction and level through unchanged when in range", () => {
        const snapshot = makeQuotaSnapshot(0.62);
        expect(snapshot.usedFraction).toBe(0.62);
        expect(snapshot.level).toBe("ok");
        expect(snapshot.resetsAt).toBeUndefined();
    });

    it("clamps out-of-range fractions into [0, 1]", () => {
        expect(makeQuotaSnapshot(-0.5).usedFraction).toBe(0);
        expect(makeQuotaSnapshot(1.5).usedFraction).toBe(1);
    });

    it("preserves resetsAt when provided", () => {
        const resetsAt = new Date("2026-07-21T17:30:00Z");
        const snapshot = makeQuotaSnapshot(0.9, resetsAt);
        expect(snapshot.resetsAt).toBe(resetsAt);
        expect(snapshot.level).toBe("warn");
    });
});

describe("formatQuotaResetWindow", () => {
    const now = new Date("2026-07-21T14:30:00Z");

    it("returns undefined with no resetsAt", () => {
        expect(formatQuotaResetWindow(undefined, now)).toBeUndefined();
    });

    it("returns undefined once the window has already elapsed", () => {
        const past = new Date("2026-07-21T14:00:00Z");
        expect(formatQuotaResetWindow(past, now)).toBeUndefined();
    });

    it("formats sub-hour windows in minutes", () => {
        const soon = new Date(now.getTime() + 45 * 60 * 1000);
        expect(formatQuotaResetWindow(soon, now)).toBe("45m");
    });

    it("formats sub-day windows in hours", () => {
        const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);
        expect(formatQuotaResetWindow(in3h, now)).toBe("3h");
    });

    it("formats multi-day windows in days", () => {
        const in2d = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        expect(formatQuotaResetWindow(in2d, now)).toBe("2d");
    });
});

describe("formatQuotaLabel", () => {
    const now = new Date("2026-07-21T14:30:00Z");

    it("combines percent and reset window", () => {
        const quota = makeQuotaSnapshot(
            0.62,
            new Date(now.getTime() + 3 * 60 * 60 * 1000),
        );
        expect(formatQuotaLabel(quota, now)).toBe("62% · resets 3h");
    });

    it("falls back to a bare percentage with no reset window", () => {
        const quota = makeQuotaSnapshot(0.2);
        expect(formatQuotaLabel(quota, now)).toBe("20%");
    });

    it("rounds the percentage", () => {
        const quota = makeQuotaSnapshot(0.628);
        expect(formatQuotaLabel(quota, now)).toBe("63%");
    });
});

describe("isProviderAccountId", () => {
    it("accepts all six known provider ids", () => {
        for (const id of [
            "anthropic",
            "openai",
            "google",
            "copilot",
            "openrouter",
            "local",
        ]) {
            expect(isProviderAccountId(id)).toBe(true);
        }
    });

    it("rejects unknown strings", () => {
        expect(isProviderAccountId("claude")).toBe(false);
        expect(isProviderAccountId("")).toBe(false);
    });
});

describe("isProviderAuthKind", () => {
    it("accepts all three known auth kinds", () => {
        expect(isProviderAuthKind("oauth")).toBe(true);
        expect(isProviderAuthKind("api-key")).toBe(true);
        expect(isProviderAuthKind("none-local")).toBe(true);
    });

    it("rejects unknown strings", () => {
        expect(isProviderAuthKind("apikey")).toBe(false);
    });
});

describe("isProviderAccountStatus", () => {
    it("accepts all five known statuses", () => {
        for (const status of [
            "connected",
            "needs-auth",
            "expired",
            "error",
            "not-configured",
        ]) {
            expect(isProviderAccountStatus(status)).toBe(true);
        }
    });

    it("rejects unknown strings", () => {
        expect(isProviderAccountStatus("disconnected")).toBe(false);
    });
});
