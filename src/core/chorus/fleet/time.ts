/**
 * W7 — Fleet. Small pure date-math + short relative-time formatting used by
 * `kanbanFormat.ts`, `worktreeFormat.ts`, and `fixtures.ts`.
 *
 * Deliberately separate from `displayDate` (`src/ui/lib/utils.ts`): that
 * helper renders a full absolute timestamp for message-level dates. Fleet's
 * card/ticket meta rows need the compact "4m" / "2h" / "yesterday" register
 * the design mock uses instead — a distinct format, not a replacement for
 * the app-wide date convention.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function minutesAgo(now: Date, minutes: number): Date {
    return new Date(now.getTime() - minutes * MINUTE_MS);
}

export function hoursAgo(now: Date, hours: number): Date {
    return new Date(now.getTime() - hours * HOUR_MS);
}

export function daysAgo(now: Date, days: number): Date {
    return new Date(now.getTime() - days * DAY_MS);
}

/** "4m" / "2h" / "3d" — floors at 1m so a just-started item never reads "0m". */
export function formatElapsedShort(elapsedMs: number): string {
    const ms = Math.max(0, elapsedMs);
    if (ms < HOUR_MS) {
        return `${Math.max(1, Math.round(ms / MINUTE_MS))}m`;
    }
    if (ms < DAY_MS) {
        return `${Math.round(ms / HOUR_MS)}h`;
    }
    return `${Math.round(ms / DAY_MS)}d`;
}

function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * "yesterday" / "2d ago" for anything that crossed at least one local
 * calendar-day boundary; falls back to `formatElapsedShort` (e.g. "12m",
 * "2h") for same-day timestamps, matching the design fixture's merged-card
 * copy ("yesterday", "2d ago").
 */
export function formatRelativeDay(date: Date, now: Date): string {
    const dayDiff = Math.round(
        (startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_MS,
    );
    if (dayDiff <= 0) return formatElapsedShort(now.getTime() - date.getTime());
    if (dayDiff === 1) return "yesterday";
    return `${dayDiff}d ago`;
}
