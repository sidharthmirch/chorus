import { useEffect, useState } from "react";
import { LayersIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { useChat, useUpdateContextWindowSize } from "@core/chorus/api/ChatAPI";
import { useMessageSets } from "@core/chorus/api/MessageAPI";

export function ContextWindowPill({ chatId }: { chatId: string }) {
    const [open, setOpen] = useState(false);
    const { data: chat } = useChat(chatId);
    const { data: messageSets } = useMessageSets(chatId);
    const updateContextWindowSize = useUpdateContextWindowSize();

    const windowSize = chat?.contextWindowSize;
    const [inputValue, setInputValue] = useState(
        windowSize !== undefined ? String(windowSize) : "",
    );

    useEffect(() => {
        setInputValue(windowSize !== undefined ? String(windowSize) : "");
    }, [windowSize]);

    // Total completed turn pairs (user + assistant sets)
    const totalTurns = Math.floor((messageSets?.length ?? 0) / 2);

    const handleToggle = () => {
        if (windowSize !== undefined) {
            // Disable windowing — restore full context
            updateContextWindowSize.mutate({ chatId, size: undefined });
            setInputValue("");
        } else {
            // Enable with a default of 10 turns
            updateContextWindowSize.mutate({ chatId, size: 10 });
            setInputValue("10");
        }
    };

    const commitSizeChange = () => {
        if (inputValue.trim() === "") return;

        const parsed = Number.parseInt(inputValue, 10);
        if (!Number.isFinite(parsed)) {
            setInputValue(windowSize !== undefined ? String(windowSize) : "");
            return;
        }

        const normalizedSize = Math.max(1, parsed);
        if (normalizedSize !== windowSize) {
            updateContextWindowSize.mutate({ chatId, size: normalizedSize });
        }
        setInputValue(String(normalizedSize));
    };

    const isActive = windowSize !== undefined;
    const effectiveTurns = isActive
        ? Math.min(windowSize, totalTurns)
        : totalTurns;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            {isActive ? (
                <PopoverTrigger asChild>
                    <button
                        className="inline-flex bg-muted items-center justify-center rounded-full h-7 pl-2 text-sm hover:bg-muted/80 px-3 py-1 ring-offset-background focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 flex-shrink-0 gap-1.5"
                        aria-label={`Context window: last ${windowSize} turns`}
                    >
                        <LayersIcon className="w-3 h-3" />
                        <span>
                            {effectiveTurns}/{totalTurns} turns
                        </span>
                    </button>
                </PopoverTrigger>
            ) : (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                            <button
                                className="inline-flex bg-muted items-center justify-center rounded-full h-7 w-7 text-sm hover:bg-muted/80 ring-offset-background focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 flex-shrink-0 text-muted-foreground"
                                aria-label="Limit context window"
                            >
                                <LayersIcon className="w-3.5 h-3.5" />
                            </button>
                        </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Limit context window</TooltipContent>
                </Tooltip>
            )}
            <PopoverContent
                className="w-64 p-3"
                align="start"
                side="top"
                sideOffset={8}
            >
                <div className="space-y-3">
                    <div className="px-0 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Context Window
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm">
                            {isActive ? "Limited" : "Full history"}
                        </span>
                        <button
                            role="switch"
                            aria-checked={isActive}
                            onClick={handleToggle}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                isActive
                                    ? "bg-primary"
                                    : "bg-muted-foreground/30"
                            }`}
                        >
                            <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                    isActive
                                        ? "translate-x-[18px]"
                                        : "translate-x-[3px]"
                                }`}
                            />
                        </button>
                    </div>

                    {isActive && (
                        <div className="space-y-1.5">
                            <label className="text-xs text-muted-foreground">
                                Last N turns to include
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onBlur={commitSizeChange}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.currentTarget.blur();
                                    }
                                }}
                                className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            {totalTurns > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Sending {effectiveTurns} of {totalTurns}{" "}
                                    turns
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
