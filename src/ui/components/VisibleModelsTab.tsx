import { useState, useMemo, useEffect } from "react";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Input } from "./ui/input";
import {
    Collapsible,
    CollapsibleTrigger,
    CollapsibleContent,
} from "./ui/collapsible";
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
import { ModelConfig, ApiKeys, ProviderName } from "@core/chorus/Models";
import { Loader2, RefreshCcw, ChevronDown, ChevronRight } from "lucide-react";
import { getProviderName } from "@core/chorus/Models";
import { useApiKeys } from "@core/chorus/api/AppMetadataAPI";
import { canProceedWithProvider } from "@core/utilities/ProxyUtils";
import {
    filterModelsBySearch,
    getSubProvider,
    parseSubProviderSearch,
} from "./visibleModelsSearch";

const FETCHABLE_PROVIDERS = ["openrouter", "ollama", "lmstudio"] as const;
type FetchableProvider = (typeof FETCHABLE_PROVIDERS)[number];

const LOCAL_PROVIDERS = new Set(["ollama", "lmstudio"]);
const API_KEY_REQUIRED_PROVIDERS = new Set<ProviderName>([
    "openrouter",
    "google",
    "openai",
    "anthropic",
]);
const SUB_PROVIDER_SEARCH_THRESHOLD = 10;

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

interface ProviderModelSectionProps {
    provider: ProviderName;
    providerModels: ModelConfig[];
    visibleModels: { modelId: string; isVisible: boolean }[] | undefined;
    isFetchable: boolean;
    isFetching: boolean;
    onFetchModels: () => void;
    onSetVisibility: (args: {
        providerName: ProviderName;
        modelId: string;
        isVisible: boolean;
    }) => void;
    onSetAllVisibility: (args: {
        providerName: ProviderName;
        modelIds: string[];
        isVisible: boolean;
    }) => void;
    apiKeys: ApiKeys | undefined;
}

function ProviderModelSection({
    provider,
    providerModels,
    visibleModels,
    isFetchable,
    isFetching,
    onFetchModels,
    onSetVisibility,
    onSetAllVisibility,
    apiKeys,
}: ProviderModelSectionProps) {
    const isLocal = LOCAL_PROVIDERS.has(provider);
    const providerHasKey =
        isLocal || canProceedWithProvider(provider, apiKeys ?? {}).canProceed;

    const [isOpen, setIsOpen] = useState(isLocal || providerHasKey);
    const [subProviderFilters, setSubProviderFilters] = useState<string[]>([]);
    const [subProviderSearch, setSubProviderSearch] = useState("");

    // Auto-expand when an API key is added for this provider
    useEffect(() => {
        if (providerHasKey && !isLocal) {
            setIsOpen(true);
        }
    }, [providerHasKey, isLocal]);

    const subProviders = useMemo(
        () =>
            Array.from(
                new Set(
                    providerModels
                        .map((m) => getSubProvider(m.modelId))
                        .filter((s): s is string => s !== null),
                ),
            ).sort(),
        [providerModels],
    );

    const showSubProviderSearch =
        subProviders.length > SUB_PROVIDER_SEARCH_THRESHOLD;

    const parsedSubProviderSearch = useMemo(
        () => parseSubProviderSearch(subProviderSearch, subProviders),
        [subProviderSearch, subProviders],
    );

    const filteredSubProviders = useMemo(() => {
        const term = (
            parsedSubProviderSearch.matchedSubProvider ??
            parsedSubProviderSearch.remainingSearch
        ).toLowerCase();
        if (!term) return subProviders;
        return subProviders.filter((s) => s.toLowerCase().includes(term));
    }, [subProviders, parsedSubProviderSearch]);

    const subProviderModelCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const m of providerModels) {
            const sub = getSubProvider(m.modelId);
            if (sub) counts[sub] = (counts[sub] ?? 0) + 1;
        }
        return counts;
    }, [providerModels]);

    const visibleProviderModels = useMemo(() => {
        return filterModelsBySearch(
            providerModels,
            subProviderSearch,
            subProviders,
            subProviderFilters,
        );
    }, [providerModels, subProviderFilters, subProviderSearch, subProviders]);

    const isAllVisible = visibleProviderModels.every((m) => {
        const v = visibleModels?.find((vm) => vm.modelId === m.modelId);
        return v ? v.isVisible : true;
    });

    const hasSubProviders = subProviders.length > 1;

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="border rounded-lg"
        >
            <div className="p-4 flex items-center justify-between">
                <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
                    {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <h3 className="font-semibold">
                        {PROVIDER_LABELS[provider] ?? provider}
                    </h3>
                    {!isLocal && !providerHasKey && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            No API key
                        </span>
                    )}
                </CollapsibleTrigger>
                <div className="flex items-center gap-2">
                    {isFetchable && (
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isFetching}
                            onClick={onFetchModels}
                        >
                            <RefreshCcw
                                className={`w-3 h-3 mr-1 ${isFetching ? "animate-spin" : ""}`}
                            />
                            {isFetching ? "Fetching..." : "Fetch Models"}
                        </Button>
                    )}
                    {visibleProviderModels.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                onSetAllVisibility({
                                    providerName: provider,
                                    modelIds: visibleProviderModels.map(
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

            <CollapsibleContent className="px-4 pb-4 space-y-4">
                {/* Searchable sub-provider filter (only for large sub-provider lists) */}
                {hasSubProviders && showSubProviderSearch && (
                    <Input
                        placeholder="Search providers..."
                        value={subProviderSearch}
                        onChange={(e) => setSubProviderSearch(e.target.value)}
                        className="h-8 text-sm"
                    />
                )}

                {/* Sub-provider filter chips */}
                {hasSubProviders && (
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            onClick={() => setSubProviderFilters([])}
                            className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                                subProviderFilters.length === 0
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-muted-foreground border-border hover:border-foreground/40"
                            }`}
                        >
                            All
                        </button>
                        {filteredSubProviders.map((sub) => (
                            <button
                                key={sub}
                                onClick={() =>
                                    setSubProviderFilters((prev) =>
                                        prev.includes(sub)
                                            ? prev.filter(
                                                  (item) => item !== sub,
                                              )
                                            : [...prev, sub],
                                    )
                                }
                                className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                                    subProviderFilters.includes(sub)
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-background text-muted-foreground border-border hover:border-foreground/40"
                                }`}
                            >
                                {sub}
                                {showSubProviderSearch &&
                                    subProviderModelCounts[sub] !==
                                        undefined && (
                                        <span className="ml-1 opacity-60">
                                            ({subProviderModelCounts[sub]})
                                        </span>
                                    )}
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
                ) : visibleProviderModels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No models match your search.
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
                                            onSetVisibility({
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
            </CollapsibleContent>
        </Collapsible>
    );
}

export function VisibleModelsTab() {
    const { data: visibleModels, isLoading } = useProviderVisibleModels();
    const { data: allModels } = useModelConfigs();
    const { data: apiKeys } = useApiKeys();
    const setVisibility = useSetModelVisibility();
    const setAllVisibility = useSetAllProviderModelsVisible();

    const refreshOpenRouter = useRefreshOpenRouterModels();
    const refreshOllama = useRefreshOllamaModels();
    const refreshLMStudio = useRefreshLMStudioModels();
    const [fetchingProviders, setFetchingProviders] = useState<
        Record<FetchableProvider, boolean>
    >({ openrouter: false, ollama: false, lmstudio: false });

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
    const allProviders: ProviderName[] = Array.from(
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

    const orderedProviders: ProviderName[] = [
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

            <div className="space-y-4">
                {orderedProviders.map((provider) => {
                    const providerModels = allModels.filter(
                        (m) => getProviderName(m.modelId) === provider,
                    );
                    const hideModelsWithoutKey =
                        API_KEY_REQUIRED_PROVIDERS.has(provider) &&
                        !canProceedWithProvider(provider, apiKeys ?? {})
                            .canProceed;
                    const filteredProviderModels = hideModelsWithoutKey
                        ? []
                        : providerModels;
                    const isFetchable = FETCHABLE_PROVIDERS.includes(
                        provider as FetchableProvider,
                    );
                    const isFetching =
                        isFetchable &&
                        fetchingProviders[provider as FetchableProvider];

                    return (
                        <ProviderModelSection
                            key={provider}
                            provider={provider}
                            providerModels={filteredProviderModels}
                            visibleModels={visibleModels}
                            isFetchable={isFetchable}
                            isFetching={isFetching}
                            onFetchModels={() =>
                                void handleFetchModels(
                                    provider as FetchableProvider,
                                )
                            }
                            onSetVisibility={setVisibility.mutate}
                            onSetAllVisibility={setAllVisibility.mutate}
                            apiKeys={apiKeys}
                        />
                    );
                })}
            </div>
        </div>
    );
}
