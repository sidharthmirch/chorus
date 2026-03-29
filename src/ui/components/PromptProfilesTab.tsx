import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
    usePromptProfiles,
    useCreatePromptProfile,
    useUpdatePromptProfile,
    useDeletePromptProfile,
} from "@core/chorus/api/PromptProfilesAPI";
import { PromptProfile } from "@core/chorus/Models";
import { Loader2, Plus, Trash2, Pencil, Check, X } from "lucide-react";

function EditProfileForm({
    profile,
    onSave,
    onCancel,
}: {
    profile: PromptProfile;
    onSave: (name: string, systemPrompt: string, icon: string) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState(profile.name);
    const [systemPrompt, setSystemPrompt] = useState(profile.systemPrompt);
    const [icon, setIcon] = useState(profile.icon ?? "");

    return (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="flex gap-2">
                <Input
                    placeholder="Icon (emoji)"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-24 flex-shrink-0"
                />
                <Input
                    placeholder="Profile name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-1"
                />
            </div>
            <Textarea
                placeholder="System prompt — describe the persona or role..."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={5}
                className="resize-none"
            />
            <div className="flex gap-2">
                <Button
                    size="sm"
                    onClick={() => onSave(name, systemPrompt, icon)}
                    disabled={!name.trim() || !systemPrompt.trim()}
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

export function PromptProfilesTab() {
    const { data: profiles, isLoading } = usePromptProfiles();
    const createProfile = useCreatePromptProfile();
    const updateProfile = useUpdatePromptProfile();
    const deleteProfile = useDeletePromptProfile();

    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [newSystemPrompt, setNewSystemPrompt] = useState("");
    const [newIcon, setNewIcon] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const handleCreate = () => {
        createProfile.mutate({
            name: newName,
            systemPrompt: newSystemPrompt,
            icon: newIcon || undefined,
        });
        setIsCreating(false);
        setNewName("");
        setNewSystemPrompt("");
        setNewIcon("");
    };

    const handleUpdate = (
        id: string,
        name: string,
        systemPrompt: string,
        icon: string
    ) => {
        updateProfile.mutate({ id, name, systemPrompt, icon: icon || undefined });
        setEditingId(null);
    };

    return (
        <div className="space-y-8 max-w-2xl">
            <div>
                <h2 className="text-2xl font-semibold mb-2">Prompt Profiles</h2>
                <p className="text-sm text-muted-foreground">
                    Prompt profiles inject a persona or role into your chats. Select
                    a profile from the chat input toolbar to activate it.
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
                <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Icon (emoji)"
                            value={newIcon}
                            onChange={(e) => setNewIcon(e.target.value)}
                            className="w-24 flex-shrink-0"
                        />
                        <Input
                            placeholder="Profile name"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="flex-1"
                        />
                    </div>
                    <Textarea
                        placeholder="System prompt — describe the persona or role..."
                        value={newSystemPrompt}
                        onChange={(e) => setNewSystemPrompt(e.target.value)}
                        rows={5}
                        className="resize-none"
                    />
                    <div className="flex gap-2">
                        <Button
                            onClick={handleCreate}
                            disabled={!newName.trim() || !newSystemPrompt.trim()}
                        >
                            Save
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setIsCreating(false);
                                setNewName("");
                                setNewSystemPrompt("");
                                setNewIcon("");
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
                            onSave={(name, systemPrompt, icon) =>
                                handleUpdate(p.id, name, systemPrompt, icon)
                            }
                            onCancel={() => setEditingId(null)}
                        />
                    ) : (
                        <div
                            key={p.id}
                            className="border rounded-lg p-4 flex items-start justify-between gap-4"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    {p.icon && (
                                        <span className="text-base">{p.icon}</span>
                                    )}
                                    <h3 className="font-semibold">{p.name}</h3>
                                    {p.author === "system" && (
                                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                            Built-in
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    {p.systemPrompt}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
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
                    )
                )}
            </div>
        </div>
    );
}
