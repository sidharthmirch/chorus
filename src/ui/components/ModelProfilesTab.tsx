import { useState } from "react";
import { Button } from "./ui/button";
import {
    useModelProfiles,
    useCreateModelProfile,
    useUpdateModelProfile,
    useDeleteModelProfile,
} from "@core/chorus/api/ModelProfilesAPI";
import { useModelConfigs } from "@core/chorus/api/ModelsAPI";
import { useProviderVisibilityMap } from "@core/chorus/api/ProviderVisibilityAPI";
import { getFilteredModelConfigs } from "@core/utilities/ModelFiltering";
import {
    ModelConfig,
    getProviderName,
    ModelProfile,
} from "@core/chorus/Models";
import { Loader2, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { Input } from "./ui/input";
import { Checkbox } from "@ui/components/ui/checkbox";

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

function ModelChecklist({
    visibleModels,
    selectedIds,
    onChange,
}: {
    visibleModels: ModelConfig[];
    selectedIds: string[];
    onChange: (ids: string[]) => void;
}) {
    const providerGroups = groupByProvider(visibleModels);

    const toggleOne = (id: string, checked: boolean) => {
        onChange(
            checked
                ? [...selectedIds, id]
                : selectedIds.filter((x) => x !== id),
        );
    };

    const toggleAll = (models: ModelConfig[], checked: boolean) => {
        const ids = models.map((m) => m.id);
        if (checked) {
            onChange(Array.from(new Set([...selectedIds, ...ids])));
        } else {
            const idSet = new Set(ids);
            onChange(selectedIds.filter((id) => !idSet.has(id)));
        }
    };

    if (visibleModels.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                No visible models available. Go to "Visible Models" to enable
                models first.
            </p>
        );
    }

    return (
        <div className="max-h-72 overflow-y-auto space-y-4">
            {providerGroups.map(([provider, models]) => {
                const allSelected = models.every((m) =>
                    selectedIds.includes(m.id),
                );
                const someSelected = models.some((m) =>
                    selectedIds.includes(m.id),
                );
                const label = PROVIDER_LABELS[provider] ?? provider;

                return (
                    <div key={provider}>
                        <div className="flex items-center gap-2 mb-1.5">
                            <Checkbox
                                checked={allSelected}
                                data-state={
                                    someSelected && !allSelected
                                        ? "indeterminate"
                                        : undefined
                                }
                                onCheckedChange={(checked) =>
                                    toggleAll(models, !!checked)
                                }
                            />
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {label}
                            </span>
                        </div>
                        <div className="pl-6 space-y-1">
                            {models.map((m) => (
                                <div
                                    key={m.id}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <Checkbox
                                        checked={selectedIds.includes(m.id)}
                                        onCheckedChange={(checked) =>
                                            toggleOne(m.id, !!checked)
                                        }
                                    />
                                    {m.displayName}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function EditProfileForm({
    profile,
    visibleModels,
    onSave,
    onCancel,
}: {
    profile: ModelProfile;
    visibleModels: ModelConfig[];
    onSave: (name: string, modelConfigIds: string[]) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState(profile.name);
    const [selectedIds, setSelectedIds] = useState<string[]>(
        profile.modelConfigIds,
    );

    return (
        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <Input
                placeholder="Profile Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
            />
            <ModelChecklist
                visibleModels={visibleModels}
                selectedIds={selectedIds}
                onChange={setSelectedIds}
            />
            <div className="flex gap-2">
                <Button
                    size="sm"
                    onClick={() => onSave(name, selectedIds)}
                    disabled={!name || selectedIds.length === 0}
                >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Save
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancel}>
                    <X className="w-3.5 h-3.5 mr-1" />
                    Cancel
                </Button>
            </div>
        </div>
    );
}

export function ModelProfilesTab() {
    const { data: profiles, isLoading } = useModelProfiles();
    const { data: allModels } = useModelConfigs();
    const providerVisibilityMap = useProviderVisibilityMap();
    const createProfile = useCreateModelProfile();
    const updateProfile = useUpdateModelProfile();
    const deleteProfile = useDeleteModelProfile();

    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [newSelectedModels, setNewSelectedModels] = useState<string[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);

    if (isLoading || !allModels) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const visibleModels = getFilteredModelConfigs(
        allModels,
        providerVisibilityMap,
        null,
    );

    const handleCreate = () => {
        createProfile.mutate({
            id: uuidv4(),
            name: newName,
            modelConfigIds: newSelectedModels,
        });
        setIsCreating(false);
        setNewName("");
        setNewSelectedModels([]);
    };

    const handleUpdate = (
        id: string,
        name: string,
        modelConfigIds: string[],
    ) => {
        updateProfile.mutate({ id, name, modelConfigIds });
        setEditingId(null);
    };

    return (
        <div className="space-y-8 max-w-2xl">
            <div>
                <h2 className="text-2xl font-semibold mb-2">Model Profiles</h2>
                <p className="text-sm text-muted-foreground">
                    Create named sets of models to quickly switch between them
                    in chat. Profiles draw from your visible models — configure
                    which models are visible in the "Visible Models" tab.
                </p>
            </div>

            <Button
                onClick={() => {
                    setIsCreating(true);
                    setEditingId(null);
                }}
                disabled={isCreating}
            >
                <Plus className="w-4 h-4 mr-2" />
                Create New Profile
            </Button>

            {isCreating && (
                <div className="border rounded-lg p-4 space-y-4">
                    <Input
                        placeholder="Profile Name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                    />
                    <ModelChecklist
                        visibleModels={visibleModels}
                        selectedIds={newSelectedModels}
                        onChange={setNewSelectedModels}
                    />
                    <div className="flex gap-2">
                        <Button
                            onClick={handleCreate}
                            disabled={
                                !newName || newSelectedModels.length === 0
                            }
                        >
                            Save
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setIsCreating(false);
                                setNewName("");
                                setNewSelectedModels([]);
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {profiles?.map((p) =>
                    editingId === p.id ? (
                        <EditProfileForm
                            key={p.id}
                            profile={p}
                            visibleModels={visibleModels}
                            onSave={(name, ids) =>
                                handleUpdate(p.id, name, ids)
                            }
                            onCancel={() => setEditingId(null)}
                        />
                    ) : (
                        <div
                            key={p.id}
                            className="border rounded-lg p-4 flex items-center justify-between"
                        >
                            <div>
                                <h3 className="font-semibold">{p.name}</h3>
                                <p className="text-xs text-muted-foreground">
                                    {p.modelConfigIds.length} models
                                </p>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setEditingId(p.id);
                                        setIsCreating(false);
                                    }}
                                >
                                    <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        deleteProfile.mutate({ id: p.id })
                                    }
                                >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                            </div>
                        </div>
                    ),
                )}
            </div>
        </div>
    );
}
