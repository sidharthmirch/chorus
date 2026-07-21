import type { ModelConfig } from "@core/chorus/Models";

/** Shared by ModelDefaultsPanel's three model selects and
 *  ChatModelsChecklist's rows — split out so it has exactly one copy. */
export function formatCostSuffix(config: ModelConfig): string {
    if (
        config.promptPricePerToken === undefined &&
        config.completionPricePerToken === undefined
    ) {
        return "cost unknown";
    }
    const inM =
        config.promptPricePerToken !== undefined
            ? (config.promptPricePerToken * 1_000_000).toFixed(2)
            : "?";
    const outM =
        config.completionPricePerToken !== undefined
            ? (config.completionPricePerToken * 1_000_000).toFixed(2)
            : "?";
    return `$${inM} / 1M input · $${outM} / 1M output`;
}
