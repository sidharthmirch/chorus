/**
 * The "Default Chat Models" provider-grouped checklist — split out of
 * `ModelDefaultsPanel.tsx` to keep that file under the ~400-line guideline.
 * Purely presentational + provider-grouping; all persistence stays in the
 * parent (`onToggle`/`onClear` callbacks).
 */
import { useMemo } from "react";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import type { ModelConfig } from "@core/chorus/Models";
import { getProviderName } from "@core/chorus/Models";
import { formatCostSuffix } from "./formatCostSuffix";

const PROVIDER_LABELS: Record<string, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google AI (Gemini)",
    openrouter: "OpenRouter",
    grok: "Grok",
    perplexity: "Perplexity",
    ollama: "Ollama",
    lmstudio: "LM Studio",
};

const PROVIDER_ORDER = [
    "anthropic",
    "openai",
    "google",
    "openrouter",
    "grok",
    "perplexity",
    "ollama",
    "lmstudio",
];

function groupByProvider(models: ModelConfig[]): [string, ModelConfig[]][] {
    const groups = new Map<string, ModelConfig[]>();
    for (const m of models) {
        const provider = getProviderName(m.modelId);
        const existing = groups.get(provider) ?? [];
        existing.push(m);
        groups.set(provider, existing);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
        const ai = PROVIDER_ORDER.indexOf(a);
        const bi = PROVIDER_ORDER.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });
}

export function ChatModelsChecklist({
    visibleModels,
    defaultChatModels,
    onToggle,
    onClear,
}: {
    visibleModels: ModelConfig[];
    defaultChatModels: string[] | null;
    onToggle: (id: string, checked: boolean) => void;
    onClear: () => void;
}) {
    const staleChatModelIds = useMemo(
        () =>
            (defaultChatModels ?? []).filter(
                (id) => !visibleModels.some((m) => m.id === id),
            ),
        [defaultChatModels, visibleModels],
    );

    const providerGroups = useMemo(
        () => groupByProvider(visibleModels),
        [visibleModels],
    );

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <label className="font-semibold">Default Chat Models</label>
                <Button variant="outline" size="sm" onClick={onClear}>
                    Clear
                </Button>
            </div>
            <p className="text-sm text-muted-foreground">
                Optional explicit list: every new regular chat starts with
                exactly these models (in order). When cleared, new chats use{" "}
                <span className="font-medium text-foreground/90">
                    Default Fallback Model
                </span>{" "}
                if set, otherwise your ⌘J multi-model list, then the first
                visible model.
            </p>
            {staleChatModelIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                    Some saved defaults are no longer visible and will be
                    skipped.
                </p>
            )}
            <div className="max-h-72 overflow-y-auto border rounded-md p-3 space-y-4">
                {visibleModels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No visible models. Configure them in the catalog
                        above.
                    </p>
                ) : (
                    providerGroups.map(([provider, models]) => {
                        const label = PROVIDER_LABELS[provider] ?? provider;
                        return (
                            <div key={provider}>
                                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                                    {label}
                                </div>
                                <div className="pl-1 space-y-2">
                                    {models.map((m) => (
                                        <label
                                            key={m.id}
                                            className="flex items-start gap-2 text-sm cursor-pointer"
                                        >
                                            <Checkbox
                                                className="mt-0.5"
                                                checked={
                                                    defaultChatModels?.includes(
                                                        m.id,
                                                    ) ?? false
                                                }
                                                onCheckedChange={(checked) =>
                                                    onToggle(m.id, !!checked)
                                                }
                                            />
                                            <span>
                                                <span className="font-medium">
                                                    {m.displayName}
                                                </span>
                                                <span className="text-muted-foreground text-xs block">
                                                    {formatCostSuffix(m)}
                                                </span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
