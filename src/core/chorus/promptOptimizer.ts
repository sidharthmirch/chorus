// Pure logic for the Prompt Optimizer modal (P5,
// docs/rework/design/prompt-optimizer.md). Kept separate from the UI
// (`src/ui/components/composer/PromptOptimizerDialog.tsx`) so the prompt
// construction, XML-wrapping, and model-set curation are independently
// unit-testable — same split as fusedGrading.ts vs its MessageAPI.ts wrapper.

// Type-only import, deliberately: `./Models` has a heavy runtime import
// chain (provider classes -> ... -> DB.ts's top-level `await
// Database.load(...)`, which needs a Tauri webview `window` and crashes
// under vitest/Node). ChatState.ts already avoids this the same way (`import
// type { LLMMessage } from "./Models"`) — `import type` is fully erased, so
// this file never actually executes Models.ts at runtime. Consequently this
// file must not import any Models.ts VALUE (function/const), including
// `getProviderName` — see tryGetProviderName below, which reimplements its
// one-line logic locally rather than importing it.
import type { ModelConfig } from "./Models";

export type OptimizerIntent = "just-chat" | "hand-to-agent" | "plan-first";
export type OptimizerModelSet = "chat-trio" | "coding" | "fast-cheap";

export const OPTIMIZER_INTENTS: {
    value: OptimizerIntent;
    label: string;
    description: string;
}[] = [
    { value: "just-chat", label: "Just chat", description: "light touch" },
    {
        value: "hand-to-agent",
        label: "Hand to agent — build",
        description: "adds acceptance criteria",
    },
    {
        value: "plan-first",
        label: "Plan first",
        description: "asks before specifying",
    },
];

export const OPTIMIZER_MODEL_SETS: {
    value: OptimizerModelSet;
    label: string;
}[] = [
    { value: "chat-trio", label: "Chat trio" },
    { value: "coding", label: "Coding" },
    { value: "fast-cheap", label: "Fast / cheap" },
];

/**
 * Builds the rewrite prompt sent to `simpleLLM()`. One call produces a
 * natural-language optimized prompt; the Structured tab's XML view is a
 * client-side wrapper over that same text (see `wrapAsStructuredPrompt`) —
 * deliberately one LLM call, not two, to keep this "cheap model, standalone
 * feature" per the brief rather than doubling token cost for a formatting
 * difference.
 */
export function buildOptimizerPrompt(
    draft: string,
    intent: OptimizerIntent,
    modelNames: string[],
): string {
    const intentInstruction: Record<OptimizerIntent, string> = {
        "just-chat":
            "Lightly tidy the request for clarity. Keep it conversational and brief — do not add formal structure, sections, or acceptance criteria.",
        "hand-to-agent":
            "Rewrite this as a well-formed task for an autonomous coding/work agent: state the role, the relevant context, concrete requirements, and explicit acceptance criteria the agent can verify its own work against.",
        "plan-first":
            "Rewrite this so the assistant proposes a short plan and asks any necessary clarifying questions BEFORE doing the work, rather than immediately executing.",
    };

    const modelHint =
        modelNames.length > 0
            ? `The rewritten prompt will be sent to: ${modelNames.join(", ")}. Keep it model-agnostic natural language (no XML tags, no markdown headers) — formatting for specific models happens separately.`
            : "";

    return `Rewrite the following draft prompt to be clearer and more effective. ${intentInstruction[intent]}
${modelHint}

Respond with ONLY the rewritten prompt as plain natural-language text. No preamble, no commentary, no quotes around it.

Draft prompt:
${draft}`;
}

/**
 * Wraps an already-optimized natural-language prompt into the design's XML
 * skeleton (<role>/<context>/<requirements>/<acceptance> for hand-to-agent;
 * a lighter <task> shape otherwise) for the Structured tab. Purely
 * presentational — does not call any model.
 */
export function wrapAsStructuredPrompt(
    optimizedProse: string,
    intent: OptimizerIntent,
): string {
    const body = optimizedProse.trim();
    if (intent === "hand-to-agent") {
        return `<task>\n${body}\n</task>`;
    }
    if (intent === "plan-first") {
        return `<request>\n${body}\n</request>\n<instruction>\nPropose a short plan and ask clarifying questions before doing the work.\n</instruction>`;
    }
    return `<message>\n${body}\n</message>`;
}

/**
 * Picks a display label for the Structured tab's "Optimized · [label]"
 * header, per the design's "sonnet-curated" / "chat-trio · 3 models" style.
 */
export function describeModelSet(
    modelSet: OptimizerModelSet,
    modelConfigs: ModelConfig[],
): string {
    const setLabel =
        OPTIMIZER_MODEL_SETS.find((s) => s.value === modelSet)?.label ??
        modelSet;
    if (modelConfigs.length === 0) return setLabel;
    return `${setLabel} · ${modelConfigs.length} model${modelConfigs.length === 1 ? "" : "s"}`;
}

/**
 * Provider prefix for a model config, or undefined if it can't be derived.
 * Deliberately NOT `Models.getProviderName` (see the import comment above) —
 * same underlying logic (`modelId.split("::")[0]`), just without importing
 * Models.ts's runtime code, and returning undefined instead of throwing.
 */
function tryGetProviderName(config: ModelConfig): string | undefined {
    return config.modelId.split("::")[0] || undefined;
}

/**
 * Curates a model-set preset from the catalog. Chorus's model catalog has no
 * "good at coding" / "general chat" capability flags (confirmed by reading
 * Models.ts), so "Coding" and "Chat trio" use the SAME selection heuristic
 * (one model per distinct provider, preferring ones already selected for
 * this chat) — the meaningful difference between presets in this app is the
 * rewrite's framing (see buildOptimizerPrompt's intent instructions get
 * reused across sets) not a fabricated model-capability distinction. "Fast /
 * cheap" is the one preset with a real, data-backed signal: cheapest
 * available models by combined prompt+completion price per token.
 */
export function chooseModelSet(
    modelSet: OptimizerModelSet,
    visibleConfigs: ModelConfig[],
    currentSelection: ModelConfig[],
): ModelConfig[] {
    if (modelSet === "fast-cheap") {
        const priced = visibleConfigs
            .filter(
                (c) =>
                    c.promptPricePerToken !== undefined ||
                    c.completionPricePerToken !== undefined,
            )
            .sort((a, b) => {
                const aPrice =
                    (a.promptPricePerToken ?? 0) +
                    (a.completionPricePerToken ?? 0);
                const bPrice =
                    (b.promptPricePerToken ?? 0) +
                    (b.completionPricePerToken ?? 0);
                return aPrice - bPrice;
            });
        if (priced.length > 0) return priced.slice(0, 3);
        // No pricing data available anywhere in the catalog — fall through
        // to the same provider-diversity heuristic as chat-trio/coding
        // rather than returning an empty, useless set.
    }

    // chat-trio / coding / fast-cheap-without-pricing-data: one model per
    // distinct provider, up to 3, preferring the chat's current selection.
    const chosen: ModelConfig[] = [];
    const seenProviders = new Set<string>();

    for (const config of currentSelection) {
        if (chosen.length >= 3) break;
        const provider = tryGetProviderName(config);
        if (!provider || seenProviders.has(provider)) continue;
        seenProviders.add(provider);
        chosen.push(config);
    }
    for (const config of visibleConfigs) {
        if (chosen.length >= 3) break;
        const provider = tryGetProviderName(config);
        if (!provider || seenProviders.has(provider)) continue;
        seenProviders.add(provider);
        chosen.push(config);
    }

    // Still nothing (e.g. every visible config shares one provider) — just
    // use whatever's currently selected rather than showing an empty set.
    return chosen.length > 0 ? chosen : currentSelection.slice(0, 3);
}
