/**
 * Settings → Defaults consolidates default prompt profile, multi-model selection, fallback model,
 * and ambient (quick) chat model configuration. Former "Ambient Chat" tab controls (shortcut,
 * enable toggle, screen permissions) live here so a single "Ambient Chat" tab is not duplicated.
 *
 * Decision: Option A — one "Defaults" tab replaces the separate Ambient Chat tab (model selection
 * was already app-wide via app_metadata); shortcut/accessibility moved under the same heading.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Switch } from "./ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { Checkbox } from "./ui/checkbox";
import { SettingsManager, type Settings as CoreSettings } from "@core/utilities/Settings";
import { usePromptProfiles } from "@core/chorus/api/PromptProfilesAPI";
import { useModelProfiles } from "@core/chorus/api/ModelProfilesAPI";
import { useModelConfigs } from "@core/chorus/api/ModelsAPI";
import { useProviderVisibilityMap } from "@core/chorus/api/ProviderVisibilityAPI";
import { getFilteredModelConfigs } from "@core/utilities/ModelFiltering";
import type { ModelConfig } from "@core/chorus/Models";
import { getProviderName } from "@core/chorus/Models";
import {
    modelConfigSupportsVision,
    isModelConfigEffectivelyVisible,
} from "@core/chorus/chatCreationDefaults";
import { toast } from "sonner";
import { relaunch } from "@tauri-apps/plugin-process";
import ShortcutRecorder from "./ShortcutRecorder";
import { AccessibilitySettings } from "./AccessibilityCheck";

const NONE = "__none__";

function formatCostSuffix(config: ModelConfig): string {
    if (
        config.promptPricePerToken === undefined &&
        config.completionPricePerToken === undefined
    ) {
        return "cost unknown";
    }
    const inM =
        config.promptPricePerToken !== undefined
            ? (config.promptPricePerToken * 1_000_000).toFixed(2)
            : "?";
    const outM =
        config.completionPricePerToken !== undefined
            ? (config.completionPricePerToken * 1_000_000).toFixed(2)
            : "?";
    return `$${inM} / 1M input · $${outM} / 1M output`;
}

const PROVIDER_LABELS: Record<string, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google AI (Gemini)",
    openrouter: "OpenRouter",
    grok: "Grok",
    perplexity: "Perplexity",
    ollama: "Ollama",
    lmstudio: "LM Studio",
};

const PROVIDER_ORDER = [
    "anthropic",
    "openai",
    "google",
    "openrouter",
    "grok",
    "perplexity",
    "ollama",
    "lmstudio",
];

function groupByProvider(models: ModelConfig[]): [string, ModelConfig[]][] {
    const groups = new Map<string, ModelConfig[]>();
    for (const m of models) {
        const provider = getProviderName(m.modelId);
        const existing = groups.get(provider) ?? [];
        existing.push(m);
        groups.set(provider, existing);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
        const ai = PROVIDER_ORDER.indexOf(a);
        const bi = PROVIDER_ORDER.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });
}

export function DefaultsTab({
    onOpenVisibleModels,
}: {
    onOpenVisibleModels: () => void;
}) {
    const settingsManager = SettingsManager.getInstance();
    const { data: profiles } = usePromptProfiles();
    const { data: modelProfiles } = useModelProfiles();
    const { data: allConfigs = [] } = useModelConfigs();
    const providerVisibilityMap = useProviderVisibilityMap();

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
    const [defaultChatModels, setDefaultChatModels] = useState<
        string[] | null
    >(null);

    const [quickChatEnabled, setQuickChatEnabled] = useState(true);
    const [quickChatShortcut, setQuickChatShortcut] = useState("Alt+Space");

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
            setQuickChatEnabled(s.quickChat?.enabled ?? true);
            setQuickChatShortcut(s.quickChat?.shortcut ?? "Alt+Space");
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
        if (
            c &&
            isModelConfigEffectivelyVisible(c, visibilityMap)
        ) {
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

    const onDefaultQcShortcutClick = async () => {
        setQuickChatShortcut("Alt+Space");
        setQuickChatEnabled(true);
        const currentSettings = await settingsManager.get();
        await settingsManager.set({
            ...currentSettings,
            quickChat: {
                ...currentSettings.quickChat,
                shortcut: "Alt+Space",
                enabled: true,
            },
        });
    };

    const staleChatModelIds = useMemo(
        () =>
            (defaultChatModels ?? []).filter(
                (id) => !visibleModels.some((m) => m.id === id),
            ),
        [defaultChatModels, visibleModels],
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

    const providerGroups = useMemo(
        () => groupByProvider(visibleModels),
        [visibleModels],
    );

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h2 className="text-2xl font-semibold mb-2">Defaults</h2>
                <p className="text-muted-foreground text-sm">
                    Configure defaults applied when you create a new chat. These
                    are read once at creation time and do not change existing
                    chats.
                </p>
            </div>

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
                        {(profiles ?? []).map((p) => (
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
                            profile.
                        </p>
                        <Select
                            value={
                                defaultFallbackModelProfileId ?? NONE
                            }
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
                                {(modelProfiles ?? []).map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                        model in{" "}
                        <button
                            type="button"
                            className="underline hover:no-underline"
                            onClick={onOpenVisibleModels}
                        >
                            Visible Models
                        </button>
                        .
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

            <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <label className="font-semibold">Default Chat Models</label>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setDefaultChatModels(null);
                            void persist({ defaultChatModels: null });
                        }}
                    >
                        Clear
                    </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                    Optional explicit list: every new regular chat starts with
                    exactly these models (in order). When cleared, new chats
                    use{" "}
                    <span className="font-medium text-foreground/90">
                        Default Fallback Model
                    </span>{" "}
                    if set, otherwise your ⌘J multi-model list, then the first
                    visible model.
                </p>
                {staleChatModelIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                        Some saved defaults are no longer visible and will be
                        skipped.
                    </p>
                )}
                <div className="max-h-72 overflow-y-auto border rounded-md p-3 space-y-4">
                    {visibleModels.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No visible models. Configure them in{" "}
                            <button
                                type="button"
                                className="underline hover:no-underline"
                                onClick={onOpenVisibleModels}
                            >
                                Visible Models
                            </button>
                            .
                        </p>
                    ) : (
                        providerGroups.map(([provider, models]) => {
                            const label = PROVIDER_LABELS[provider] ?? provider;
                            return (
                                <div key={provider}>
                                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                                        {label}
                                    </div>
                                    <div className="pl-1 space-y-2">
                                        {models.map((m) => (
                                            <label
                                                key={m.id}
                                                className="flex items-start gap-2 text-sm cursor-pointer"
                                            >
                                                <Checkbox
                                                    className="mt-0.5"
                                                    checked={
                                                        defaultChatModels?.includes(
                                                            m.id,
                                                        ) ?? false
                                                    }
                                                    onCheckedChange={(
                                                        checked,
                                                    ) =>
                                                        toggleDefaultChatModel(
                                                            m.id,
                                                            !!checked,
                                                        )
                                                    }
                                                />
                                                <span>
                                                    <span className="font-medium">
                                                        {m.displayName}
                                                    </span>
                                                    <span className="text-muted-foreground text-xs block">
                                                        {formatCostSuffix(m)}
                                                    </span>
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <Separator />

            <div>
                <h3 className="text-lg font-semibold mb-3">Ambient Chat</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <label className="font-semibold">
                                Ambient Chat
                            </label>
                            <p className="text-sm text-muted-foreground">
                                Start an ambient chat with{" "}
                                <span className="font-mono">
                                    {quickChatShortcut}
                                </span>
                            </p>
                        </div>
                        <Switch
                            checked={quickChatEnabled}
                            onCheckedChange={(enabled) => {
                                setQuickChatEnabled(enabled);
                                void (async () => {
                                    const current = await settingsManager.get();
                                    await settingsManager.set({
                                        ...current,
                                        quickChat: {
                                            ...current.quickChat,
                                            enabled,
                                        },
                                    });
                                })();
                            }}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="font-semibold">
                            Keyboard Shortcut
                        </label>
                        <p className="text-sm text-muted-foreground">
                            Enter the shortcut you want to use to start an
                            ambient chat.
                        </p>
                        <ShortcutRecorder
                            value={quickChatShortcut}
                            onChange={(shortcut) => {
                                setQuickChatShortcut(shortcut);
                                void (async () => {
                                    const current = await settingsManager.get();
                                    await settingsManager.set({
                                        ...current,
                                        quickChat: {
                                            ...current.quickChat,
                                            shortcut,
                                        },
                                    });
                                })();
                            }}
                        />
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void onDefaultQcShortcutClick()}
                            >
                                Set to default
                            </Button>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                    if (!quickChatShortcut.trim()) {
                                        toast.error("Invalid shortcut", {
                                            description:
                                                "Shortcut cannot be empty",
                                        });
                                        return;
                                    }
                                    void relaunch().catch(console.error);
                                }}
                            >
                                Save and restart
                            </Button>
                        </div>
                    </div>

                    <Separator />

                    <AccessibilitySettings />
                </div>
            </div>
        </div>
    );
}
