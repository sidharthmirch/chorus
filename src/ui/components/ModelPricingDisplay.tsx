import { formatPricePerMillion } from "@core/chorus/api/CostAPI";
import { ModelConfig } from "@core/chorus/Models";
import { useSettings } from "./hooks/useSettings";

interface ModelPricingDisplayProps {
    modelConfigs: ModelConfig[];
}

function getPricingLabel(modelConfig: ModelConfig): string | undefined {
    const input = formatPricePerMillion(modelConfig.promptPricePerToken);
    const output = formatPricePerMillion(modelConfig.completionPricePerToken);

    if (!input || !output) {
        return undefined;
    }

    return `${input} / ${output} per 1M tokens`;
}

function getRangeLabel(modelConfigs: ModelConfig[]): string | undefined {
    const pricedConfigs = modelConfigs.filter(
        (config) =>
            formatPricePerMillion(config.promptPricePerToken) &&
            formatPricePerMillion(config.completionPricePerToken),
    );

    if (pricedConfigs.length === 0) {
        return undefined;
    }

    const firstPricing = getPricingLabel(pricedConfigs[0]);
    if (!firstPricing) {
        return undefined;
    }

    if (pricedConfigs.length === 1) {
        return firstPricing;
    }

    const promptPrices = pricedConfigs
        .map((config) => config.promptPricePerToken ?? 0)
        .filter((price) => price > 0);
    const completionPrices = pricedConfigs
        .map((config) => config.completionPricePerToken ?? 0)
        .filter((price) => price > 0);

    if (promptPrices.length === 0 || completionPrices.length === 0) {
        return firstPricing;
    }

    const minPrompt = Math.min(...promptPrices);
    const maxPrompt = Math.max(...promptPrices);
    const minCompletion = Math.min(...completionPrices);
    const maxCompletion = Math.max(...completionPrices);

    if (minPrompt === maxPrompt && minCompletion === maxCompletion) {
        return firstPricing;
    }

    const minPromptLabel = formatPricePerMillion(minPrompt);
    const maxPromptLabel = formatPricePerMillion(maxPrompt);
    const minCompletionLabel = formatPricePerMillion(minCompletion);
    const maxCompletionLabel = formatPricePerMillion(maxCompletion);

    if (
        !minPromptLabel ||
        !maxPromptLabel ||
        !minCompletionLabel ||
        !maxCompletionLabel
    ) {
        return firstPricing;
    }

    return `${minPromptLabel}-${maxPromptLabel} / ${minCompletionLabel}-${maxCompletionLabel} per 1M tokens`;
}

export function ModelPricingDisplay({
    modelConfigs,
}: ModelPricingDisplayProps) {
    const settings = useSettings();
    const showCost = settings?.showCost ?? false;

    if (!showCost || modelConfigs.length === 0) {
        return null;
    }

    const label =
        modelConfigs.length === 1
            ? getPricingLabel(modelConfigs[0])
            : getRangeLabel(modelConfigs);

    if (!label) {
        return null;
    }

    return (
        <div className="text-[10px] text-muted-foreground font-mono tabular-nums text-right">
            {label}
        </div>
    );
}
