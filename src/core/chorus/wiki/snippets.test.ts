import { describe, expect, it } from "vitest";
import { buildSnippet, findFirstMatchIndex } from "./snippets";

describe("buildSnippet", () => {
    it("returns the whole text with no ellipses when it already fits", () => {
        const text = "TSMC co-dependencies matter a lot";
        expect(buildSnippet(text, 5, 21, 60)).toBe(text);
    });

    it("adds a leading ellipsis when the window starts after 0", () => {
        const text = "a".repeat(100) + "TARGET" + "b".repeat(100);
        const start = text.indexOf("TARGET");
        const snippet = buildSnippet(text, start, start + 6, 20);
        expect(snippet.startsWith("…")).toBe(true);
        expect(snippet).toContain("TARGET");
    });

    it("adds a trailing ellipsis when the window ends before the text does", () => {
        const text = "a".repeat(100) + "TARGET" + "b".repeat(100);
        const start = text.indexOf("TARGET");
        const snippet = buildSnippet(text, start, start + 6, 20);
        expect(snippet.endsWith("…")).toBe(true);
    });

    it("collapses internal whitespace/newlines to single spaces", () => {
        const text = "line one\n\n  line   two with the match here\nline three";
        const start = text.indexOf("match");
        const snippet = buildSnippet(text, start, start + 5, 60);
        expect(snippet).not.toMatch(/\s{2,}/);
        expect(snippet).not.toContain("\n");
    });

    it("never exceeds maxLen characters of content (ellipses aside)", () => {
        const text = "x".repeat(500);
        const snippet = buildSnippet(text, 250, 250, 60);
        const withoutEllipses = snippet.replace(/…/g, "");
        expect(withoutEllipses.length).toBeLessThanOrEqual(60);
    });

    it("returns an empty string for empty input", () => {
        expect(buildSnippet("", 0, 0)).toBe("");
    });
});

describe("findFirstMatchIndex", () => {
    it("finds a case-insensitive match", () => {
        expect(findFirstMatchIndex("The Quick Brown Fox", "quick")).toBe(4);
    });

    it("returns undefined when there is no match", () => {
        expect(findFirstMatchIndex("The Quick Brown Fox", "slow")).toBeUndefined();
    });

    it("returns undefined for an empty query", () => {
        expect(findFirstMatchIndex("anything", "")).toBeUndefined();
    });
});
