import { describe, expect, it } from "vitest";
import {
    buildOptimizerPrompt,
    chooseModelSet,
    describeModelSet,
    wrapAsStructuredPrompt,
} from "./promptOptimizer";
import type { ModelConfig } from "./Models";

function modelConfig(overrides: Partial<ModelConfig>): ModelConfig {
    return {
        id: overrides.id ?? "test::model",
        displayName: overrides.displayName ?? "Test Model",
        author: "system",
        isEnabled: true,
        supportedAttachmentTypes: [],
        isInternal: false,
        isDeprecated: false,
        modelId: overrides.modelId ?? "test::model",
        isDefault: false,
        ...overrides,
    };
}

describe("buildOptimizerPrompt", () => {
    it("includes the draft text", () => {
        const prompt = buildOptimizerPrompt(
            "DRAFT_MARKER",
            "just-chat",
            [],
        );
        expect(prompt).toContain("DRAFT_MARKER");
    });

    it("varies its instruction by intent", () => {
        const justChat = buildOptimizerPrompt("x", "just-chat", []);
        const handToAgent = buildOptimizerPrompt("x", "hand-to-agent", []);
        const planFirst = buildOptimizerPrompt("x", "plan-first", []);
        expect(justChat).not.toEqual(handToAgent);
        expect(handToAgent).not.toEqual(planFirst);
        expect(handToAgent.toLowerCase()).toContain("acceptance criteria");
        expect(planFirst.toLowerCase()).toContain("clarifying questions");
    });

    it("mentions target model names when given", () => {
        const prompt = buildOptimizerPrompt("x", "just-chat", [
            "Claude Sonnet",
            "GPT-5",
        ]);
        expect(prompt).toContain("Claude Sonnet");
        expect(prompt).toContain("GPT-5");
    });

    it("omits the model-hint sentence when no model names are given", () => {
        const prompt = buildOptimizerPrompt("x", "just-chat", []);
        expect(prompt).not.toContain("will be sent to");
    });
});

describe("wrapAsStructuredPrompt", () => {
    it("wraps hand-to-agent rewrites in <task>", () => {
        const wrapped = wrapAsStructuredPrompt("BODY_MARKER", "hand-to-agent");
        expect(wrapped).toContain("<task>");
        expect(wrapped).toContain("</task>");
        expect(wrapped).toContain("BODY_MARKER");
    });

    it("wraps plan-first rewrites with an explicit plan-first instruction", () => {
        const wrapped = wrapAsStructuredPrompt("BODY_MARKER", "plan-first");
        expect(wrapped).toContain("<request>");
        expect(wrapped.toLowerCase()).toContain("plan");
    });

    it("wraps just-chat rewrites in a plain <message>", () => {
        const wrapped = wrapAsStructuredPrompt("BODY_MARKER", "just-chat");
        expect(wrapped).toContain("<message>");
        expect(wrapped).toContain("BODY_MARKER");
    });
});

describe("describeModelSet", () => {
    it("includes the model count", () => {
        const label = describeModelSet("chat-trio", [
            modelConfig({ id: "a" }),
            modelConfig({ id: "b" }),
        ]);
        expect(label).toBe("Chat trio · 2 models");
    });

    it("uses singular 'model' for exactly one", () => {
        expect(describeModelSet("fast-cheap", [modelConfig({ id: "a" })])).toBe(
            "Fast / cheap · 1 model",
        );
    });

    it("falls back to just the set label when there are no models", () => {
        expect(describeModelSet("coding", [])).toBe("Coding");
    });
});

describe("chooseModelSet", () => {
    const anthropicA = modelConfig({
        id: "anthropic-a",
        modelId: "anthropic::claude-a",
        promptPricePerToken: 0.000015,
        completionPricePerToken: 0.000075,
    });
    const openaiA = modelConfig({
        id: "openai-a",
        modelId: "openai::gpt-a",
        promptPricePerToken: 0.00001,
        completionPricePerToken: 0.00003,
    });
    const googleA = modelConfig({
        id: "google-a",
        modelId: "google::gemini-a",
        promptPricePerToken: 0.0000001,
        completionPricePerToken: 0.0000004,
    });
    const anthropicCheap = modelConfig({
        id: "anthropic-cheap",
        modelId: "anthropic::haiku",
        promptPricePerToken: 0.0000008,
        completionPricePerToken: 0.000004,
    });

    it("fast-cheap picks the cheapest priced models across the catalog", () => {
        const result = chooseModelSet(
            "fast-cheap",
            [anthropicA, openaiA, googleA, anthropicCheap],
            [],
        );
        expect(result.map((m) => m.id)).toEqual([
            "google-a",
            "anthropic-cheap",
            "openai-a",
        ]);
    });

    it("fast-cheap falls back to provider-diversity when no catalog entry has pricing data", () => {
        const noPricing = modelConfig({ id: "no-pricing" });
        const result = chooseModelSet("fast-cheap", [noPricing], []);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("no-pricing");
    });

    it("chat-trio picks at most one model per distinct provider", () => {
        const result = chooseModelSet(
            "chat-trio",
            [anthropicA, anthropicCheap, openaiA, googleA],
            [],
        );
        const providers = result.map((m) => m.modelId.split("::")[0]);
        expect(new Set(providers).size).toBe(providers.length);
        expect(result.length).toBeLessThanOrEqual(3);
    });

    it("chat-trio prefers models already selected for the chat over the wider catalog", () => {
        const result = chooseModelSet(
            "chat-trio",
            [anthropicA, openaiA, googleA],
            [anthropicCheap], // already selected: a DIFFERENT anthropic model
        );
        // anthropicCheap should win over anthropicA for the anthropic slot,
        // since it's the one already selected.
        expect(result.map((m) => m.id)).toContain("anthropic-cheap");
        expect(result.map((m) => m.id)).not.toContain("anthropic-a");
    });

    it("coding uses the same provider-diversity heuristic as chat-trio (no fabricated capability signal)", () => {
        const chatTrio = chooseModelSet(
            "chat-trio",
            [anthropicA, openaiA, googleA],
            [],
        );
        const coding = chooseModelSet(
            "coding",
            [anthropicA, openaiA, googleA],
            [],
        );
        expect(coding.map((m) => m.id)).toEqual(chatTrio.map((m) => m.id));
    });

    it("never returns an empty array when at least one visible model exists", () => {
        const result = chooseModelSet("chat-trio", [anthropicA], []);
        expect(result.length).toBeGreaterThan(0);
    });

    it("returns an empty array when there is truly nothing to choose from", () => {
        expect(chooseModelSet("chat-trio", [], [])).toEqual([]);
    });
});
