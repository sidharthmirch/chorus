import { useEffect, useMemo, useState } from "react";
import { LayersIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useChat, useUpdateContextWindowSize } from "@core/chorus/api/ChatAPI";
import { useMessageSets } from "@core/chorus/api/MessageAPI";
import {
    buildLastLimitedContextWindowKey,
    deriveContextWindowState,
    normalizeLimitedTurns,
} from "./contextWindowState";

const DEFAULT_LIMITED_TURNS = 10;

function readLastLimitedTurns(chatId: string): string | undefined {
    if (typeof window === "undefined") return undefined;
    return (
        window.localStorage.getItem(buildLastLimitedContextWindowKey(chatId)) ??
        undefined
    );
}

function writeLastLimitedTurns(chatId: string, value: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
        buildLastLimitedContextWindowKey(chatId),
        value,
    );
}

export function ContextWindowPill({ chatId }: { chatId: string }) {
    const [open, setOpen] = useState(false);
    const [storedLimitedTurns, setStoredLimitedTurns] = useState<
        string | undefined
    >(() => readLastLimitedTurns(chatId));
    const { data: chat } = useChat(chatId);
    const { data: messageSets } = useMessageSets(chatId);
    const updateContextWindowSize = useUpdateContextWindowSize();

    useEffect(() => {
        setStoredLimitedTurns(readLastLimitedTurns(chatId));
    }, [chatId]);

    const contextWindowState = useMemo(
        () =>
            deriveContextWindowState({
                contextWindowSize: chat?.contextWindowSize,
                storedLimitedTurns,
                defaultLimitedTurns: DEFAULT_LIMITED_TURNS,
            }),
        [chat?.contextWindowSize, storedLimitedTurns],
    );

    const [inputValue, setInputValue] = useState(
        String(contextWindowState.limitedTurns),
    );

    useEffect(() => {
        setInputValue(String(contextWindowState.limitedTurns));
    }, [contextWindowState.limitedTurns]);

    const totalTurns = Math.floor((messageSets?.length ?? 0) / 2);
    const effectiveTurns = contextWindowState.isLimited
        ? Math.min(contextWindowState.limitedTurns, totalTurns)
        : totalTurns;

    const persistLimitedDraft = (raw: string | number) => {
        const normalized = normalizeLimitedTurns(raw, DEFAULT_LIMITED_TURNS);
        const nextValue = String(normalized);
        writeLastLimitedTurns(chatId, nextValue);
        setStoredLimitedTurns(nextValue);
        setInputValue(nextValue);
        return normalized;
    };

    const setMode = (mode: "full" | "limited") => {
        if (mode === "full") {
            if (contextWindowState.contextWindowSize !== undefined) {
                updateContextWindowSize.mutate({ chatId, size: undefined });
            }
            return;
        }

        const limitedTurns = persistLimitedDraft(inputValue);
        if (contextWindowState.contextWindowSize !== limitedTurns) {
            updateContextWindowSize.mutate({ chatId, size: limitedTurns });
        }
    };

    const commitLimitedTurns = () => {
        const limitedTurns = persistLimitedDraft(inputValue);
        if (
            contextWindowState.isLimited &&
            contextWindowState.contextWindowSize !== limitedTurns
        ) {
            updateContextWindowSize.mutate({ chatId, size: limitedTurns });
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-muted/80"
                    aria-label={
                        contextWindowState.isLimited
                            ? `Context window limited to last ${contextWindowState.limitedTurns} turns`
                            : "Context window uses full history"
                    }
                >
                    <LayersIcon className="h-3.5 w-3.5" />
                    <span className="font-medium uppercase tracking-wide">
                        {contextWindowState.isLimited
                            ? "Limited"
                            : "Full history"}
                    </span>
                    <span className="text-muted-foreground">
                        {effectiveTurns}/{totalTurns}
                    </span>
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-72 space-y-3 p-3"
                align="start"
                side="top"
                sideOffset={8}
            >
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Context Window
                </div>

                <div className="rounded-lg bg-muted p-1">
                    <div className="grid grid-cols-2 gap-1">
                        <button
                            className={`rounded-md px-2 py-1 text-xs ${
                                !contextWindowState.isLimited
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() => setMode("full")}
                        >
                            Full history
                        </button>
                        <button
                            className={`rounded-md px-2 py-1 text-xs ${
                                contextWindowState.isLimited
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() => setMode("limited")}
                        >
                            Limited
                        </button>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label
                        className={`text-xs ${
                            contextWindowState.isLimited
                                ? "text-foreground"
                                : "text-muted-foreground"
                        }`}
                    >
                        Last N turns
                    </label>
                    <input
                        type="number"
                        min={1}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onBlur={commitLimitedTurns}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.currentTarget.blur();
                            }
                        }}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                </div>

                <p className="text-xs text-muted-foreground">
                    Sending {effectiveTurns} of {totalTurns} turns.
                </p>
            </PopoverContent>
        </Popover>
    );
}
