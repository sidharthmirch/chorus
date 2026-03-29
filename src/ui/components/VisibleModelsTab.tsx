import { useState } from "react";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import {
    useProviderVisibleModels,
    useSetModelVisibility,
    useSetAllProviderModelsVisible,
} from "@core/chorus/api/ProviderVisibilityAPI";
import {
    useModelConfigs,
    useRefreshOpenRouterModels,
    useRefreshOllamaModels,
    useRefreshLMStudioModels,
} from "@core/chorus/api/ModelsAPI";
import { ModelConfig } from "@core/chorus/Models";
import { Loader2, RefreshCcw } from "lucide-react";
import { getProviderName } from "@core/chorus/Models";

const FETCHABLE_PROVIDERS = ["openrouter", "ollama", "lmstudio"] as const;
type FetchableProvider = (typeof FETCHABLE_PROVIDERS)[number];

const PROVIDER_LABELS: Record<string, string> = {
    openrouter: "OpenRouter",
    ollama: "Ollama",
    lmstudio: "LM Studio",
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google",
    grok: "Grok",
    perplexity: "Perplexity",
};

/**
 * Extracts the sub-provider org from a model ID.
 * For "openrouter::meta-llama/llama-4-scout" returns "meta-llama".
 * For models without an org prefix returns null.
 */
function getSubProvider(modelId: string): string | null {
    const modelPart = modelId.split("::")[1];
    if (!modelPart) return null;
    const slashIdx = modelPart.indexOf("/");
    if (slashIdx === -1) return null;
    return modelPart.slice(0, slashIdx);
}

export function VisibleModelsTab() {
    const { data: visibleModels, isLoading } = useProviderVisibleModels();
    const { data: allModels } = useModelConfigs();
    const setVisibility = useSetModelVisibility();
    const setAllVisibility = useSetAllProviderModelsVisible();

    const refreshOpenRouter = useRefreshOpenRouterModels();
    const refreshOllama = useRefreshOllamaModels();
    const refreshLMStudio = useRefreshLMStudioModels();
    const [fetchingProviders, setFetchingProviders] = useState<
        Record<FetchableProvider, boolean>
    >({ openrouter: false, ollama: false, lmstudio: false });

    // Selected sub-provider filter per top-level provider (null = show all)
    const [subProviderFilter, setSubProviderFilter] = useState<
        Record<string, string | null>
    >({});

    if (isLoading || !allModels) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const handleFetchModels = async (provider: FetchableProvider) => {
        setFetchingProviders((prev) => ({ ...prev, [provider]: true }));
        try {
            if (provider === "openrouter")
                await refreshOpenRouter.mutateAsync();
            else if (provider === "ollama") await refreshOllama.mutateAsync();
            else if (provider === "lmstudio")
                await refreshLMStudio.mutateAsync();
        } finally {
            setFetchingProviders((prev) => ({ ...prev, [provider]: false }));
        }
    };

    // Group models by provider
    const allProviders = Array.from(
        new Set(allModels.map((m) => getProviderName(m.modelId))),
    );

    const fetchableWithModels = FETCHABLE_PROVIDERS.filter((p) =>
        allProviders.includes(p),
    );
    const fetchableWithoutModels = FETCHABLE_PROVIDERS.filter(
        (p) => !allProviders.includes(p),
    );
    const otherProviders = allProviders.filter(
        (p) => !FETCHABLE_PROVIDERS.includes(p as FetchableProvider),
    );

    const orderedProviders = [
        ...otherProviders,
        ...fetchableWithModels,
        ...fetchableWithoutModels,
    ];

    return (
        <div className="space-y-8 max-w-2xl">
            <div>
                <h2 className="text-2xl font-semibold mb-2">Visible Models</h2>
                <p className="text-sm text-muted-foreground">
                    Fetch and choose which models appear in the chat model
                    picker and in your model profiles.
                </p>
            </div>

            {orderedProviders.map((provider) => {
                const providerModels = allModels.filter(
                    (m) => getProviderName(m.modelId) === provider,
                );
                const isFetchable = FETCHABLE_PROVIDERS.includes(
                    provider as FetchableProvider,
                );
                const isFetching =
                    isFetchable &&
                    fetchingProviders[provider as FetchableProvider];

                // Compute unique sub-providers for this top-level provider
                const subProviders = Array.from(
                    new Set(
                        providerModels
                            .map((m) => getSubProvider(m.modelId))
                            .filter((s): s is string => s !== null),
                    ),
                ).sort();

                const activeSubFilter = subProviderFilter[provider] ?? null;

                // Apply sub-provider filter
                const visibleProviderModels: ModelConfig[] =
                    activeSubFilter !== null
                        ? providerModels.filter(
                              (m) =>
                                  getSubProvider(m.modelId) === activeSubFilter,
                          )
                        : providerModels;

                const isAllVisible = visibleProviderModels.every((m) => {
                    const v = visibleModels?.find(
                        (vm) => vm.modelId === m.modelId,
                    );
                    return v ? v.isVisible : true;
                });

                return (
                    <div
                        key={provider}
                        className="space-y-4 border rounded-lg p-4"
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">
                                {PROVIDER_LABELS[provider] ?? provider}
                            </h3>
                            <div className="flex items-center gap-2">
                                {isFetchable && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={isFetching}
                                        onClick={() =>
                                            void handleFetchModels(
                                                provider as FetchableProvider,
                                            )
                                        }
                                    >
                                        <RefreshCcw
                                            className={`w-3 h-3 mr-1 ${isFetching ? "animate-spin" : ""}`}
                                        />
                                        {isFetching
                                            ? "Fetching..."
                                            : "Fetch Models"}
                                    </Button>
                                )}
                                {visibleProviderModels.length > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setAllVisibility.mutate({
                                                providerName: provider as any,
                                                modelIds:
                                                    visibleProviderModels.map(
                                                        (m) => m.modelId,
                                                    ),
                                                isVisible: !isAllVisible,
                                            })
                                        }
                                    >
                                        {isAllVisible ? "Hide All" : "Show All"}
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Sub-provider filter chips */}
                        {subProviders.length > 1 && (
                            <div className="flex flex-wrap gap-1.5">
                                <button
                                    onClick={() =>
                                        setSubProviderFilter((prev) => ({
                                            ...prev,
                                            [provider]: null,
                                        }))
                                    }
                                    className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                                        activeSubFilter === null
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-background text-muted-foreground border-border hover:border-foreground/40"
                                    }`}
                                >
                                    All
                                </button>
                                {subProviders.map((sub) => (
                                    <button
                                        key={sub}
                                        onClick={() =>
                                            setSubProviderFilter((prev) => ({
                                                ...prev,
                                                [provider]:
                                                    prev[provider] === sub
                                                        ? null
                                                        : sub,
                                            }))
                                        }
                                        className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                                            activeSubFilter === sub
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-background text-muted-foreground border-border hover:border-foreground/40"
                                        }`}
                                    >
                                        {sub}
                                    </button>
                                ))}
                            </div>
                        )}

                        {providerModels.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                {isFetchable
                                    ? 'No models loaded yet. Click "Fetch Models" to load the model list.'
                                    : "No models available."}
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {visibleProviderModels.map((m) => {
                                    const visibility = visibleModels?.find(
                                        (vm) => vm.modelId === m.modelId,
                                    );
                                    const isVisible = visibility
                                        ? visibility.isVisible
                                        : true;

                                    return (
                                        <div
                                            key={m.id}
                                            className="flex items-center justify-between text-sm"
                                        >
                                            <span>{m.displayName}</span>
                                            <Switch
                                                checked={isVisible}
                                                onCheckedChange={(checked) =>
                                                    setVisibility.mutate({
                                                        providerName: provider,
                                                        modelId: m.modelId,
                                                        isVisible: checked,
                                                    })
                                                }
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
