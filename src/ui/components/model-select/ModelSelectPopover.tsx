import { useEffect, useState } from "react";
import { ArrowBigUpIcon } from "lucide-react";
import { ModelConfig } from "@core/chorus/Models";
import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import { useToggleModelConfigPinned } from "@core/chorus/api/ModelFavoritesAPI";
import { Dialog, DialogContent, DialogTitle } from "@ui/components/ui/dialog";
import { Command, CommandInput } from "@ui/components/ui/command";
import { Button } from "@ui/components/ui/button";
import { useDialogStore, dialogActions } from "@core/infra/DialogStore";
import { useShortcut } from "@ui/hooks/useShortcut";
import { ModelRow } from "./ModelRow";
import { CatalogGroupsList } from "./CatalogGroupsList";
import { ProfileFilterBar } from "./ProfileFilterBar";
import { SelectedPreviewPanel } from "./SelectedPreviewPanel";
import { useModelCatalog } from "./useModelCatalog";
import { ModelRowAffordances } from "./types";

/**
 * **Frozen composer-popover contract (W6 depends on it verbatim).** Mirrors
 * `ModelPickerMode`'s `default` variant field-for-field (renamed for
 * standalone clarity) so `ManageModelsBox`'s `default` branch can adapt to
 * it trivially, while also being mountable directly by W6's composer
 * rework without going through `ManageModelsBox`/`ModelPickerMode` at all.
 * Do not change these prop names/shapes without updating this comment and
 * flagging it in the PR — see `.rework/w4-PROGRESS.md`.
 */
export interface ModelSelectPopoverProps {
    /** Dialog-store id (existing app-wide convention: `dialogActions.openDialog(id)` / `useDialogStore`). */
    id: string;
    /** Ordered selection for this chat/context — index 0 renders as "main" in the preview panel (cosmetic; see inventory §3). */
    selectedModelConfigs: ModelConfig[];
    /** Toggle one model config in/out of the selection. */
    onToggleModelConfig: (modelConfigId: string) => void;
    /** Unselect everything ("Clear all" / ⌘⇧⌫). */
    onClearModelConfigs: () => void;
    /** Drag-reorder in the preview panel (optional — omit to disable reordering). */
    onReorderSelectedModelConfigs?: (modelConfigs: ModelConfig[]) => void;
    /** Replace the whole selection (e.g. "Apply profile"). */
    onSelectAllModelConfigs?: (modelConfigs: ModelConfig[]) => void;
    /** Add all currently-visible+selectable models without clearing the existing selection (⌘⇧A). Falls back to `onSelectAllModelConfigs` when omitted. */
    onUnionSelectAllVisibleModelConfigs?: (modelConfigs: ModelConfig[]) => void;
    /** Per-model "profile" chip click in the Selected panel (variant switch) — caller decides the nav target (typically Settings › Models). */
    onOpenProfile?: (modelConfigId: string) => void;
    /** Routes to Settings › API keys for a locked (no-key) row. */
    onAddApiKey: () => void;
    showCost?: boolean;
}

export function ModelSelectPopover({
    id,
    selectedModelConfigs,
    onToggleModelConfig,
    onClearModelConfigs,
    onReorderSelectedModelConfigs,
    onSelectAllModelConfigs,
    onUnionSelectAllVisibleModelConfigs,
    onOpenProfile,
    onAddApiKey,
    showCost = false,
}: ModelSelectPopoverProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const catalog = useModelCatalog({ searchQuery });
    const modelConfigsQuery = ModelsAPI.useModelConfigs();
    const togglePinned = useToggleModelConfigPinned();
    const isDialogClosed = useDialogStore((s) => s.activeDialogId === null);

    // Clear the search when the popover closes, same as the pre-rework
    // ManageModelsBox (docs/rework/w4-model-select-inventory.md §2).
    useEffect(() => {
        if (isDialogClosed) setSearchQuery("");
    }, [isDialogClosed]);

    useShortcut(["meta", "shift", "backspace"], onClearModelConfigs, {
        enableOnDialogIds: [id],
    });
    useShortcut(
        ["meta", "shift", "a"],
        () => {
            if (onUnionSelectAllVisibleModelConfigs) {
                onUnionSelectAllVisibleModelConfigs(catalog.selectableVisibleModels);
            } else {
                onSelectAllModelConfigs?.(catalog.selectableVisibleModels);
            }
        },
        { enableOnDialogIds: [id] },
    );

    const checkedIds = selectedModelConfigs.map((m) => m.id);
    const affordances: ModelRowAffordances = {
        checkbox: true,
        favorite: true,
        quota: true,
        badges: true,
    };

    const renderRow = (model: ModelConfig) => (
        <ModelRow
            key={model.id}
            modelConfig={model}
            commandValue={model.id}
            affordances={affordances}
            checked={checkedIds.includes(model.id)}
            disabledReason={catalog.getDisabledReason(model)}
            isNew={catalog.isNewModel(model)}
            pricingLabel={showCost ? catalog.formatPricing(model) : undefined}
            pinned={catalog.pinnedIds.includes(model.id)}
            onTogglePinned={() => togglePinned.mutate(model.id)}
            onToggle={() => onToggleModelConfig(model.id)}
            onAddApiKey={onAddApiKey}
        />
    );

    return (
        <Dialog id={id}>
            <DialogContent
                className="flex h-[82vh] max-h-[640px] w-full max-w-[680px] flex-col gap-0 overflow-hidden p-0"
                aria-describedby={undefined}
                onKeyDown={(e) => {
                    if (e.key === "Escape") e.stopPropagation();
                }}
            >
                <DialogTitle className="sr-only">Manage models</DialogTitle>
                <Command shouldFilter={false} className="flex h-full flex-col overflow-hidden">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <span className="text-lg font-medium text-foreground">Manage models</span>
                        <kbd className="font-geist-mono text-xs text-muted-foreground">⌘J</kbd>
                    </div>

                    <CommandInput
                        placeholder="Search models…"
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                        autoFocus
                        trailing={
                            <>
                                <span className="select-none">Select All</span>
                                <span className="inline-flex items-center gap-0.5 rounded bg-muted-foreground/10 px-1 py-0.5 font-sans text-[10px]">
                                    <span>⌘</span>
                                    <span>⇧</span>
                                    <span>A</span>
                                </span>
                            </>
                        }
                    />

                    <ProfileFilterBar
                        showApply
                        onApply={() => onSelectAllModelConfigs?.(catalog.profileSelectableConfigs)}
                        applyDisabled={
                            !catalog.activeProfile || catalog.profileSelectableConfigs.length === 0
                        }
                        applyTitle={
                            !catalog.activeProfile
                                ? "Choose a profile to replace the selection with its models"
                                : catalog.profileSelectableConfigs.length === 0
                                  ? "No models from this profile are available with your current keys and filters"
                                  : "Replace selection with this profile's models (deselects others)"
                        }
                    />

                    <div className="flex flex-1 overflow-hidden">
                        <div className="flex w-[55%] flex-col overflow-hidden border-r border-border">
                            <CatalogGroupsList
                                catalog={catalog}
                                searchQuery={searchQuery}
                                renderRow={renderRow}
                                className="flex-1 overflow-y-auto"
                            />
                        </div>
                        <SelectedPreviewPanel
                            className="w-[45%]"
                            selectedModelConfigs={selectedModelConfigs}
                            allModelConfigs={modelConfigsQuery.data ?? []}
                            onOpenProfile={onOpenProfile}
                            onReorder={onReorderSelectedModelConfigs}
                        />
                    </div>

                    <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                onClearModelConfigs();
                            }}
                            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                            Clear all
                            <span className="inline-flex items-center gap-0.5 rounded bg-muted-foreground/10 px-1 py-0.5 text-[10px]">
                                <span>⌘</span>
                                <ArrowBigUpIcon className="-mt-0.5 h-2.5 w-2.5" />
                                <span>⌫</span>
                            </span>
                        </button>
                        <Button size="sm" onClick={() => dialogActions.closeDialog(id)}>
                            Done
                        </Button>
                    </div>
                </Command>
            </DialogContent>
        </Dialog>
    );
}
