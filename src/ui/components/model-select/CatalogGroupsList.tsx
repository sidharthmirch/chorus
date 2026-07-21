import { ReactNode } from "react";
import { RefreshCcwIcon } from "lucide-react";
import { ModelConfig } from "@core/chorus/Models";
import { CommandEmpty, CommandList } from "@ui/components/ui/command";
import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import { ProviderGroup } from "./ProviderGroup";
import { DeprecatedSection } from "./DeprecatedSection";
import { DirectProvider, UseModelCatalogResult } from "./useModelCatalog";

const DIRECT_PROVIDER_HEADINGS: Record<DirectProvider, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google",
    grok: "Grok",
    perplexity: "Perplexity",
};

function RefreshButton({
    isSpinning,
    onRefresh,
    title,
}: {
    isSpinning: boolean;
    onRefresh: () => void;
    title: string;
}) {
    return (
        <button
            type="button"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRefresh();
            }}
            className="flex items-center gap-1 rounded-md p-1.5 text-muted-foreground/50 hover:bg-accent"
            title={title}
        >
            <RefreshCcwIcon className={`h-3 w-3 ${isSpinning ? "animate-spin" : ""}`} />
        </button>
    );
}

export interface CatalogGroupsListProps {
    catalog: UseModelCatalogResult;
    searchQuery: string;
    renderRow: (model: ModelConfig) => ReactNode;
    className?: string;
}

/**
 * Shared groups-rendering body (OpenRouter / direct providers / Custom /
 * Local / deprecated disclosure) used by both `ModelSelectList` (single
 * column: add/single modes, quick chat) and `ModelSelectPopover` (two
 * column: the composer's default/compare mode) — one traversal of
 * `useModelCatalog`'s groups, one place to keep the provider ordering and
 * refresh affordances consistent across every surface.
 */
export function CatalogGroupsList({
    catalog,
    searchQuery,
    renderRow,
    className,
}: CatalogGroupsListProps) {
    const refreshOpenRouter = ModelsAPI.useRefreshOpenRouterModels();
    const refreshOllama = ModelsAPI.useRefreshOllamaModels();
    const refreshLMStudio = ModelsAPI.useRefreshLMStudioModels();

    return (
        <CommandList className={className}>
            <CommandEmpty>No models found</CommandEmpty>

            {(catalog.groups.openrouter.length > 0 || searchQuery === "") &&
                catalog.showOpenRouter && (
                    <ProviderGroup
                        heading="OpenRouter"
                        trailing={
                            <RefreshButton
                                isSpinning={refreshOpenRouter.isPending}
                                onRefresh={() => void refreshOpenRouter.mutateAsync()}
                                title="Refresh OpenRouter models"
                            />
                        }
                    >
                        {catalog.groups.openrouter.map(renderRow)}
                    </ProviderGroup>
                )}

            {(Object.keys(DIRECT_PROVIDER_HEADINGS) as DirectProvider[]).map(
                (provider) =>
                    catalog.groups.directByProvider[provider].length > 0 && (
                        <ProviderGroup key={provider} heading={DIRECT_PROVIDER_HEADINGS[provider]}>
                            {catalog.groups.directByProvider[provider].map(renderRow)}
                        </ProviderGroup>
                    ),
            )}

            {catalog.groups.custom.length > 0 && (
                <ProviderGroup heading="Custom">
                    {catalog.groups.custom.map(renderRow)}
                </ProviderGroup>
            )}

            {catalog.groups.local.length > 0 && (
                <ProviderGroup
                    heading="Local"
                    trailing={
                        <RefreshButton
                            isSpinning={refreshOllama.isPending || refreshLMStudio.isPending}
                            onRefresh={() => {
                                void refreshOllama.mutateAsync();
                                void refreshLMStudio.mutateAsync();
                            }}
                            title="Refresh local models"
                        />
                    }
                >
                    {catalog.groups.local.map(renderRow)}
                </ProviderGroup>
            )}

            <DeprecatedSection count={catalog.groups.deprecated.length}>
                {catalog.groups.deprecated.map(renderRow)}
            </DeprecatedSection>
        </CommandList>
    );
}
