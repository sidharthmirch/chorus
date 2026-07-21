import { describe, expect, it } from "vitest";
import {
    QUOTA_WARN_THRESHOLD,
    deriveQuotaLevel,
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
