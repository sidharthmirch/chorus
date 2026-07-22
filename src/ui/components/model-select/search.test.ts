import { describe, expect, it } from "vitest";
import { KNOWN_PROVIDERS, filterBySearch, parseSearchQuery, scoreMatch } from "./search";

interface Fixture {
    name: string;
    provider: string;
    modelId: string;
}

const FIXTURES: Fixture[] = [
    { name: "Claude Sonnet 4.5", provider: "anthropic", modelId: "anthropic::claude-sonnet-4.5" },
    { name: "Claude Opus 4.8", provider: "anthropic", modelId: "anthropic::claude-opus-4.8" },
    { name: "GPT-5.2", provider: "openai", modelId: "openai::gpt-5.2" },
    { name: "Gemini 3 Pro", provider: "google", modelId: "google::gemini-3-pro" },
    { name: "Llama 4 Maverick", provider: "openrouter", modelId: "openrouter::meta-llama/llama-4-maverick" },
];

function search(query: string, items: Fixture[] = FIXTURES): Fixture[] {
    const { providerFilter, modelTerms } = parseSearchQuery(query);
    return filterBySearch(
        items,
        modelTerms,
        providerFilter,
        (f) => `${f.name} ${f.provider} ${f.modelId}`,
        (f) => f.provider,
    );
}

describe("parseSearchQuery", () => {
    it("has no provider filter for a plain query", () => {
        expect(parseSearchQuery("claude sonnet")).toEqual({
            providerFilter: null,
            modelTerms: ["claude", "sonnet"],
        });
    });

    it("parses an exact provider: prefix", () => {
        expect(parseSearchQuery("anthropic:sonnet")).toEqual({
            providerFilter: "anthropic",
            modelTerms: ["sonnet"],
        });
    });

    it("parses an unambiguous provider prefix", () => {
        expect(parseSearchQuery("anthr:sonnet")).toEqual({
            providerFilter: "anthropic",
            modelTerms: ["sonnet"],
        });
    });

    it("falls back to a plain query when the prefix is ambiguous or unknown", () => {
        // "o" prefix-matches both openai and openrouter -> ambiguous -> not a provider filter
        const ambiguous = parseSearchQuery("o:test");
        expect(ambiguous.providerFilter).toBeNull();

        const unknown = parseSearchQuery("notaprovider:test");
        expect(unknown.providerFilter).toBeNull();
    });

    it("handles an empty query", () => {
        expect(parseSearchQuery("")).toEqual({ providerFilter: null, modelTerms: [] });
    });

    it("keeps KNOWN_PROVIDERS usable as the default provider list", () => {
        expect(KNOWN_PROVIDERS).toContain("anthropic");
        expect(KNOWN_PROVIDERS).toContain("openrouter");
    });
});

describe("scoreMatch", () => {
    it("scores an exact substring match highest", () => {
        expect(scoreMatch("claude", "claude sonnet anthropic")).toBe(100);
    });

    // The word-boundary (80) tier is unreachable by construction: any word
    // that starts with `term` is itself a substring of `haystack` (splitting
    // doesn't change the characters within a word), so the substring check
    // above always catches it first. This is a property of the *original*
    // ManageModelsBox.tsx scorer, not something introduced by this port —
    // kept byte-for-byte rather than silently "fixed" during the port.
    it("word-boundary matches are also substring matches, so they score 100 not 80", () => {
        expect(scoreMatch("son", "claude sonnet anthropic")).toBe(100);
    });

    it("scores a normalized substring match (punctuation-insensitive)", () => {
        // "gpt52" normalized-matches "gpt-5.2" even though it's not a literal substring or word prefix
        expect(scoreMatch("gpt52", "gpt-5.2 openai")).toBe(60);
    });

    it("requires contiguous number-group matches for numeric terms", () => {
        expect(scoreMatch("45", "claude sonnet 4.5")).toBeGreaterThan(0);
        expect(scoreMatch("99", "claude sonnet 4.5")).toBe(0);
    });

    it("returns 0 for no match", () => {
        expect(scoreMatch("zzz", "claude sonnet anthropic")).toBe(0);
    });

    it("treats an empty term as a universal match", () => {
        expect(scoreMatch("", "anything")).toBe(100);
    });
});

describe("filterBySearch", () => {
    it("returns everything unfiltered for an empty query", () => {
        expect(search("")).toHaveLength(FIXTURES.length);
    });

    it("filters by provider prefix alone", () => {
        const results = search("anthropic:");
        expect(results.map((r) => r.name)).toEqual(["Claude Sonnet 4.5", "Claude Opus 4.8"]);
    });

    it("filters and ranks by model-name terms", () => {
        const results = search("claude");
        expect(results.map((r) => r.name)).toEqual(["Claude Sonnet 4.5", "Claude Opus 4.8"]);
    });

    it("combines a provider filter with a term filter", () => {
        const results = search("anthropic:opus");
        expect(results.map((r) => r.name)).toEqual(["Claude Opus 4.8"]);
    });

    it("finds openrouter-routed models by their underlying org name", () => {
        const results = search("llama");
        expect(results.map((r) => r.name)).toEqual(["Llama 4 Maverick"]);
    });

    it("returns nothing for a term that matches no model", () => {
        expect(search("nonexistent-model-xyz")).toHaveLength(0);
    });

    it("ranks exact/word-boundary matches above fuzzy ones", () => {
        const results = search("gpt");
        expect(results[0].name).toBe("GPT-5.2");
    });
});
