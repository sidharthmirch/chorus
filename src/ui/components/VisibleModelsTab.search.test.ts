import { describe, expect, it } from "vitest";
import { ModelConfig } from "@core/chorus/Models";
import {
    filterSubProvidersBySearch,
    filterModelsBySearch,
    parseSubProviderSearch,
} from "./visibleModelsSearch";

function makeModel(
    id: string,
    modelId: string,
    displayName: string,
): ModelConfig {
    return {
        id,
        modelId,
        displayName,
    } as ModelConfig;
}

const MODELS: ModelConfig[] = [
    makeModel("1", "openrouter::openai/gpt-4o", "OpenAI GPT-4o"),
    makeModel(
        "2",
        "openrouter::google/gemini-1.5-pro",
        "Google Gemini 1.5 Pro",
    ),
    makeModel("3", "openrouter::meta-llama/llama-3.1-8b", "Llama 3.1 8B"),
];

const SUB_PROVIDERS = ["google", "meta-llama", "openai"];

describe("filterModelsBySearch", () => {
    it("returns all models when search is empty", () => {
        expect(filterModelsBySearch(MODELS, "", SUB_PROVIDERS)).toEqual(MODELS);
    });

    it("supports sub-provider prefix search with model terms", () => {
        const filtered = filterModelsBySearch(
            MODELS,
            "openai: gpt-4",
            SUB_PROVIDERS,
        );
        expect(filtered).toEqual([MODELS[0]]);
    });

    it("supports provider-only prefix syntax with trailing colon", () => {
        const filtered = filterModelsBySearch(MODELS, "google:", SUB_PROVIDERS);
        expect(filtered).toEqual([MODELS[1]]);
    });

    it("parses provider prefix syntax for chip filtering", () => {
        expect(parseSubProviderSearch("openai: gpt-4", SUB_PROVIDERS)).toEqual({
            matchedSubProvider: "openai",
            remainingSearch: "gpt-4",
        });
    });

    it("keeps selected sub-providers visible while search narrows", () => {
        const filtered = filterSubProvidersBySearch(SUB_PROVIDERS, "flash", [
            "google",
            "openai",
        ]);
        expect(filtered).toEqual(["google", "openai"]);
    });

    it("applies plain text term filtering", () => {
        const filtered = filterModelsBySearch(MODELS, "5.4", SUB_PROVIDERS);
        expect(filtered).toEqual([]);
    });

    it("filters by multiple selected sub-providers", () => {
        const filtered = filterModelsBySearch(MODELS, "", SUB_PROVIDERS, [
            "openai",
            "google",
        ]);
        expect(filtered).toEqual([MODELS[0], MODELS[1]]);
    });
});
