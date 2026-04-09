import { describe, expect, it } from "vitest";
import {
    CONTEXT_WINDOW_LAST_LIMITED_PREFIX,
    buildLastLimitedContextWindowKey,
    deriveContextWindowState,
    normalizeLimitedTurns,
} from "./contextWindowState";

describe("contextWindowState", () => {
    it("builds a chat-scoped localStorage key", () => {
        expect(buildLastLimitedContextWindowKey("chat-123")).toBe(
            "context-window:last-limited:chat-123",
        );
        expect(CONTEXT_WINDOW_LAST_LIMITED_PREFIX).toBe(
            "context-window:last-limited:",
        );
    });

    it("normalizes invalid limited turn values to fallback", () => {
        expect(normalizeLimitedTurns(undefined, 10)).toBe(10);
        expect(normalizeLimitedTurns("abc", 10)).toBe(10);
        expect(normalizeLimitedTurns("0", 10)).toBe(10);
        expect(normalizeLimitedTurns("-3", 10)).toBe(10);
    });

    it("normalizes valid limited turn values", () => {
        expect(normalizeLimitedTurns("1", 10)).toBe(1);
        expect(normalizeLimitedTurns("42", 10)).toBe(42);
    });

    it("prefers server value when context window is enabled", () => {
        expect(
            deriveContextWindowState({
                contextWindowSize: 7,
                storedLimitedTurns: "25",
                defaultLimitedTurns: 10,
            }),
        ).toEqual({
            isLimited: true,
            limitedTurns: 7,
            contextWindowSize: 7,
        });
    });

    it("uses stored limited turns when full history is enabled", () => {
        expect(
            deriveContextWindowState({
                contextWindowSize: undefined,
                storedLimitedTurns: "25",
                defaultLimitedTurns: 10,
            }),
        ).toEqual({
            isLimited: false,
            limitedTurns: 25,
            contextWindowSize: undefined,
        });
    });
});
