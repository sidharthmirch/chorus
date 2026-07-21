import {
    IQuotaSnapshot,
    ProviderAccountId,
    ProviderAccountStatus,
    makeQuotaSnapshot,
} from "./ProviderAccounts";
import {
    NineRouterClient,
    NineRouterQuotaWindow,
    NineRouterUsageResult,
    findActiveConnectionForProvider,
    getNineRouterProviderRef,
    nineRouterClient as defaultNineRouterClient,
} from "./nineRouterClient";

/**
 * Derives per-provider usage/status straight from 9router (P6). Per
 * 00-ARCHITECTURE.md §4.3: "fetch/derive per-provider usage ... cached in
 * SQLite, refreshed on use + interval". This module is the "derive" half —
 * DB-agnostic and unit-testable via an injected client; the cache/refresh
 * policy and SQLite persistence live in `api/ProviderAccountsAPI.ts`, which
 * is the layer that already owns `db` access for this feature (P1's
 * migration 147).
 */

/** The subset of NineRouterClient's methods QuotaService needs — kept narrow for easy test doubles. */
type NineRouterClientForQuota = Pick<
    NineRouterClient,
    "healthCheck" | "listConnections" | "getUsage"
>;

export interface NineRouterDerivedAccount {
    status: ProviderAccountStatus;
    accountEmail?: string;
    quota?: IQuotaSnapshot;
}

/**
 * Picks the most relevant quota window out of a usage result's `quotas` map
 * and reduces it to a single IQuotaSnapshot. Window names are provider-
 * specific free text (see docs/rework/w1-provider-notes.md §2.4), so this is
 * necessarily heuristic: prefer a window whose name mentions "session"
 * (Claude's shortest/most-urgent window), else the window with the soonest
 * parseable `resetAt`, else just the first window present. Returns
 * undefined when there's no quota data at all (connected, but usage isn't
 * available yet — a valid, non-error state per the research notes).
 */
export function deriveQuotaSnapshot(
    usage: NineRouterUsageResult,
): IQuotaSnapshot | undefined {
    if (!usage.quotas) return undefined;
    const entries = Object.entries(usage.quotas);
    if (entries.length === 0) return undefined;

    const sessionEntry = entries.find(([name]) =>
        name.toLowerCase().includes("session"),
    );
    const chosen = sessionEntry ?? pickSoonestReset(entries) ?? entries[0];
    const [, window] = chosen;

    return makeQuotaSnapshot(
        usedFractionFromWindow(window),
        parseResetAt(window.resetAt),
    );
}

function parseResetAt(resetAt: string | null | undefined): Date | undefined {
    if (!resetAt) return undefined;
    const date = new Date(resetAt);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function pickSoonestReset(
    entries: [string, NineRouterQuotaWindow][],
): [string, NineRouterQuotaWindow] | undefined {
    let soonest: [string, NineRouterQuotaWindow, Date] | undefined;
    for (const entry of entries) {
        const date = parseResetAt(entry[1].resetAt);
        if (!date) continue;
        if (!soonest || date < soonest[2]) {
            soonest = [entry[0], entry[1], date];
        }
    }
    return soonest ? [soonest[0], soonest[1]] : undefined;
}

/**
 * `used` conventions differ per provider (docs/rework/w1-provider-notes.md
 * §2.4): Claude/Codex report `used` as an already-0-100 percentage (with
 * `total: 100`); GitHub reports raw counts. Treated as a percentage when
 * `total === 100`, else divided by `total`.
 */
function usedFractionFromWindow(window: NineRouterQuotaWindow): number {
    if (window.unlimited) return 0;
    if (window.total <= 0) return 0;
    if (window.total === 100) return window.used / 100;
    return window.used / window.total;
}

/**
 * Derives a single OAuth-forwarded provider's live status+quota straight
 * from 9router. Returns `undefined` when 9router isn't reachable at all —
 * callers should treat that as "leave the last-known value alone," not as
 * "not-configured" (an unreachable 9router doesn't mean the user
 * disconnected). Returns `{status: "not-configured"}` when 9router IS
 * reachable but has no active connection for this provider (the honest
 * "actually not connected" case).
 *
 * Status derivation is conservative: 9router auto-refreshes tokens
 * internally and Chorus doesn't get a direct "your token just expired"
 * signal outside of an actual failed chat request (see P5's known gap in
 * .rework/PROGRESS.md) — so this only distinguishes "connected" from
 * "error" (a connection with `lastError`/`testStatus === "error"` set) and
 * does not attempt to further distinguish "expired" from generic "error".
 */
export async function deriveProviderAccountFromNineRouter(
    providerId: ProviderAccountId,
    client: NineRouterClientForQuota = defaultNineRouterClient,
): Promise<NineRouterDerivedAccount | undefined> {
    const providerRef = getNineRouterProviderRef(providerId);
    if (!providerRef) return undefined;

    const isRunning = await client.healthCheck();
    if (!isRunning) return undefined;

    let connections;
    try {
        connections = await client.listConnections();
    } catch {
        return undefined;
    }

    const connection = findActiveConnectionForProvider(
        connections,
        providerRef.id,
    );
    if (!connection) {
        return { status: "not-configured" };
    }

    if (connection.testStatus === "error" || connection.lastError) {
        return { status: "error", accountEmail: connection.email };
    }

    let usage: NineRouterUsageResult;
    try {
        usage = await client.getUsage(connection.id);
    } catch {
        // Connected, but this round's usage fetch failed — still connected,
        // just without a fresh quota snapshot.
        return { status: "connected", accountEmail: connection.email };
    }

    return {
        status: "connected",
        accountEmail: connection.email,
        quota: deriveQuotaSnapshot(usage),
    };
}
