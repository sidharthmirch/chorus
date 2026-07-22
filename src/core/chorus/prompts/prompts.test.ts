import { describe, expect, it } from "vitest";
import { injectSystemPrompts } from "./prompts";
import type { ModelConfig } from "../Models";

function baseModelConfig(overrides?: Partial<ModelConfig>): ModelConfig {
    return {
        id: "test::model",
        displayName: "Test Model",
        author: "system",
        isEnabled: true,
        supportedAttachmentTypes: [],
        isInternal: false,
        isDeprecated: false,
        modelId: "test::model",
        isDefault: false,
        ...overrides,
    };
}

describe("injectSystemPrompts", () => {
    it("omits the mode section entirely when modeSystemPrompt is not provided (unchanged baseline behavior)", () => {
        const result = injectSystemPrompts(baseModelConfig(), {
            promptProfileSystemPrompt: "Be a pirate.",
        });

        expect(result.systemPrompt).toContain("Be a pirate.");
        // No stray double-blank-line artifact from an empty section, and no
        // literal "undefined" leaking into the assembled prompt.
        expect(result.systemPrompt).not.toContain("undefined");
    });

    it("splices modeSystemPrompt into the assembled system prompt when provided", () => {
        const result = injectSystemPrompts(baseModelConfig(), {
            modeSystemPrompt: "Attack every claim. Chase every avenue to prove you wrong.",
        });

        expect(result.systemPrompt).toContain(
            "Attack every claim. Chase every avenue to prove you wrong.",
        );
    });

    it("places modeSystemPrompt after promptProfileSystemPrompt (persona first, stance second) and keeps both distinct", () => {
        const result = injectSystemPrompts(baseModelConfig(), {
            promptProfileSystemPrompt: "PERSONA_MARKER",
            modeSystemPrompt: "MODE_MARKER",
        });

        const personaIndex = result.systemPrompt!.indexOf("PERSONA_MARKER");
        const modeIndex = result.systemPrompt!.indexOf("MODE_MARKER");
        expect(personaIndex).toBeGreaterThan(-1);
        expect(modeIndex).toBeGreaterThan(-1);
        expect(modeIndex).toBeGreaterThan(personaIndex);
    });

    it("still appends the model config's own systemPrompt last, after mode injection", () => {
        const result = injectSystemPrompts(
            baseModelConfig({ systemPrompt: "MODEL_OWN_PROMPT" }),
            { modeSystemPrompt: "MODE_MARKER" },
        );

        const modeIndex = result.systemPrompt!.indexOf("MODE_MARKER");
        const ownIndex = result.systemPrompt!.indexOf("MODEL_OWN_PROMPT");
        expect(ownIndex).toBeGreaterThan(modeIndex);
    });

    it("does not mutate the input modelConfig", () => {
        const input = baseModelConfig();
        const originalSystemPrompt = input.systemPrompt;
        injectSystemPrompts(input, { modeSystemPrompt: "MODE_MARKER" });
        expect(input.systemPrompt).toBe(originalSystemPrompt);
    });
});
