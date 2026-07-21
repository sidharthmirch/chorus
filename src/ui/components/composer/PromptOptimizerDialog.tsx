import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "../ui/dialog";
import { OPTIMIZE_PROMPT_DIALOG_ID } from "./OptimizeButton";

/**
 * Prompt Optimizer modal (design/prompt-optimizer.md). Mounted by
 * `ChatInput.tsx` alongside `OptimizeButton` (same dialog-id pairing
 * convention as `ManageModelsButtonCompare`/`ManageModelsBox`).
 *
 * P2 ships this as a presentable placeholder so the composer's optimize
 * button has something coherent to open; P5 replaces the body below with
 * the full Structured/Before-After views, intent radios, and model-set
 * presets per the design doc. The dialog id and mount point are stable —
 * P5 should not need to touch ChatInput.tsx's wiring, only this file's body
 * (and its own props, which will grow — e.g. the draft text, a callback to
 * apply the optimized result back into the composer, and the chat's current
 * model selection for the "curate for model set" section).
 */
export function PromptOptimizerDialog({ draft }: { draft: string }) {
    return (
        <Dialog id={OPTIMIZE_PROMPT_DIALOG_ID}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <span aria-hidden>✦</span> Optimize prompt
                    </DialogTitle>
                </DialogHeader>
                <div className="p-2 pt-0">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                        Your prompt · natural language ok
                    </div>
                    <div className="rounded-md bg-muted p-2.5 text-sm leading-[1.3] whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                        {draft.trim() || (
                            <span className="text-muted-foreground">
                                Type a draft in the composer, then reopen this
                                to optimize it.
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">
                        Structured rewriting (Just chat / Hand to agent / Plan
                        first) and model-set presets are on the way.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
