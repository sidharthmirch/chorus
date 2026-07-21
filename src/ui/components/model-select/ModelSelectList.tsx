import { useState } from "react";
import { ModelConfig } from "@core/chorus/Models";
import { CommandInput } from "@ui/components/ui/command";
import { useToggleModelConfigPinned } from "@core/chorus/api/ModelFavoritesAPI";
import { ModelRow } from "./ModelRow";
import { CatalogGroupsList } from "./CatalogGroupsList";
import { ProfileFilterBar } from "./ProfileFilterBar";
import { useModelCatalog } from "./useModelCatalog";
import { ModelRowAffordances, ModelRowDisabledReason } from "./types";

export type ModelSelectListVariant = "add" | "single" | "quick-chat";

export interface ModelSelectListProps {
    variant: ModelSelectListVariant;
    /**
     * "add": ids already appended to the set (rendered disabled+checked).
     * "single"/"quick-chat": the one currently-selected id, if any (rendered
     * checked but still clickable — matches ManageModelsBox's pre-rework
     * `single` mode, which allowed re-picking the same model as a no-op).
     */
    checkedIds: string[];
    /** Fires once per pick; the caller decides whether to close its dialog/popover. */
    onSelect: (modelConfigId: string) => void;
    onAddApiKey: () => void;
    /** Quick chat's ambient use case ignores the active model profile (ported behavior). */
    ignoreActiveProfile?: boolean;
    showCost?: boolean;
    placeholder?: string;
}

/**
 * Chrome-agnostic content (search + grouped rows) — the caller supplies the
 * surrounding `<Command>`/`<CommandDialog>` (add/single, via
 * `ManageModelsBox`) or `<Popover><Command>` (quick chat, via
 * `QuickChatModelSelector`) shell, per docs/rework/w4-model-select-inventory.md's
 * consumer-contract notes.
 */
export function ModelSelectList({
    variant,
    checkedIds,
    onSelect,
    onAddApiKey,
    ignoreActiveProfile = false,
    showCost = false,
    placeholder = "Search models...",
}: ModelSelectListProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const catalog = useModelCatalog({ searchQuery, ignoreActiveProfile });
    const togglePinned = useToggleModelConfigPinned();

    const affordances: ModelRowAffordances = {
        trailingCheck: true,
        favorite: true,
        quota: true,
        badges: true,
    };

    const renderRow = (model: ModelConfig) => {
        const isChecked = checkedIds.includes(model.id);
        // "add" mode can't re-add an already-added model — force the
        // disabled+dimmed+no-CTA treatment regardless of API-key status
        // (matches ManageModelsBox's pre-rework CommandItem `disabled`
        // condition: `mode.type === "add" && checkedModelConfigIds.includes(m.id)`).
        const disabledReason: ModelRowDisabledReason | undefined =
            variant === "add" && isChecked
                ? "model-disabled"
                : catalog.getDisabledReason(model);
        return (
            <ModelRow
                key={model.id}
                modelConfig={model}
                commandValue={model.id}
                affordances={affordances}
                checked={isChecked}
                disabledReason={disabledReason}
                isNew={catalog.isNewModel(model)}
                pricingLabel={showCost ? catalog.formatPricing(model) : undefined}
                pinned={catalog.pinnedIds.includes(model.id)}
                onTogglePinned={() => togglePinned.mutate(model.id)}
                onToggle={() => onSelect(model.id)}
                onAddApiKey={onAddApiKey}
            />
        );
    };

    return (
        <>
            <CommandInput
                placeholder={placeholder}
                value={searchQuery}
                onValueChange={setSearchQuery}
                autoFocus
            />
            <ProfileFilterBar />
            <CatalogGroupsList catalog={catalog} searchQuery={searchQuery} renderRow={renderRow} />
        </>
    );
}
