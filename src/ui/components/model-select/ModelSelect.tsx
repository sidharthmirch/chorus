import { useMemo } from "react";
import { ModelConfig } from "@core/chorus/Models";
import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import * as MessageAPI from "@core/chorus/api/MessageAPI";
import { CommandDialog } from "@ui/components/ui/command";
import { dialogActions } from "@core/infra/DialogStore";
import { ModelSelectPopover } from "./ModelSelectPopover";
import { ModelSelectList } from "./ModelSelectList";
import { ModelPickerMode } from "./types";

export interface ModelSelectProps {
    id: string;
    mode: ModelPickerMode;
    onAddApiKey: () => void;
    onOpenProfile?: (modelConfigId: string) => void;
    showCost?: boolean;
}

const EMPTY_MODEL_CONFIGS: ModelConfig[] = [];

/**
 * Container that adapts the legacy `ModelPickerMode` union onto either the
 * frozen `ModelSelectPopover` (default/compare) or the chrome-agnostic
 * `ModelSelectList` inside a `CommandDialog` (add/single) — this is what
 * `ManageModelsBox.tsx` delegates its three branches to (P3), keeping its
 * own external props/dialog-id exports byte-for-byte per
 * docs/rework/w4-model-select-inventory.md §1.
 */
export function ModelSelect({
    id,
    mode,
    onAddApiKey,
    onOpenProfile,
    showCost,
}: ModelSelectProps) {
    // "default" mode falls back to the global ambient compare list/updater
    // when the mount site doesn't scope selection to one chat — ported
    // verbatim from ManageModelsBox.tsx (inventory §2).
    const ambientCompare = ModelsAPI.useSelectedModelConfigsCompare();
    const updateAmbientCompare = MessageAPI.useUpdateSelectedModelConfigsCompare();

    const selectedModelConfigs = useMemo(() => {
        if (mode.type !== "default") return EMPTY_MODEL_CONFIGS;
        return mode.selectedModelConfigsForChat ?? ambientCompare.data ?? EMPTY_MODEL_CONFIGS;
    }, [mode, ambientCompare.data]);

    if (mode.type === "default") {
        return (
            <ModelSelectPopover
                id={id}
                selectedModelConfigs={selectedModelConfigs}
                onToggleModelConfig={mode.onToggleModelConfig}
                onClearModelConfigs={mode.onClearModelConfigs}
                onSelectAllModelConfigs={mode.onSelectAllModelConfigs}
                onUnionSelectAllVisibleModelConfigs={mode.onUnionSelectAllVisibleModelConfigs}
                onReorderSelectedModelConfigs={
                    mode.onReorderSelectedModelConfigs ??
                    ((modelConfigs: ModelConfig[]) =>
                        void updateAmbientCompare.mutateAsync({ modelConfigs }))
                }
                onOpenProfile={onOpenProfile}
                onAddApiKey={onAddApiKey}
                showCost={showCost}
            />
        );
    }

    const checkedIds =
        mode.type === "add"
            ? mode.checkedModelConfigIds
            : mode.selectedModelConfigId
              ? [mode.selectedModelConfigId]
              : [];

    return (
        <CommandDialog id={id} commandProps={{ shouldFilter: false }}>
            <ModelSelectList
                variant={mode.type}
                checkedIds={checkedIds}
                onSelect={(modelConfigId) => {
                    if (mode.type === "add") {
                        mode.onAddModel(modelConfigId);
                    } else {
                        mode.onSetModel(modelConfigId);
                    }
                    // Matches ManageModelsBox's pre-rework
                    // `handleToggleModelConfig`: add/single both close the
                    // dialog immediately on pick (default/compare does not
                    // — it has its own "Done" button).
                    dialogActions.closeDialog();
                }}
                onAddApiKey={onAddApiKey}
                showCost={showCost}
            />
        </CommandDialog>
    );
}
