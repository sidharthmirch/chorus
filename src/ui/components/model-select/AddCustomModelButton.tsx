import { PlusIcon } from "lucide-react";
import { cn } from "@ui/lib/utils";

/**
 * Dashed "add custom model" affordance — per the W4 brief, a first-class
 * row-vocabulary item on both surfaces (not gated on already having a
 * custom model, unlike the pre-rework `ManageModelsBox.tsx`'s "Custom"
 * group header button, which only appeared once >=1 custom model already
 * existed). Shared by `ModelSelectList`, `ModelSelectPopover`, and
 * `ModelSettingsRows` so all three read identically.
 */
export function AddCustomModelButton({
    onClick,
    className,
}: {
    onClick: () => void;
    className?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground",
                className,
            )}
        >
            <PlusIcon className="h-3.5 w-3.5" />
            Add custom model
        </button>
    );
}
