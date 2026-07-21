import { useMemo } from "react";
import {
    DragDropContext,
    Draggable,
    DraggableProvided,
    DraggableStateSnapshot,
    Droppable,
    DropResult,
} from "@hello-pangea/dnd";
import { ModelConfig } from "@core/chorus/Models";
import { ProviderLogo } from "@ui/components/ui/provider-logo";
import { cn } from "@ui/lib/utils";

/**
 * The composer popover's right-hand "Selected" panel (design/model-select.md
 * + design/composer.md). Index 0 renders as "main", the rest as "hidden" —
 * a **cosmetic, order-derived label only**: W6's Focus/Fused view modes
 * (00-ARCHITECTURE.md §5) are what will eventually make that distinction
 * functional; W4 runs before W6 in the merge order, so this deliberately
 * doesn't claim any new backend behavior (docs/rework/w4-model-select-inventory.md §3).
 */

function siblingVariants(
    modelConfig: ModelConfig,
    allModelConfigs: ModelConfig[],
): ModelConfig[] {
    return allModelConfigs.filter(
        (m) =>
            m.id !== modelConfig.id &&
            m.modelId === modelConfig.modelId &&
            m.author === modelConfig.author,
    );
}

function SelectedCard({
    modelConfig,
    isMain,
    isDragging = false,
    allModelConfigs,
    onOpenProfile,
}: {
    modelConfig: ModelConfig;
    isMain: boolean;
    isDragging?: boolean;
    allModelConfigs: ModelConfig[];
    onOpenProfile?: (modelConfigId: string) => void;
}) {
    // "Profile" here is a variant switcher across sibling model_configs that
    // share a base model (e.g. a "thinking" variant) — reinterpreted from
    // the design mock's literal "default · t0.7" copy, which implies a
    // `temperature` field `model_configs` doesn't have and this rework keeps
    // frozen (inventory §3). Hidden entirely when there's no sibling to
    // switch to, which is the common case.
    const siblings = useMemo(
        () => siblingVariants(modelConfig, allModelConfigs),
        [modelConfig, allModelConfigs],
    );

    return (
        <div
            className={cn(
                "flex flex-col gap-2 rounded-lg border bg-card p-2.5",
                isMain ? "border-highlight" : "border-border",
                isDragging && "opacity-75 shadow-diffuse",
            )}
        >
            <div className="flex items-center gap-2">
                <ProviderLogo modelId={modelConfig.modelId} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {modelConfig.displayName}
                </span>
                <span
                    className={cn(
                        "shrink-0 font-geist-mono text-[10px] uppercase tracking-wider",
                        isMain ? "text-highlight-foreground" : "text-helper",
                    )}
                >
                    {isMain ? "main" : "hidden"}
                </span>
            </div>

            {siblings.length > 0 && (
                <div className="flex items-center gap-1.5">
                    <span className="font-geist-mono text-[10px] uppercase tracking-wider text-helper">
                        profile
                    </span>
                    <button
                        type="button"
                        onClick={() => onOpenProfile?.(modelConfig.id)}
                        className="truncate rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground transition-colors hover:bg-muted/70"
                        title="Manage variants in Settings › Models"
                    >
                        {modelConfig.displayName}
                    </button>
                </div>
            )}
        </div>
    );
}

export interface SelectedPreviewPanelProps {
    selectedModelConfigs: ModelConfig[];
    allModelConfigs: ModelConfig[];
    onOpenProfile?: (modelConfigId: string) => void;
    /** Drag-reorder the selection (ported from ManageModelsBox.tsx's pill
     *  strip — inventory §2). Omit to render a static, non-draggable list. */
    onReorder?: (modelConfigs: ModelConfig[]) => void;
    className?: string;
}

export function SelectedPreviewPanel({
    selectedModelConfigs,
    allModelConfigs,
    onOpenProfile,
    onReorder,
    className,
}: SelectedPreviewPanelProps) {
    function handleDragEnd(result: DropResult) {
        if (!result.destination || !onReorder) return;
        const items = [...selectedModelConfigs];
        const [moved] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, moved);
        onReorder(items);
    }

    const emptyState = (
        <p className="px-1 py-4 text-center text-sm text-muted-foreground">
            No models selected yet.
        </p>
    );

    return (
        <div className={cn("flex h-full flex-col", className)}>
            <div className="px-3 py-2 font-geist-mono text-[10px] uppercase tracking-wider text-helper">
                Selected · {selectedModelConfigs.length}{" "}
                {selectedModelConfigs.length === 1 ? "model" : "models"}
            </div>
            {onReorder ? (
                <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="selected-preview-panel">
                        {(droppableProvided) => (
                            <div
                                ref={droppableProvided.innerRef}
                                {...droppableProvided.droppableProps}
                                className="flex-1 space-y-2 overflow-y-auto px-3 pb-2"
                            >
                                {selectedModelConfigs.length === 0 && emptyState}
                                {selectedModelConfigs.map((modelConfig, index) => (
                                    <Draggable
                                        key={modelConfig.id}
                                        draggableId={modelConfig.id}
                                        index={index}
                                    >
                                        {(
                                            draggableProvided: DraggableProvided,
                                            snapshot: DraggableStateSnapshot,
                                        ) => (
                                            <div
                                                ref={draggableProvided.innerRef}
                                                {...draggableProvided.draggableProps}
                                                {...draggableProvided.dragHandleProps}
                                            >
                                                <SelectedCard
                                                    modelConfig={modelConfig}
                                                    isMain={index === 0}
                                                    isDragging={snapshot.isDragging}
                                                    allModelConfigs={allModelConfigs}
                                                    onOpenProfile={onOpenProfile}
                                                />
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {droppableProvided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            ) : (
                <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-2">
                    {selectedModelConfigs.length === 0 && emptyState}
                    {selectedModelConfigs.map((modelConfig, index) => (
                        <SelectedCard
                            key={modelConfig.id}
                            modelConfig={modelConfig}
                            isMain={index === 0}
                            allModelConfigs={allModelConfigs}
                            onOpenProfile={onOpenProfile}
                        />
                    ))}
                </div>
            )}
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                First model is main; the rest answer hidden and fuse on demand.
                Profiles come from Settings › Models.
            </p>
        </div>
    );
}
