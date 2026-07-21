import { useCallback, useState } from "react";
import { emit } from "@tauri-apps/api/event";
import { usePostHog } from "posthog-js/react";
import { ProviderLogo } from "./ui/provider-logo";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@ui/components/ui/popover";
import { Command } from "@ui/components/ui/command";
import { getProviderName } from "@core/chorus/Models";
import * as ModelsAPI from "@core/chorus/api/ModelsAPI";
import { ModelSelectList } from "./model-select/ModelSelectList";

/**
 * P4 swap (docs/rework/w4-model-select-inventory.md §2): now built on the
 * same `ModelSelectList`/`ModelRow`/`useModelCatalog` vocabulary as
 * `ManageModelsBox`'s add/single modes, instead of its own bespoke
 * cmdk-default-filter list. Two deliberate, documented behavior changes
 * from the pre-rework version (not silent regressions — see PROGRESS.md
 * decisions log and the PR test plan):
 *   1. Models are now grouped by provider (matching every other surface)
 *      instead of one flat list — the explicit point of "one vocabulary."
 *   2. The old belt-and-suspenders `!id.includes("chorus") &&
 *      !displayName.includes("Deprecated")` text filters are dropped in
 *      favor of the real flags they were guarding against
 *      (`models.is_internal` / `models.is_deprecated`, already enforced by
 *      `getFilteredModelConfigs` inside `useModelCatalog` — the same
 *      pipeline `ManageModelsBox`, which never had those text filters,
 *      has always relied on).
 * Kept identical: props (`onModelSelect`, `open?`, `onOpenChange?`), Popover
 * chrome, the posthog `quick_chat_model_selected` capture, and quick chat's
 * ambient use case ignoring the active model profile.
 */

interface ModelSelectorProps {
    onModelSelect: (modelId: string) => void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function QuickChatModelSelector({
    onModelSelect,
    open,
    onOpenChange,
}: ModelSelectorProps) {
    const posthog = usePostHog();
    const [isOpen, setIsOpen] = useState(false);
    const { data: selectedModelConfigQuickChat } =
        ModelsAPI.useSelectedModelConfigQuickChat();

    const onChangeOpen = useCallback(
        (newOpen: boolean) => {
            setIsOpen(newOpen);
            onOpenChange?.(newOpen);
        },
        [onOpenChange],
    );

    const handleModelSelect = useCallback(
        (modelId: string) => {
            onModelSelect(modelId);
            posthog?.capture("quick_chat_model_selected", { modelId });
            onChangeOpen(false); // Close after selection — ported behavior.
        },
        [onModelSelect, posthog, onChangeOpen],
    );

    const handleAddApiKey = useCallback(() => {
        void emit("open_settings", { tab: "api-keys" });
        onChangeOpen(false);
    }, [onChangeOpen]);

    return (
        <Popover
            open={open !== undefined ? open : isOpen}
            onOpenChange={onChangeOpen}
        >
            <PopoverTrigger asChild>
                <button
                    tabIndex={-1}
                    type="button"
                    onClick={() => onChangeOpen(true)}
                    className="text-sm text-foreground/75 inline-flex items-center gap-1 hover:bg-foreground/5 rounded-md px-1.5 py-0.5"
                >
                    {selectedModelConfigQuickChat ? (
                        <div className="flex items-center gap-1">
                            <ProviderLogo
                                provider={getProviderName(
                                    selectedModelConfigQuickChat.modelId,
                                )}
                                size="sm"
                            />
                            <span>
                                {selectedModelConfigQuickChat.displayName}
                            </span>
                        </div>
                    ) : (
                        <span>Select model</span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[340px] p-0 ml-6 bg-background rounded-lg text-foreground"
                onKeyDown={(e) => {
                    if (e.key === "Escape") {
                        e.stopPropagation();
                    }
                }}
            >
                <Command shouldFilter={false}>
                    <ModelSelectList
                        variant="quick-chat"
                        checkedIds={
                            selectedModelConfigQuickChat
                                ? [selectedModelConfigQuickChat.id]
                                : []
                        }
                        onSelect={handleModelSelect}
                        onAddApiKey={handleAddApiKey}
                        ignoreActiveProfile
                        placeholder="Choose an ambient chat model..."
                    />
                </Command>
            </PopoverContent>
        </Popover>
    );
}
