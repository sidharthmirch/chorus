import { SparklesIcon } from "lucide-react";
import { dialogActions, useDialogStore } from "@core/infra/DialogStore";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

/**
 * Dialog id shared between this trigger and `PromptOptimizerDialog` (mounted
 * separately by `ChatInput.tsx`, same pairing convention as
 * `ManageModelsButtonCompare` + `ManageModelsBox`) — P5 fills in the dialog's
 * real content; this button's toggle/highlight behavior does not change.
 */
export const OPTIMIZE_PROMPT_DIALOG_ID = "optimize-prompt-dialog";

/**
 * Composer "Optimize ✦" button (design/composer.md). Visual states: muted
 * when closed, bordered + highlight-filled while its dialog is open.
 */
export function OptimizeButton() {
    const isOpen = useDialogStore(
        (state) => state.activeDialogId === OPTIMIZE_PROMPT_DIALOG_ID,
    );

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    aria-pressed={isOpen}
                    onClick={() => {
                        if (isOpen) {
                            dialogActions.closeDialog(OPTIMIZE_PROMPT_DIALOG_ID);
                        } else {
                            dialogActions.openDialog(OPTIMIZE_PROMPT_DIALOG_ID);
                        }
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full h-7 px-3 text-sm flex-shrink-0 border transition-colors ${
                        isOpen
                            ? "border-accent-600 bg-highlight text-highlight-foreground"
                            : "border-transparent text-muted-foreground hover:bg-muted"
                    }`}
                >
                    <SparklesIcon className="w-3.5 h-3.5" />
                    Optimize
                </button>
            </TooltipTrigger>
            <TooltipContent>Optimize prompt</TooltipContent>
        </Tooltip>
    );
}
