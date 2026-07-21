/**
 * Inline create/edit form for a `modes`/stance entity (Assist/Critic/
 * Socratic/...). Matches the existing inline-expand convention already
 * established by `ModelProfilesTab.tsx`/`PromptProfilesTab.tsx` in this same
 * Settings surface, rather than introducing a new floating-modal pattern —
 * design/settings.md's mock says "modal", read here as intent ("an editing
 * surface opens"), not the literal container.
 */
import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Check, X } from "lucide-react";
import type { IMode } from "@core/chorus/ChatState";

export interface ModeFormValues {
    name: string;
    description: string;
    prompt: string;
    icon: string;
}

export function ModeEditForm({
    mode,
    onSave,
    onCancel,
}: {
    mode?: IMode;
    onSave: (values: ModeFormValues) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState(mode?.name ?? "");
    const [description, setDescription] = useState(mode?.description ?? "");
    const [prompt, setPrompt] = useState(mode?.prompt ?? "");
    const [icon, setIcon] = useState(mode?.icon ?? "");

    const canSave = name.trim().length > 0 && prompt.trim().length > 0;

    return (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="flex gap-2">
                <Input
                    placeholder="Icon"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-20 flex-shrink-0"
                />
                <Input
                    placeholder="Mode name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-1"
                />
            </div>
            <Input
                placeholder="Short description — shown on the card"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
            />
            <Textarea
                placeholder="System prompt for this stance…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                className="resize-none font-mono text-sm"
            />
            <div className="flex gap-2">
                <Button
                    size="sm"
                    onClick={() =>
                        onSave({
                            name: name.trim(),
                            description: description.trim(),
                            prompt: prompt.trim(),
                            icon: icon.trim(),
                        })
                    }
                    disabled={!canSave}
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
