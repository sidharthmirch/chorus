import { useState } from "react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@ui/components/ui/collapsible";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Separator } from "../../ui/separator";
import {
    useModes,
    useCreateMode,
    useUpdateMode,
    useDeleteMode,
} from "@core/chorus/api/ModesAPI";
import type { IMode } from "@core/chorus/ChatState";
import { ModeEditForm, type ModeFormValues } from "../ModeEditForm";
import { PromptProfilesTab } from "../PromptProfilesTab";
import { UniversalSystemPromptPanel } from "../UniversalSystemPromptPanel";

const TAG_LABEL: Record<IMode["tag"], string> = {
    "app-default": "App default",
    "per-chat": "Per-chat",
    custom: "Custom",
};

function ModeCard({
    mode,
    onEdit,
    onDelete,
}: {
    mode: IMode;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <div className="flex min-h-[160px] flex-col gap-2 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    {mode.icon && (
                        <span className="text-base shrink-0">{mode.icon}</span>
                    )}
                    <span className="font-medium truncate">{mode.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="iconSm" onClick={onEdit}>
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {mode.author === "user" && (
                        <Button variant="ghost" size="iconSm" onClick={onDelete}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                    )}
                </div>
            </div>

            {mode.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                    {mode.description}
                </p>
            )}

            <div className="flex-1 overflow-hidden rounded-md bg-muted p-2">
                <p className="font-mono text-[11px] leading-snug text-muted-foreground line-clamp-3">
                    {mode.prompt}
                </p>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Used {mode.usageCount} times</span>
                <span className="rounded-full bg-muted px-2 py-0.5">
                    {TAG_LABEL[mode.tag]}
                </span>
            </div>
        </div>
    );
}

export function ModesSection() {
    const { data: modes, isLoading } = useModes();
    const createMode = useCreateMode();
    const updateMode = useUpdateMode();
    const deleteMode = useDeleteMode();

    const [editingId, setEditingId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);

    const editingMode = modes?.find((m) => m.id === editingId);

    const handleSaveNew = (values: ModeFormValues) => {
        createMode.mutate(values);
        setIsCreating(false);
    };

    const handleSaveEdit = (id: string, values: ModeFormValues) => {
        updateMode.mutate({ id, ...values });
        setEditingId(null);
    };

    return (
        <div className="space-y-8 max-w-2xl">
            <div>
                <h2 className="text-2xl font-semibold mb-2">Modes</h2>
                <p className="text-sm text-muted-foreground">
                    Manage message stances and system prompts.
                </p>
            </div>

            {isLoading ? (
                <p className="text-sm text-muted-foreground">
                    Loading modes…
                </p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {modes?.map((mode) =>
                        editingId === mode.id ? (
                            <div key={mode.id} className="sm:col-span-2">
                                <ModeEditForm
                                    mode={mode}
                                    onSave={(values) =>
                                        handleSaveEdit(mode.id, values)
                                    }
                                    onCancel={() => setEditingId(null)}
                                />
                            </div>
                        ) : (
                            <ModeCard
                                key={mode.id}
                                mode={mode}
                                onEdit={() => {
                                    setEditingId(mode.id);
                                    setIsCreating(false);
                                }}
                                onDelete={() => deleteMode.mutate({ id: mode.id })}
                            />
                        ),
                    )}

                    {isCreating ? (
                        <div className="sm:col-span-2">
                            <ModeEditForm
                                onSave={handleSaveNew}
                                onCancel={() => setIsCreating(false)}
                            />
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => {
                                setIsCreating(true);
                                setEditingId(null);
                            }}
                            className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                            <Plus className="h-5 w-5" />
                            Create mode…
                        </button>
                    )}
                </div>
            )}

            {!editingMode && (
                <>
                    <Separator />

                    <Collapsible
                        open={advancedOpen}
                        onOpenChange={setAdvancedOpen}
                    >
                        <CollapsibleTrigger className="flex items-center w-full gap-2 hover:opacity-80">
                            <span className="text-xs font-geist-mono uppercase tracking-wider text-muted-foreground">
                                Advanced
                            </span>
                            <ChevronDown
                                className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                                    advancedOpen ? "rotate-180" : ""
                                }`}
                            />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-10 pt-6">
                            <div>
                                <h3 className="text-lg font-semibold mb-3">
                                    Universal system prompt
                                </h3>
                                <UniversalSystemPromptPanel />
                            </div>

                            <Separator />

                            <PromptProfilesTab />
                        </CollapsibleContent>
                    </Collapsible>
                </>
            )}
        </div>
    );
}
