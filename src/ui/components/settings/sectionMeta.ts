import {
    UserCircle,
    Layers,
    Sparkles,
    PlugIcon,
    SlidersHorizontal,
    type LucideIcon,
} from "lucide-react";

/**
 * Pure section metadata + id resolution — deliberately split out of
 * `registry.ts` (which additionally wires in the 5 section *components*)
 * so this file can be unit-tested directly. Importing the components
 * transitively imports their data hooks (`@core/chorus/api/*`), which
 * import `@core/chorus/DB.ts`'s module-top-level `await Database.load(...)`
 * — that throws "window is not defined" under plain vitest (same landmine
 * W6's PROGRESS.md documents for `ChatState.ts`/`promptOptimizer.ts`).
 * lucide-react icons have no such dependency, so they're safe here.
 */

/**
 * The 5-section IA replacing the pre-rework 12-tab `SettingsTabId`
 * (docs/rework/design/settings.md, docs/rework/w3-settings-inventory.md).
 * Order here is both the nav's render order and the fallback order (index 0
 * is `DEFAULT_SETTINGS_SECTION`).
 */
export type SettingsSectionId =
    | "accounts"
    | "models"
    | "modes"
    | "connections"
    | "app";

/** Every section component receives this — mainly so a section can send the
 *  user to a different one (e.g. Models' "Add API key" CTA -> Accounts)
 *  without needing its own routing/dialog knowledge. */
export interface ISettingsSectionProps {
    navigateToSection: (id: SettingsSectionId) => void;
}

export interface ISettingsSectionMeta {
    id: SettingsSectionId;
    label: string;
    description: string;
    icon: LucideIcon;
    /** Search terms the shell's nav filter matches against, besides label/description. */
    keywords: string[];
}

export const SETTINGS_SECTION_META: ISettingsSectionMeta[] = [
    {
        id: "accounts",
        label: "Accounts",
        description: "Manage providers, keys, quotas",
        icon: UserCircle,
        keywords: [
            "oauth",
            "api key",
            "provider",
            "quota",
            "anthropic",
            "openai",
            "google",
            "copilot",
            "openrouter",
            "ollama",
            "base url",
            "lm studio",
            "proxy",
        ],
    },
    {
        id: "models",
        label: "Models",
        description: "Configure model profiles and visibility",
        icon: Layers,
        keywords: [
            "visible",
            "favorite",
            "star",
            "catalog",
            "profile",
            "fallback",
            "ambient",
            "custom model",
            "pin",
        ],
    },
    {
        id: "modes",
        label: "Modes",
        description: "Manage message stances and system prompts",
        icon: Sparkles,
        keywords: [
            "stance",
            "assist",
            "critic",
            "socratic",
            "system prompt",
            "persona",
            "prompt profile",
        ],
    },
    {
        id: "connections",
        label: "Connections",
        description: "MCP servers, toolsets, integrations",
        icon: PlugIcon,
        keywords: ["mcp", "toolset", "fleet", "fleetd", "tool", "server"],
    },
    {
        id: "app",
        label: "App",
        description: "Appearance, behavior, permissions, data",
        icon: SlidersHorizontal,
        keywords: [
            "theme",
            "font",
            "cautious enter",
            "cost",
            "permission",
            "yolo",
            "import",
            "onboarding",
            "accessibility",
            "shortcut",
            "ambient chat",
        ],
    },
];

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId =
    SETTINGS_SECTION_META[0].id;

export function isSettingsSectionId(
    value: string | undefined | null,
): value is SettingsSectionId {
    if (!value) return false;
    return SETTINGS_SECTION_META.some((section) => section.id === value);
}

/**
 * Maps the pre-rework 12-tab `SettingsTabId` values (and the dead legacy
 * `"quick-chat"` redirect) onto the new 5 section ids, so every existing
 * `open_settings` emitter keeps working without each call site having to
 * know about the new IA. See docs/rework/w3-settings-inventory.md for the
 * full old-tab -> new-section mapping rationale.
 *
 * Deliberately has no `"docs"` entry: the old "Documentation" nav item never
 * went through `open_settings` at all (it called `openUrl` directly from
 * the sidebar's own click handler, never switching tab content) — no
 * existing caller passes `"docs"` here. The new shell's nav footer preserves
 * that exact behavior (`SettingsShell.tsx`'s "Documentation" row).
 */
const LEGACY_TAB_TO_SECTION: Record<string, SettingsSectionId> = {
    general: "app",
    import: "app",
    "system-prompt": "modes",
    "api-keys": "accounts",
    "visible-models": "models",
    "model-profiles": "models",
    "prompt-profiles": "modes",
    defaults: "models",
    "quick-chat": "app",
    connections: "connections",
    permissions: "app",
    "base-url": "accounts",
};

/** Unknown/removed section id -> first section (docs/rework/agents/W3-settings-rework.md). */
export function resolveSettingsSection(
    value: string | undefined | null,
): SettingsSectionId {
    if (!value) return DEFAULT_SETTINGS_SECTION;
    if (isSettingsSectionId(value)) return value;
    return LEGACY_TAB_TO_SECTION[value] ?? DEFAULT_SETTINGS_SECTION;
}
