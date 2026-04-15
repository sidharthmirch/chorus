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
        expect(normalizeLimitedTurns("-3", 10)).toBe(10);
    });

    it("normalizes valid limited turn values", () => {
        expect(normalizeLimitedTurns("0", 10)).toBe(0);
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

    it("treats contextWindowSize 0 as Current Message mode", () => {
        expect(
            deriveContextWindowState({
                contextWindowSize: 0,
                storedLimitedTurns: "25",
                defaultLimitedTurns: 10,
            }),
        ).toEqual({
            isLimited: true,
            limitedTurns: 0,
            contextWindowSize: 0,
        });
    });

    it("uses defaultLimitedTurns when storedLimitedTurns is undefined and contextWindowSize is undefined", () => {
        expect(
            deriveContextWindowState({
                contextWindowSize: undefined,
                storedLimitedTurns: undefined,
                defaultLimitedTurns: 10,
            }),
        ).toEqual({
            isLimited: false,
            limitedTurns: 10,
            contextWindowSize: undefined,
        });
    });

    it("uses defaultLimitedTurns when storedLimitedTurns is empty string", () => {
        expect(
            deriveContextWindowState({
                contextWindowSize: undefined,
                storedLimitedTurns: "",
                defaultLimitedTurns: 10,
            }),
        ).toEqual({
            isLimited: false,
            limitedTurns: 10,
            contextWindowSize: undefined,
        });
    });

    it("ignores stored limited turns when contextWindowSize is present", () => {
        expect(
            deriveContextWindowState({
                contextWindowSize: 3,
                storedLimitedTurns: undefined,
                defaultLimitedTurns: 10,
            }),
        ).toEqual({
            isLimited: true,
            limitedTurns: 3,
            contextWindowSize: 3,
        });
    });
});

describe("normalizeLimitedTurns – number input", () => {
    it("accepts a numeric value directly", () => {
        expect(normalizeLimitedTurns(5, 10)).toBe(5);
    });

    it("returns fallback for NaN number input", () => {
        expect(normalizeLimitedTurns(NaN, 10)).toBe(10);
    });

    it("returns fallback for Infinity", () => {
        expect(normalizeLimitedTurns(Infinity, 10)).toBe(10);
    });

    it("returns fallback for -Infinity", () => {
        expect(normalizeLimitedTurns(-Infinity, 10)).toBe(10);
    });

    it("accepts zero as a number", () => {
        expect(normalizeLimitedTurns(0, 10)).toBe(0);
    });

    it("returns fallback for negative number input", () => {
        expect(normalizeLimitedTurns(-1, 10)).toBe(10);
    });
});

describe("normalizeLimitedTurns – string edge cases", () => {
    it("returns fallback for empty string", () => {
        expect(normalizeLimitedTurns("", 10)).toBe(10);
    });

    it("returns fallback for whitespace-only string", () => {
        expect(normalizeLimitedTurns("   ", 10)).toBe(10);
    });

    it("parses float strings via parseInt truncation", () => {
        expect(normalizeLimitedTurns("3.7", 10)).toBe(3);
    });

    it("returns fallback for string Infinity", () => {
        expect(normalizeLimitedTurns("Infinity", 10)).toBe(10);
    });

    it("parses strings with leading whitespace", () => {
        expect(normalizeLimitedTurns("  42", 10)).toBe(42);
    });
});
