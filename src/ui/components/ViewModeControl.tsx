import type { ViewMode } from "@core/chorus/ChatState";

const VIEW_MODE_OPTIONS: { value: ViewMode; label: string }[] = [
    { value: "focus", label: "Focus" },
    { value: "columns", label: "Columns" },
    { value: "fused", label: "⚭ Fused" },
];

/**
 * Focus / Columns / Fused segmented control for the chat header
 * (design/chat.md). Pill-shaped, active option = inverted-ink per
 * DESIGN.md's segmented-control spec. Purely a presentation switch — see
 * docs/rework/w6-chat-recon.md §5/§6 for why this never changes how many
 * models actually answer, only how their answers get laid out.
 */
export function ViewModeControl({
    value,
    onChange,
}: {
    value: ViewMode;
    onChange: (viewMode: ViewMode) => void;
}) {
    return (
        <div
            className="flex items-center h-7 rounded-full bg-muted p-0.5 gap-0.5"
            role="tablist"
            aria-label="View mode"
        >
            {VIEW_MODE_OPTIONS.map((option) => {
                const isActive = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onChange(option.value)}
                        className={`h-6 rounded-full px-2.5 text-xs transition-colors ${
                            isActive
                                ? "bg-foreground text-background"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
