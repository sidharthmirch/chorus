import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "../ui/dialog";
import { useDialogStore } from "@core/infra/DialogStore";
import type { ModelConfig } from "@core/chorus/Models";
import { simpleLLM } from "@core/chorus/simpleLLM";
import {
    buildOptimizerPrompt,
    chooseModelSet,
    describeModelSet,
    wrapAsStructuredPrompt,
    OPTIMIZER_INTENTS,
    OPTIMIZER_MODEL_SETS,
    type OptimizerIntent,
    type OptimizerModelSet,
} from "@core/chorus/promptOptimizer";
import { OPTIMIZE_PROMPT_DIALOG_ID } from "./OptimizeButton";

// Debounce so we don't fire a completion call on every keystroke — the
// dialog re-optimizes automatically as the draft/intent/model-set/toggles
// change while it's open (design/prompt-optimizer.md has no separate
// "optimize" trigger inside the modal itself). Pre-authorized time-based UX
// use of setTimeout per .rework/ORCHESTRATION.md; see .rework/w6-PROGRESS.md
// Decisions log.
const AUTO_OPTIMIZE_DEBOUNCE_MS = 600;

/**
 * Prompt Optimizer modal (design/prompt-optimizer.md). Mounted by
 * `ChatInput.tsx` alongside `OptimizeButton`, same dialog-id pairing
 * convention as `ManageModelsButtonCompare`/`ManageModelsBox`.
 */
export function PromptOptimizerDialog({
    draft,
    visibleModelConfigs,
    currentSelection,
    onApply,
    onApplyModelSet,
}: {
    draft: string;
    visibleModelConfigs: ModelConfig[];
    currentSelection: ModelConfig[];
    onApply: (optimizedText: string) => void;
    onApplyModelSet: (modelConfigs: ModelConfig[]) => void;
}) {
    const isOpen = useDialogStore(
        (state) => state.activeDialogId === OPTIMIZE_PROMPT_DIALOG_ID,
    );

    const [view, setView] = useState<"structured" | "stacked">("structured");
    const [intent, setIntent] = useState<OptimizerIntent>("hand-to-agent");
    const [modelSet, setModelSet] = useState<OptimizerModelSet>("chat-trio");
    const [optOff, setOptOff] = useState<Record<string, boolean>>({});

    const [optimizedProse, setOptimizedProse] = useState<string | undefined>(
        undefined,
    );
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizeError, setOptimizeError] = useState<string | undefined>(
        undefined,
    );

    const candidateModels = useMemo(
        () => chooseModelSet(modelSet, visibleModelConfigs, currentSelection),
        [modelSet, visibleModelConfigs, currentSelection],
    );
    const activeModels = candidateModels.filter((m) => !optOff[m.id]);

    // Reset per-model toggles whenever the candidate set itself changes
    // (new model set chosen, or the catalog/selection it's derived from
    // changed) so a stale toggle from a previous set can't silently hide a
    // model in the new one.
    useEffect(() => {
        setOptOff({});
    }, [modelSet, visibleModelConfigs, currentSelection]);

    useEffect(() => {
        if (!isOpen) return;
        if (!draft.trim()) {
            setOptimizedProse(undefined);
            setOptimizeError(undefined);
            return;
        }

        const timeoutId = setTimeout(() => {
            setIsOptimizing(true);
            setOptimizeError(undefined);
            const prompt = buildOptimizerPrompt(
                draft,
                intent,
                activeModels.map((m) => m.displayName),
            );
            simpleLLM(prompt, { maxTokens: 700 })
                .then((result) => {
                    setOptimizedProse(result.trim());
                })
                .catch((error: unknown) => {
                    console.error("Prompt optimization failed", error);
                    setOptimizeError(
                        error instanceof Error
                            ? error.message
                            : "Could not optimize the prompt.",
                    );
                })
                .finally(() => {
                    setIsOptimizing(false);
                });
        }, AUTO_OPTIMIZE_DEBOUNCE_MS);

        return () => clearTimeout(timeoutId);
        // activeModels is derived from candidateModels/optOff each render;
        // comparing by id list keeps this from re-firing on unrelated
        // re-renders where the array reference changes but membership hasn't.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, draft, intent, activeModels.map((m) => m.id).join(",")]);

    const structuredText = optimizedProse
        ? wrapAsStructuredPrompt(optimizedProse, intent)
        : undefined;
    const displayedOptimizedText =
        view === "structured" ? structuredText : optimizedProse;

    const handleCopy = () => {
        if (!displayedOptimizedText) return;
        void navigator.clipboard.writeText(displayedOptimizedText).then(() => {
            toast.success("Copied to clipboard");
        });
    };

    const handleUse = () => {
        if (!displayedOptimizedText) return;
        onApply(displayedOptimizedText);
        if (activeModels.length > 0) {
            onApplyModelSet(activeModels);
        }
    };

    return (
        <Dialog id={OPTIMIZE_PROMPT_DIALOG_ID}>
            <DialogContent className="max-w-[1000px] w-[92vw]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <span aria-hidden>✦</span> Optimize prompt
                    </DialogTitle>
                </DialogHeader>
                <div className="flex justify-end px-2">
                    <div className="flex items-center rounded-full bg-muted p-0.5 gap-0.5">
                        {(
                            [
                                { value: "structured", label: "Structured" },
                                { value: "stacked", label: "Before / After" },
                            ] as const
                        ).map((tab) => (
                            <button
                                key={tab.value}
                                type="button"
                                onClick={() => setView(tab.value)}
                                className={`h-6 rounded-full px-2.5 text-xs transition-colors ${
                                    view === tab.value
                                        ? "bg-foreground text-background"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 p-2 pt-1 max-h-[400px] overflow-y-auto">
                    {/* Input panel */}
                    <div className="md:w-[42%] flex-shrink-0 space-y-4">
                        <div>
                            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                                Your prompt · natural language ok
                            </div>
                            <div className="rounded-md bg-muted p-2.5 text-sm leading-[1.3] whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                                {draft.trim() || (
                                    <span className="text-muted-foreground">
                                        Type a draft in the composer to
                                        optimize it.
                                    </span>
                                )}
                            </div>
                        </div>

                        <div>
                            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                                Intent
                            </div>
                            <div className="space-y-1.5">
                                {OPTIMIZER_INTENTS.map((option) => (
                                    <label
                                        key={option.value}
                                        className="flex items-start gap-2 cursor-pointer group"
                                    >
                                        <input
                                            type="radio"
                                            name="optimizer-intent"
                                            className="mt-0.5 accent-foreground"
                                            checked={intent === option.value}
                                            onChange={() =>
                                                setIntent(option.value)
                                            }
                                        />
                                        <span className="text-sm">
                                            <span
                                                className={
                                                    intent === option.value
                                                        ? "font-medium"
                                                        : ""
                                                }
                                            >
                                                {option.label}
                                            </span>{" "}
                                            <span className="text-muted-foreground text-xs">
                                                ({option.description})
                                            </span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                                Curate for · model set
                            </div>
                            <div className="flex gap-1.5 flex-wrap mb-2">
                                {OPTIMIZER_MODEL_SETS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() =>
                                            setModelSet(option.value)
                                        }
                                        className={`rounded-full px-3 py-1 text-[11.5px] border transition-colors ${
                                            modelSet === option.value
                                                ? "bg-highlight text-highlight-foreground border-accent-600"
                                                : "border-border text-muted-foreground hover:border-accent-600"
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                            {candidateModels.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {candidateModels.map((model) => {
                                        const isOff = !!optOff[model.id];
                                        return (
                                            <button
                                                key={model.id}
                                                type="button"
                                                onClick={() =>
                                                    setOptOff((prev) => ({
                                                        ...prev,
                                                        [model.id]: !prev[
                                                            model.id
                                                        ],
                                                    }))
                                                }
                                                aria-pressed={!isOff}
                                                title={model.displayName}
                                                className={`text-[11px] rounded-full border px-2.5 py-1 transition-opacity ${
                                                    isOff
                                                        ? "opacity-60 border-border text-muted-foreground"
                                                        : "border-accent-600 text-foreground"
                                                }`}
                                            >
                                                {model.displayName}
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    No models available to curate for yet.
                                </p>
                            )}
                            <p className="text-[10.5px] text-muted-foreground mt-2">
                                Output style adapts: XML sections for Claude,
                                markdown headers for GPT, terse bullets for
                                Gemini.
                            </p>
                        </div>
                    </div>

                    {/* Output panel */}
                    <div className="md:w-[58%] flex flex-col min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                                Optimized ·{" "}
                                {describeModelSet(modelSet, activeModels)}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    disabled={!displayedOptimizedText}
                                    className="text-xs border border-border rounded-md px-2 py-1 hover:bg-muted disabled:opacity-40"
                                >
                                    ⧉ copy
                                </button>
                                <button
                                    type="button"
                                    onClick={handleUse}
                                    disabled={!displayedOptimizedText}
                                    className="text-xs bg-foreground text-background rounded-md px-2.5 py-1 hover:opacity-90 disabled:opacity-40"
                                >
                                    use ↵
                                </button>
                            </div>
                        </div>

                        {isOptimizing && !optimizedProse ? (
                            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground py-8">
                                Optimizing…
                            </div>
                        ) : optimizeError ? (
                            <div className="text-sm text-destructive py-4">
                                {optimizeError}
                            </div>
                        ) : !displayedOptimizedText ? (
                            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground py-8">
                                Type a draft in the composer to see an
                                optimized version here.
                            </div>
                        ) : view === "structured" ? (
                            <pre className="rounded-lg bg-muted p-3.5 text-[11.5px] leading-[1.7] font-mono whitespace-pre-wrap break-words overflow-auto flex-1">
                                {structuredText}
                            </pre>
                        ) : (
                            <div className="space-y-2 flex-1 overflow-auto">
                                <div>
                                    <div className="text-[9.5px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                                        before
                                    </div>
                                    <div className="rounded-md bg-muted p-2.5 text-[12.5px] leading-[1.4] whitespace-pre-wrap break-words">
                                        {draft}
                                    </div>
                                </div>
                                <div className="text-center text-muted-foreground text-sm py-1">
                                    ↓ ✦
                                </div>
                                <div>
                                    <div className="text-[9.5px] font-mono uppercase tracking-wider text-accent-600 mb-1">
                                        after · curated
                                    </div>
                                    <div className="rounded-md border border-accent-600 p-2.5 text-[12.5px] leading-[1.4] whitespace-pre-wrap break-words">
                                        {optimizedProse}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
