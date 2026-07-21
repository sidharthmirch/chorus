import { emit } from "@tauri-apps/api/event";
import { dialogActions } from "@core/infra/DialogStore";
import { useSettings } from "./hooks/useSettings";
import { ModelSelect } from "./model-select/ModelSelect";
import { ModelPickerMode } from "./model-select/types";

/**
 * P3 swap (docs/rework/w4-model-select-inventory.md §1): this file's
 * external surface — the `ManageModelsBox({ mode, id })` export, the
 * `ModelPickerMode` shape it accepts, and the three dialog-id constants
 * below — is FROZEN and unchanged, because 4 call sites outside this
 * workstream's ownership (`ChatInput.tsx` x2, `MultiChat.tsx` x1,
 * `MultiChatDeprecationPath.tsx` x1) construct/import them structurally.
 * Everything that used to live in this file (search/scoring, provider
 * grouping, the CommandDialog/CommandGroup/CommandItem tree, the profile
 * selector, the drag-reorder pill strip) now lives in
 * `src/ui/components/model-select/**` behind `ModelSelect`, so this file is
 * just the thin per-consumer glue: resolving `showCost` from settings and
 * wiring the "Add API key" / "profile chip" callbacks that
 * `ModelSelect`/`ModelSelectPopover` need but don't have an opinion on
 * themselves.
 */

export const MANAGE_MODELS_CHAT_DIALOG_ID = "manage-models-chat";
export const MANAGE_MODELS_COMPARE_DIALOG_ID = "manage-models-compare";
export const MANAGE_MODELS_COMPARE_INLINE_DIALOG_ID =
    "manage-models-compare-inline"; // dialog for the inline add model button

/** Opens the Accounts settings section (API keys now live there — see
 *  settings/sections/AccountsSection.tsx) and closes whichever model-picker
 *  dialog is open. REWORK-W3: repointed from the pre-rework "api-keys" tab
 *  id, per docs/rework/agents/W3-settings-rework.md's explicit instruction. */
function handleAddApiKey() {
    void emit("open_settings", { tab: "accounts" });
    dialogActions.closeDialog();
}

/**
 * Profile chip (per-model variant switcher, `SelectedPreviewPanel`) routes
 * to the Models settings section. REWORK-W3: repointed from the pre-rework
 * "visible-models" tab id now that W3 has shipped its own Models section
 * (settings/sections/ModelsSection.tsx, mounting model-select's own
 * ModelSettingsRows).
 */
function handleOpenProfile() {
    void emit("open_settings", { tab: "models" });
    dialogActions.closeDialog();
}

/** Main component that handles all model grouping and UI. */
export function ManageModelsBox({
    mode,
    id,
}: {
    mode: ModelPickerMode;
    id: string; // Allow any string ID for flexibility
}) {
    const settings = useSettings();
    const showCost = settings?.showCost ?? false;

    return (
        <ModelSelect
            id={id}
            mode={mode}
            onAddApiKey={handleAddApiKey}
            onOpenProfile={handleOpenProfile}
            showCost={showCost}
        />
    );
}
