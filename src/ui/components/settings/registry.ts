import type { ComponentType } from "react";
import {
    UserCircle,
    Layers,
    Sparkles,
    PlugIcon,
    SlidersHorizontal,
    type LucideIcon,
} from "lucide-react";
import { AccountsSection } from "./sections/AccountsSection";
import { ModelsSection } from "./sections/ModelsSection";
import { ModesSection } from "./sections/ModesSection";
import { ConnectionsSection } from "./sections/ConnectionsSection";
import { AppSection } from "./sections/AppSection";

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

export interface ISettingsSection {
    id: SettingsSectionId;
    label: string;
    description: string;
    icon: LucideIcon;
    /** Search terms the shell's nav filter matches against, besides label/description. */
    keywords: string[];
    component: ComponentType<ISettingsSectionProps>;
}

export const SETTINGS_SECTIONS: ISettingsSection[] = [
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
        component: AccountsSection,
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
        component: ModelsSection,
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
        component: ModesSection,
    },
    {
        id: "connections",
        label: "Connections",
        description: "MCP servers, toolsets, integrations",
        icon: PlugIcon,
        keywords: ["mcp", "toolset", "fleet", "fleetd", "tool", "server"],
        component: ConnectionsSection,
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
        component: AppSection,
    },
];

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId =
    SETTINGS_SECTIONS[0].id;

export function isSettingsSectionId(
    value: string | undefined | null,
): value is SettingsSectionId {
    if (!value) return false;
    return SETTINGS_SECTIONS.some((section) => section.id === value);
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
