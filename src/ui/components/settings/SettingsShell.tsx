import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, BookOpen, ExternalLink } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { cn } from "@ui/lib/utils";
import { Input } from "../ui/input";
import {
    SETTINGS_SECTIONS,
    resolveSettingsSection,
    type SettingsSectionId,
} from "./registry";
import { useProviderAccounts } from "@core/chorus/api/ProviderAccountsAPI";
import { useModelConfigs } from "@core/chorus/api/ModelsAPI";
import { useProviderVisibilityMap } from "@core/chorus/api/ProviderVisibilityAPI";
import { getFilteredModelConfigs } from "@core/utilities/ModelFiltering";
import { useModes } from "@core/chorus/api/ModesAPI";
import * as ToolsetsAPI from "@core/chorus/api/ToolsetsAPI";

/** Old 12-tab capabilities absorbed into the 5 sections (nav footnote —
 *  design/settings.md's "Absorbed: ..." copy, filled with the real mapping
 *  from docs/rework/w3-settings-inventory.md rather than the mock's
 *  fictional example text). */
const ABSORBED_FOOTNOTE =
    "Absorbed: API Keys · Visible Models · Model Profiles · Prompt Profiles · Defaults · Tool Permissions · Base URL · System Prompt";

const SETTINGS_ROUTE_PATTERN = /^\/settings\/?([a-z-]*)$/;

function useSectionCounts(): Partial<Record<SettingsSectionId, number>> {
    const { data: accounts } = useProviderAccounts();
    const { data: allModelConfigs } = useModelConfigs();
    const providerVisibilityMap = useProviderVisibilityMap();
    const { data: modes } = useModes();
    const { data: customToolsets } = ToolsetsAPI.useCustomToolsetConfigs();

    return useMemo(() => {
        const visibleModelCount = allModelConfigs
            ? getFilteredModelConfigs(
                  allModelConfigs,
                  providerVisibilityMap,
                  null,
              ).filter((c) => c.isEnabled && !c.isInternal && !c.isDeprecated)
                  .length
            : undefined;
        return {
            accounts: accounts?.filter((a) => a.status === "connected")
                .length,
            models: visibleModelCount,
            modes: modes?.length,
            connections: customToolsets?.length,
        };
    }, [accounts, allModelConfigs, providerVisibilityMap, modes, customToolsets]);
}

export interface SettingsShellProps {
    /** Section requested by the legacy dialog-open mechanism (Rust menu /
     *  `open_settings` event's mapped section / CommandMenu's last-active).
     *  A *new* value here always wins over local nav state — mirrors the
     *  pre-rework Settings.tsx's activeTab-follows-defaultTab-prop effect. */
    requestedSection: SettingsSectionId;
}

/**
 * Left nav (sidebar-smoke surface, `.sidebar-label` header, 14px items) +
 * content pane + search-filter, per docs/rework/design/settings.md and
 * DESIGN.md's navigation spec. Dual-sourced active section: when mounted via
 * a `/settings/:section` route, the URL is the source of truth (nav clicks
 * `replace`-navigate, never growing history); when opened via the legacy
 * menu/shortcut/event mechanism, nav clicks are local state only, exactly
 * matching pre-rework behavior (URL untouched). See settings/MIGRATION-NOTES.md.
 */
export function SettingsShell({
    requestedSection,
}: SettingsShellProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const routeMatch = SETTINGS_ROUTE_PATTERN.exec(location.pathname);
    const isRouteActive = !!routeMatch;
    const routeSectionRaw = routeMatch?.[1];

    const [activeSection, setActiveSection] = useState<SettingsSectionId>(
        () =>
            isRouteActive
                ? resolveSettingsSection(routeSectionRaw)
                : requestedSection,
    );
    const [search, setSearch] = useState("");
    const counts = useSectionCounts();

    useEffect(() => {
        setActiveSection(
            isRouteActive
                ? resolveSettingsSection(routeSectionRaw)
                : requestedSection,
        );
    }, [isRouteActive, routeSectionRaw, requestedSection]);

    const selectSection = (id: SettingsSectionId) => {
        setActiveSection(id);
        if (isRouteActive) {
            navigate(`/settings/${id}`, { replace: true });
        }
    };

    const query = search.trim().toLowerCase();
    const filteredSections = useMemo(() => {
        if (!query) return SETTINGS_SECTIONS;
        return SETTINGS_SECTIONS.filter((section) => {
            const haystack = [
                section.label,
                section.description,
                ...section.keywords,
            ]
                .join(" ")
                .toLowerCase();
            return haystack.includes(query);
        });
    }, [query]);

    const active = SETTINGS_SECTIONS.find((s) => s.id === activeSection);
    const ActiveComponent = active?.component ?? SETTINGS_SECTIONS[0].component;

    return (
        <div className="flex h-full min-h-0">
            {/* Nav */}
            <div className="w-56 flex-shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
                <div className="p-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sidebar-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search settings…"
                            className="h-8 pl-8 text-sm bg-sidebar"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
                    <div className="sidebar-label px-2.5 mb-1 text-sidebar-muted-foreground">
                        Sections
                    </div>
                    {filteredSections.length === 0 ? (
                        <p className="px-2.5 py-2 text-xs text-sidebar-muted-foreground">
                            No matching sections.
                        </p>
                    ) : (
                        filteredSections.map((section) => {
                            const isActive = section.id === activeSection;
                            const count = counts[section.id];
                            const Icon = section.icon;
                            return (
                                <button
                                    key={section.id}
                                    type="button"
                                    onClick={() => selectSection(section.id)}
                                    className={cn(
                                        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-left transition-colors",
                                        isActive
                                            ? "bg-muted text-foreground font-medium"
                                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                                    )}
                                >
                                    <Icon className="h-3.5 w-3.5 shrink-0" />
                                    <span className="flex-1 truncate">
                                        {section.label}
                                    </span>
                                    {!!count && (
                                        <span className="font-geist-mono text-[10px] text-helper">
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>

                <div className="p-3 border-t border-sidebar-border space-y-2">
                    <button
                        type="button"
                        onClick={() => void openUrl("https://docs.chorus.sh")}
                        className="flex items-center gap-1.5 text-xs text-sidebar-muted-foreground hover:text-sidebar-foreground"
                    >
                        <BookOpen className="h-3 w-3" />
                        Documentation
                        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                    </button>
                    <p className="text-[11px] leading-snug text-helper">
                        {ABSORBED_FOOTNOTE}
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 min-h-0">
                <ActiveComponent navigateToSection={selectSection} />
            </div>
        </div>
    );
}
