export const CONTEXT_WINDOW_LAST_LIMITED_PREFIX =
    "context-window:last-limited:";

export function buildLastLimitedContextWindowKey(chatId: string): string {
    return `${CONTEXT_WINDOW_LAST_LIMITED_PREFIX}${chatId}`;
}

export function normalizeLimitedTurns(
    value: string | number | undefined,
    fallback: number,
): number {
    const parsed =
        typeof value === "number" ? value : Number.parseInt(value ?? "", 10);

    if (!Number.isFinite(parsed) || parsed < 0) {
        return fallback;
    }

    return parsed;
}

export function deriveContextWindowState({
    contextWindowSize,
    storedLimitedTurns,
    defaultLimitedTurns,
}: {
    contextWindowSize: number | undefined;
    storedLimitedTurns: string | undefined;
    defaultLimitedTurns: number;
}): {
    isLimited: boolean;
    limitedTurns: number;
    contextWindowSize: number | undefined;
} {
    if (contextWindowSize !== undefined) {
        return {
            isLimited: true,
            limitedTurns: normalizeLimitedTurns(
                contextWindowSize,
                defaultLimitedTurns,
            ),
            contextWindowSize,
        };
    }

    return {
        isLimited: false,
        limitedTurns: normalizeLimitedTurns(
            storedLimitedTurns,
            defaultLimitedTurns,
        ),
        contextWindowSize: undefined,
    };
}
