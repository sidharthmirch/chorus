import type { ModelConfig } from "@core/chorus/Models";

/**
 * Typed registry of which affordances a given mounting of `ModelRow` shows.
 * One row component serves both surfaces (composer popover catalog rows,
 * Settings rows, quick-chat single-select list, add-model list) — per the
 * W4 brief's "one component vocabulary across two surfaces" — with the
 * differences expressed as data, not forked components.
 */
export interface ModelRowAffordances {
    /** Leading multi-select checkbox. Selection semantics are the caller's (chat compare vs. pin) — this component only renders/toggles. */
    checkbox?: boolean;
    /** When true and `checkbox` is false, a trailing check icon marks the selected row instead (reply / quick-chat single-select). */
    trailingCheck?: boolean;
    /** Favorite star — distinct from `checkbox` (see PROGRESS.md decisions log: a pin, independent of chat selection or settings visibility). */
    favorite?: boolean;
    /** Visibility switch (Settings rows). */
    visibilityToggle?: boolean;
    /** Quota bar + mono "via" label, sourced from `useModelViaInfo`. */
    quota?: boolean;
    /** Capability chips (text/image/webpage/pdf) + NEW badge + optional pricing. */
    badges?: boolean;
    /** Edit affordance (Settings rows; meaningful for custom/user models). */
    edit?: boolean;
    /** Delete affordance (Settings rows; custom models only). */
    delete?: boolean;
}

export interface ModelRowCallbacks {
    onToggle?: () => void;
    onAddApiKey?: () => void;
    onTogglePinned?: () => void;
    onToggleVisible?: (visible: boolean) => void;
    onEdit?: () => void;
    onDelete?: () => void;
}

/** Why a row can't be selected right now (drives the dim+CTA treatment). */
export type ModelRowDisabledReason = "no-api-key" | "model-disabled";

export interface ModelCatalogGroup {
    id: string;
    heading: string;
    models: ModelConfig[];
}

/**
 * `ManageModelsBox`'s pre-rework mode union — moved here (from
 * `ManageModelsBox.tsx`) so `ModelSelect.tsx` can depend on it without a
 * circular import (`ManageModelsBox.tsx` imports `ModelSelect` for its P3
 * internals; `ManageModelsBox.tsx` re-exports this type for back-compat).
 * Field names/shapes are FROZEN — 4 external call sites
 * (`ChatInput.tsx` x2, `MultiChat.tsx` x1, `MultiChatDeprecationPath.tsx` x1)
 * construct these structurally (docs/rework/w4-model-select-inventory.md §1).
 */
export type ModelPickerMode =
    | {
          type: "default";
          onToggleModelConfig: (id: string) => void;
          onClearModelConfigs: () => void;
          onSelectAllModelConfigs: (modelConfigs: ModelConfig[]) => void;
          /** ⌘⇧A: add all visible models without removing current selection */
          onUnionSelectAllVisibleModelConfigs?: (modelConfigs: ModelConfig[]) => void;
          /** When set, UI reflects this list instead of global compare metadata */
          selectedModelConfigsForChat?: ModelConfig[];
          onReorderSelectedModelConfigs?: (modelConfigs: ModelConfig[]) => void;
      }
    | {
          type: "add"; // used for adding to an existing set
          checkedModelConfigIds: string[];
          onAddModel: (id: string) => void;
      }
    | {
          type: "single"; // single select for updating selectedModelConfig
          onSetModel: (id: string) => void;
          selectedModelConfigId: string;
      };
