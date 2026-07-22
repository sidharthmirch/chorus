/**
 * Model-selection-default controls, split out of the pre-rework
 * `DefaultsTab.tsx` (docs/rework/w3-settings-inventory.md items #18-21).
 * Mounted inside the Models section's Advanced disclosure, directly below
 * the live model catalog (`ModelSettingsRows`) — so "no vision models yet"
 * messaging can just point up at that list instead of needing a
 * cross-section navigation callback the way the old `onOpenVisibleModels`
 * prop did.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Separator } from "../ui/separator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import {
    SettingsManager,
    type Settings as CoreSettings,
} from "@core/utilities/Settings";
import { usePromptProfiles } from "@core/chorus/api/PromptProfilesAPI";
import { useModelProfiles } from "@core/chorus/api/ModelProfilesAPI";
import { useModelConfigs } from "@core/chorus/api/ModelsAPI";
import { useProviderVisibilityMap } from "@core/chorus/api/ProviderVisibilityAPI";
import { getFilteredModelConfigs } from "@core/utilities/ModelFiltering";
import {
    modelConfigSupportsVision,
    isModelConfigEffectivelyVisible,
} from "@core/chorus/chatCreationDefaults";
import { formatCostSuffix } from "./formatCostSuffix";
import { ChatModelsChecklist } from "./ChatModelsChecklist";

const NONE = "__none__";

export function ModelDefaultsPanel() {
    const settingsManager = SettingsManager.getInstance();
    const { data: promptProfiles } = usePromptProfiles();
    const { data: modelProfiles } = useModelProfiles();
    const { data: allConfigs = [] } = useModelConfigs();
    const providerVisibilityMap = useProviderVisibilityMap();

    // Defaults are global (not profile-scoped), so we intentionally skip active
    // model profile filtering here. Selected defaults may be filtered out at
    // chat creation time if they fall outside the active profile.
    const visibleModels = useMemo(
        () =>
            getFilteredModelConfigs(
                allConfigs,
                providerVisibilityMap,
                null,
            ).filter((c) => c.isEnabled && !c.isInternal && !c.isDeprecated),
        [allConfigs, providerVisibilityMap],
    );

    const visibilityMap = useMemo(() => {
        const m = new Map<string, boolean>();
        if (providerVisibilityMap) {
            for (const [k, v] of providerVisibilityMap) {
                m.set(k, v);
            }
        }
        return m;
    }, [providerVisibilityMap]);

    const [defaultPromptProfileId, setDefaultPromptProfileId] = useState<
        string | null
    >(null);
    const [defaultFallbackModel, setDefaultFallbackModel] = useState<
        string | null
    >(null);
    const [defaultFallbackModelProfileId, setDefaultFallbackModelProfileId] =
        useState<string | null>(null);
    const [defaultAmbientChatModel, setDefaultAmbientChatModel] = useState<
        string | null
    >(null);
    const [defaultChatModels, setDefaultChatModels] = useState<string[] | null>(
        null,
    );

    const persist = useCallback(
        async (partial: Partial<CoreSettings>) => {
            const current = await settingsManager.get();
            await settingsManager.set({ ...current, ...partial });
        },
        [settingsManager],
    );

    useEffect(() => {
        const load = async () => {
            const s = await settingsManager.get();
            setDefaultPromptProfileId(s.defaultPromptProfileId ?? null);
            setDefaultFallbackModel(s.defaultFallbackModel ?? null);
            setDefaultFallbackModelProfileId(
                s.defaultFallbackModelProfileId ?? null,
            );
            setDefaultAmbientChatModel(s.defaultAmbientChatModel ?? null);
            setDefaultChatModels(s.defaultChatModels ?? null);
        };
        void load();
    }, [settingsManager]);

    const visionVisibleModels = useMemo(
        () => visibleModels.filter((m) => modelConfigSupportsVision(m)),
        [visibleModels],
    );

    const fallbackSelectValue = useMemo(() => {
        if (!defaultFallbackModel) return NONE;
        const c = visibleModels.find((m) => m.id === defaultFallbackModel);
        if (c && isModelConfigEffectivelyVisible(c, visibilityMap)) {
            return defaultFallbackModel;
        }
        return NONE;
    }, [defaultFallbackModel, visibleModels, visibilityMap]);

    const ambientSelectValue = useMemo(() => {
        if (!defaultAmbientChatModel) return NONE;
        const c = visibleModels.find((m) => m.id === defaultAmbientChatModel);
        if (
            c &&
            isModelConfigEffectivelyVisible(c, visibilityMap) &&
            modelConfigSupportsVision(c)
        ) {
            return defaultAmbientChatModel;
        }
        return NONE;
    }, [defaultAmbientChatModel, visibleModels, visibilityMap]);

    const staleFallback =
        !!defaultFallbackModel && fallbackSelectValue === NONE;
    const staleAmbient =
        !!defaultAmbientChatModel && ambientSelectValue === NONE;

    const compatibleFallbackProfiles = useMemo(
        () =>
            (modelProfiles ?? []).filter(
                (p) =>
                    !!defaultFallbackModel &&
                    p.modelConfigIds.includes(defaultFallbackModel),
            ),
        [modelProfiles, defaultFallbackModel],
    );

    const fallbackProfileIncompatible =
        !!defaultFallbackModelProfileId &&
        !compatibleFallbackProfiles.some(
            (p) => p.id === defaultFallbackModelProfileId,
        );

    const toggleDefaultChatModel = (id: string, checked: boolean) => {
        void (async () => {
            const visibleIds = new Set(visibleModels.map((c) => c.id));
            if (!visibleIds.has(id)) return;

            let next: string[] | null;
            if (!defaultChatModels || defaultChatModels.length === 0) {
                next = checked ? [id] : null;
            } else if (defaultChatModels.includes(id)) {
                const filtered = defaultChatModels.filter((x) => x !== id);
                next = filtered.length === 0 ? null : filtered;
            } else {
                next = checked ? [...defaultChatModels, id] : defaultChatModels;
            }

            setDefaultChatModels(next);
            await persist({ defaultChatModels: next });
        })();
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <label className="font-semibold">Default Prompt Profile</label>
                <p className="text-sm text-muted-foreground">
                    Automatically injected into new regular chats.
                </p>
                <Select
                    value={defaultPromptProfileId ?? NONE}
                    onValueChange={(v) => {
                        const next = v === NONE ? null : v;
                        setDefaultPromptProfileId(next);
                        void persist({ defaultPromptProfileId: next });
                    }}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {(promptProfiles ?? []).map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                                {p.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Separator />

            <div className="space-y-2">
                <label className="font-semibold">Default Fallback Model</label>
                <p className="text-sm text-muted-foreground">
                    Single model for new chats when{" "}
                    <span className="font-medium text-foreground/90">
                        Default Chat Models
                    </span>{" "}
                    is cleared. Takes priority over your current multi-model
                    (⌘J) list. For recovery when a chat&apos;s models are no
                    longer visible, the same order applies after filtering.
                </p>
                <Select
                    value={fallbackSelectValue}
                    onValueChange={(v) => {
                        const next = v === NONE ? null : v;
                        setDefaultFallbackModel(next);
                        void persist({ defaultFallbackModel: next });
                    }}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a model…" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {visibleModels.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                                <span className="flex flex-col gap-0.5 text-left">
                                    <span>{c.displayName}</span>
                                    <span className="text-xs text-muted-foreground font-normal">
                                        {formatCostSuffix(c)}
                                    </span>
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {staleFallback && (
                    <p className="text-xs text-muted-foreground">
                        Previously selected model is no longer in your visible
                        models.
                    </p>
                )}
            </div>

            {defaultFallbackModel &&
                fallbackSelectValue !== NONE &&
                (modelProfiles?.length ?? 0) > 0 && (
                    <div className="space-y-2">
                        <label className="font-semibold">
                            Model Profile for Fallback
                        </label>
                        <p className="text-sm text-muted-foreground">
                            When set, the fallback model must belong to this
                            profile. Only profiles that include the selected
                            fallback model are shown.
                        </p>
                        <Select
                            value={defaultFallbackModelProfileId ?? NONE}
                            onValueChange={(v) => {
                                const next = v === NONE ? null : v;
                                setDefaultFallbackModelProfileId(next);
                                void persist({
                                    defaultFallbackModelProfileId: next,
                                });
                            }}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="None" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE}>None</SelectItem>
                                {compatibleFallbackProfiles.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {fallbackProfileIncompatible && (
                            <p className="text-xs text-destructive">
                                The saved profile no longer includes the
                                selected fallback model. Clear it to avoid
                                conflicts.
                            </p>
                        )}
                    </div>
                )}

            <Separator />

            <div className="space-y-2">
                <label className="font-semibold">
                    Default Ambient Chat Model{" "}
                    <span className="text-muted-foreground font-normal">
                        (vision-capable models only)
                    </span>
                </label>
                <p className="text-sm text-muted-foreground">
                    Model used for ambient chat. Only visible models that accept
                    image input are listed.
                </p>
                <Select
                    value={ambientSelectValue}
                    disabled={visionVisibleModels.length === 0}
                    onValueChange={(v) => {
                        const next = v === NONE ? null : v;
                        setDefaultAmbientChatModel(next);
                        void persist({ defaultAmbientChatModel: next });
                    }}
                >
                    <SelectTrigger className="w-full">
                        <SelectValue
                            placeholder={
                                visionVisibleModels.length === 0
                                    ? "No vision models"
                                    : "Select a model…"
                            }
                        />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {visionVisibleModels.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                                <span className="flex flex-col gap-0.5 text-left">
                                    <span>{c.displayName}</span>
                                    <span className="text-xs text-muted-foreground font-normal">
                                        {formatCostSuffix(c)}
                                    </span>
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {visionVisibleModels.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                        No vision-capable models available. Enable a vision
                        model in the catalog above.
                    </p>
                )}
                {staleAmbient && (
                    <p className="text-xs text-muted-foreground">
                        Previously selected model is no longer available as a
                        visible vision model.
                    </p>
                )}
            </div>

            <Separator />

            <ChatModelsChecklist
                visibleModels={visibleModels}
                defaultChatModels={defaultChatModels}
                onToggle={toggleDefaultChatModel}
                onClear={() => {
                    setDefaultChatModels(null);
                    void persist({ defaultChatModels: null });
                }}
            />
        </div>
    );
}
