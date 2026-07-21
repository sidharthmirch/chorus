import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { emit } from "@tauri-apps/api/event";
import { PlusIcon } from "lucide-react";
import { ModelConfig, getProviderName } from "@core/chorus/Models";
import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import {
    useProviderVisibleModels,
    useSetModelVisibility,
} from "@core/chorus/api/ProviderVisibilityAPI";
import { useToggleModelConfigPinned } from "@core/chorus/api/ModelFavoritesAPI";
import { Command, CommandInput } from "@ui/components/ui/command";
import { ModelRow } from "./ModelRow";
import { CatalogGroupsList } from "./CatalogGroupsList";
import { useModelCatalog } from "./useModelCatalog";
import { ModelRowAffordances } from "./types";

export interface ModelSettingsRowsProps {
    /** Defaults to emitting `open_settings` with tab "api-keys" — the same
     *  event ManageModelsBox's pre-rework "Add API Key" CTA used
     *  (App.tsx:765-770 already listens for it). */
    onAddApiKey?: () => void;
    /** Provide to show an Edit affordance on rows; omitted = no Edit button. */
    onEditModel?: (modelConfigId: string) => void;
    /** Defaults to navigating to `/new-prompt` — ManageModelsBox's existing
     *  "Add custom model" destination (App.tsx:903). */
    onAddCustomModel?: () => void;
    showCost?: boolean;
    className?: string;
}

/**
 * Ready-to-mount Settings › Models section body for W3 (per
 * `00-ARCHITECTURE.md §8`: `Settings.tsx`/`settings/**` is W3's, so this
 * lives entirely inside W4's owned `model-select/**` and W3 only needs to
 * drop it into a tab — no edits to `Settings.tsx`/`VisibleModelsTab.tsx`
 * required from this workstream). Row anatomy per design/model-select.md's
 * "Settings › Models Section": same catalog row + favorite star +
 * visibility switch + edit/delete, plus a dashed "add custom model"
 * affordance. Standardizes on ManageModelsBox's dim+CTA pattern for
 * no-API-key rows rather than `VisibleModelsTab.tsx`'s hide-the-whole-
 * provider pattern (inventory §5 flags the inconsistency for W3).
 */
export function ModelSettingsRows({
    onAddApiKey,
    onEditModel,
    onAddCustomModel,
    showCost = false,
    className,
}: ModelSettingsRowsProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const catalog = useModelCatalog({ searchQuery });
    const togglePinned = useToggleModelConfigPinned();
    const setVisibility = useSetModelVisibility();
    const { data: visibleModels } = useProviderVisibleModels();
    const deleteModelConfig = ModelsAPI.useDeleteModelConfig();
    const navigate = useNavigate();

    const handleAddApiKey = useCallback(() => {
        if (onAddApiKey) {
            onAddApiKey();
            return;
        }
        void emit("open_settings", { tab: "api-keys" });
    }, [onAddApiKey]);

    const handleAddCustomModel = useCallback(() => {
        if (onAddCustomModel) {
            onAddCustomModel();
            return;
        }
        navigate("/new-prompt");
    }, [onAddCustomModel, navigate]);

    const isVisible = useCallback(
        (modelId: string) =>
            visibleModels?.find((v) => v.modelId === modelId)?.isVisible ?? true,
        [visibleModels],
    );

    const renderRow = (model: ModelConfig) => {
        const affordances: ModelRowAffordances = {
            favorite: true,
            visibilityToggle: true,
            quota: true,
            badges: true,
            edit: !!onEditModel,
            delete: model.author === "user",
        };
        return (
            <ModelRow
                key={model.id}
                modelConfig={model}
                commandValue={model.id}
                affordances={affordances}
                disabledReason={catalog.getDisabledReason(model)}
                isNew={catalog.isNewModel(model)}
                pricingLabel={showCost ? catalog.formatPricing(model) : undefined}
                pinned={catalog.pinnedIds.includes(model.id)}
                onTogglePinned={() => togglePinned.mutate(model.id)}
                visible={isVisible(model.modelId)}
                onToggleVisible={(visible) =>
                    setVisibility.mutate({
                        providerName: getProviderName(model.modelId),
                        modelId: model.modelId,
                        isVisible: visible,
                    })
                }
                onEdit={() => onEditModel?.(model.id)}
                onDelete={() => deleteModelConfig.mutate({ modelConfigId: model.id })}
                onAddApiKey={handleAddApiKey}
            />
        );
    };

    return (
        <div className={className}>
            <Command shouldFilter={false} className="rounded-lg border border-border">
                <CommandInput
                    placeholder="Search models..."
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                />
                <CatalogGroupsList
                    catalog={catalog}
                    searchQuery={searchQuery}
                    renderRow={renderRow}
                    className="max-h-[480px] overflow-y-auto"
                />
            </Command>
            <button
                type="button"
                onClick={handleAddCustomModel}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            >
                <PlusIcon className="h-3.5 w-3.5" />
                Add custom model
            </button>
        </div>
    );
}
