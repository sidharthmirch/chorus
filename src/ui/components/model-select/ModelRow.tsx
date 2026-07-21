import { useCallback } from "react";
import {
    CheckIcon,
    FileIcon,
    FileTextIcon,
    GlobeIcon,
    ImageIcon,
    PencilIcon,
    StarIcon,
    Trash2Icon,
} from "lucide-react";
import { AttachmentType, ModelConfig } from "@core/chorus/Models";
import { useModelViaInfo } from "@core/chorus/api/ModelAccountAPI";
import { CommandItem } from "@ui/components/ui/command";
import { Checkbox } from "@ui/components/ui/checkbox";
import { Switch } from "@ui/components/ui/switch";
import { Badge } from "@ui/components/ui/badge";
import { Button } from "@ui/components/ui/button";
import { ProviderLogo } from "@ui/components/ui/provider-logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui/components/ui/tooltip";
import { QuotaBar } from "@ui/components/accounts/QuotaBar";
import { cn } from "@ui/lib/utils";
import { ModelRowAffordances, ModelRowDisabledReason } from "./types";

const CAPABILITY_ICON: Record<
    AttachmentType,
    { Icon: typeof ImageIcon; label: string }
> = {
    image: { Icon: ImageIcon, label: "Images" },
    pdf: { Icon: FileIcon, label: "PDF" },
    text: { Icon: FileTextIcon, label: "Text files" },
    webpage: { Icon: GlobeIcon, label: "Web pages" },
};

/** Narrow 58px quota slot per design/model-select.md — numeric bar when W1
 *  has live data, otherwise the textual fallback ("pay/use"/"local"/"no key"). */
function QuotaSlot({
    quota,
    quotaText,
}: {
    quota: ReturnType<typeof useModelViaInfo>["quota"];
    quotaText: string | undefined;
}) {
    if (quota) {
        return <QuotaBar quota={quota} className="w-[58px]" />;
    }
    if (quotaText) {
        return (
            <span className="w-[58px] truncate text-right font-geist-mono text-xs text-helper">
                {quotaText}
            </span>
        );
    }
    return null;
}

export interface ModelRowProps {
    modelConfig: ModelConfig;
    affordances: ModelRowAffordances;
    checked?: boolean;
    pinned?: boolean;
    visible?: boolean;
    disabledReason?: ModelRowDisabledReason;
    isNew?: boolean;
    pricingLabel?: string;
    onToggle?: () => void;
    onAddApiKey?: () => void;
    onTogglePinned?: () => void;
    onToggleVisible?: (visible: boolean) => void;
    onEdit?: () => void;
    onDelete?: () => void;
    /** cmdk identity within the enclosing `<Command>` — must be unique across the whole list. */
    commandValue: string;
    className?: string;
}

/**
 * The one model-row component shared by the composer popover catalog, the
 * add/single lists, quick chat, and the Settings rows W3 will mount —
 * differences between surfaces are expressed via `affordances`, not forks.
 * Full DESIGN.md state set: hover/focus (cmdk data-[selected]), selected
 * (highlight tokens — Quiet Accent Rule), disabled (locked/model-disabled),
 * loading is the caller's concern (skeleton rows), empty is the caller's
 * concern (CommandEmpty).
 */
export function ModelRow({
    modelConfig,
    affordances,
    checked = false,
    pinned = false,
    visible = true,
    disabledReason,
    isNew = false,
    pricingLabel,
    onToggle,
    onAddApiKey,
    onTogglePinned,
    onToggleVisible,
    onEdit,
    onDelete,
    commandValue,
    className,
}: ModelRowProps) {
    const via = useModelViaInfo(modelConfig);
    const isLocked = disabledReason === "no-api-key";
    const isModelDisabled = disabledReason === "model-disabled";

    const handleSelect = useCallback(() => {
        if (isLocked) {
            onAddApiKey?.();
            return;
        }
        onToggle?.();
    }, [isLocked, onAddApiKey, onToggle]);

    return (
        <CommandItem
            value={commandValue}
            onSelect={handleSelect}
            disabled={isModelDisabled}
            className={cn(
                "group items-start gap-3 py-2",
                isLocked && "opacity-60",
                // Quiet Accent Rule: selection is exactly what the highlight
                // tokens are for — a subtle wash so it reads at a glance
                // without competing with cmdk's own keyboard-hover state
                // (data-[selected=true], from command.tsx's base CommandItem
                // styles) when both are true at once.
                checked && "data-[selected=false]:bg-highlight/40",
                className,
            )}
        >
            {affordances.checkbox && (
                <Checkbox
                    checked={checked}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={() => handleSelect()}
                    aria-label={`Select ${modelConfig.displayName}`}
                    className="mt-0.5 shrink-0 data-[state=checked]:border-highlight data-[state=checked]:bg-highlight data-[state=checked]:text-highlight-foreground"
                />
            )}

            <ProviderLogo
                modelId={modelConfig.modelId}
                size="sm"
                className="mt-0.5 shrink-0"
            />

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm text-foreground">
                        {modelConfig.displayName}
                    </span>
                    {isNew && (
                        <Badge
                            variant="secondary"
                            className="shrink-0 px-1 py-0 text-[10px]"
                        >
                            NEW
                        </Badge>
                    )}
                    {modelConfig.isDeprecated && (
                        <Badge
                            variant="outline"
                            className="shrink-0 px-1 py-0 text-[10px] text-muted-foreground"
                        >
                            Deprecated
                        </Badge>
                    )}
                    {modelConfig.budgetTokens !== undefined && (
                        <Badge
                            variant="outline"
                            className="shrink-0 px-1 py-0 text-[10px] text-muted-foreground"
                        >
                            thinking
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-2 font-geist-mono text-xs text-helper">
                    <span className="truncate">{via.label}</span>
                    {affordances.badges &&
                        modelConfig.supportedAttachmentTypes.length > 0 && (
                            <span className="flex shrink-0 items-center gap-1">
                                {modelConfig.supportedAttachmentTypes.map((type) => {
                                    const cap = CAPABILITY_ICON[type];
                                    return (
                                        <Tooltip key={type}>
                                            <TooltipTrigger asChild>
                                                <cap.Icon className="h-3 w-3 text-helper" />
                                            </TooltipTrigger>
                                            <TooltipContent>{cap.label}</TooltipContent>
                                        </Tooltip>
                                    );
                                })}
                            </span>
                        )}
                    {pricingLabel && (
                        <span className="truncate">{pricingLabel}</span>
                    )}
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-2.5">
                {isLocked ? (
                    <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 px-1.5 text-accent-foreground"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAddApiKey?.();
                        }}
                    >
                        Add API key
                    </Button>
                ) : (
                    affordances.quota && (
                        <QuotaSlot quota={via.quota} quotaText={via.quotaText} />
                    )
                )}

                {affordances.favorite && (
                    <button
                        type="button"
                        aria-label={pinned ? "Unpin model" : "Pin model"}
                        aria-pressed={pinned}
                        onClick={(e) => {
                            e.stopPropagation();
                            onTogglePinned?.();
                        }}
                        className="text-helper transition-colors hover:text-foreground"
                    >
                        <StarIcon
                            className={cn(
                                "h-3.5 w-3.5",
                                pinned && "fill-highlight-foreground text-highlight-foreground",
                            )}
                        />
                    </button>
                )}

                {affordances.visibilityToggle && (
                    <Switch
                        checked={visible}
                        onCheckedChange={(v) => onToggleVisible?.(v)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={visible ? "Hide model" : "Show model"}
                    />
                )}

                {affordances.edit && (
                    <button
                        type="button"
                        aria-label="Edit model"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit?.();
                        }}
                        className="text-helper transition-colors hover:text-foreground"
                    >
                        <PencilIcon className="h-3.5 w-3.5" />
                    </button>
                )}
                {affordances.delete && (
                    <button
                        type="button"
                        aria-label="Delete model"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete?.();
                        }}
                        className="text-helper transition-colors hover:text-destructive"
                    >
                        <Trash2Icon className="h-3.5 w-3.5" />
                    </button>
                )}

                {affordances.trailingCheck && checked && (
                    <CheckIcon className="h-4 w-4 text-highlight-foreground" />
                )}
            </div>
        </CommandItem>
    );
}
