import type { ComponentType } from "react";
import { AccountsSection } from "./sections/AccountsSection";
import { ModelsSection } from "./sections/ModelsSection";
import { ModesSection } from "./sections/ModesSection";
import { ConnectionsSection } from "./sections/ConnectionsSection";
import { AppSection } from "./sections/AppSection";
import {
    SETTINGS_SECTION_META,
    type ISettingsSectionMeta,
    type ISettingsSectionProps,
    type SettingsSectionId,
} from "./sectionMeta";

/**
 * Re-exports every pure id/metadata/resolution export from `sectionMeta.ts`
 * so existing consumers (`Settings.tsx`, `SettingsShell.tsx`) have one
 * import path for "the settings IA." Kept as a separate file from
 * `sectionMeta.ts` (rather than merging them) specifically so
 * `sectionMeta.ts` stays unit-testable without pulling in the 5 section
 * components' data-hook dependency chains — see that file's doc comment.
 */
export {
    SETTINGS_SECTION_META,
    DEFAULT_SETTINGS_SECTION,
    isSettingsSectionId,
    resolveSettingsSection,
} from "./sectionMeta";
export type {
    SettingsSectionId,
    ISettingsSectionMeta,
    ISettingsSectionProps,
} from "./sectionMeta";

export interface ISettingsSection extends ISettingsSectionMeta {
    component: ComponentType<ISettingsSectionProps>;
}

const SECTION_COMPONENTS: Record<
    SettingsSectionId,
    ComponentType<ISettingsSectionProps>
> = {
    accounts: AccountsSection,
    models: ModelsSection,
    modes: ModesSection,
    connections: ConnectionsSection,
    app: AppSection,
};

export const SETTINGS_SECTIONS: ISettingsSection[] = SETTINGS_SECTION_META.map(
    (meta) => ({ ...meta, component: SECTION_COMPONENTS[meta.id] }),
);
