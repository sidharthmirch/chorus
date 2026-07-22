import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "../DB";
import {
    IProviderAccount,
    IQuotaSnapshot,
    PROVIDER_ACCOUNT_DISPLAY_NAMES,
    ProviderAccountId,
    isProviderAccountId,
    isProviderAccountStatus,
    isProviderAuthKind,
    makeQuotaSnapshot,
} from "../accounts/ProviderAccounts";
import {
    detectNineRouter,
    findActiveConnectionForProvider,
    getNineRouterProviderRef,
    nineRouterClient,
    NINEROUTER_BASE_URL,
} from "../accounts/nineRouterClient";
import { openUrl } from "@tauri-apps/plugin-opener";
import { deriveProviderAccountFromNineRouter } from "../accounts/QuotaService";

/**
 * Frozen consumer surface for provider accounts (OAuth-forward + quota
 * meters). Per docs/rework/00-ARCHITECTURE.md §4.1, W3 (Accounts settings),
 * W4 (model rows/popover), W6 (composer), and W7 (quota-aware fallback) all
 * render from `useProviderAccounts()` / `useQuota()` — no one else should
 * touch token/quota logic directly.
 *
 * Status (P6): the four OAuth-forwarded providers (anthropic/openai/google/
 * copilot) now derive real status+quota from a running 9router instance
 * (`accounts/QuotaService.ts`), cached in the `provider_accounts` SQLite
 * table (migration 147) and refreshed at most every
 * `NINEROUTER_QUOTA_REFRESH_INTERVAL_MS`. `openrouter`/`local` remain on the
 * in-memory stub below (that join to existing ApiKeysForm/OllamaClient state
 * is still a documented TODO, not attempted here — see .rework/PROGRESS.md).
 * Connect/disconnect are now wired to 9router (`connectProviderAccount` opens
 * 9router's authorize URL in the system browser; `disconnectProviderAccount`
 * deletes the 9router connection), falling back to the stub store for
 * non-9router providers or when 9router is unreachable. The connect exchange
 * completion is UNTESTED end-to-end (needs a live 9router — see the function
 * doc + .rework/progress/W1.md). When 9router is unreachable, the stub's last
 * mutation is what
 * `fetchProviderAccounts` falls back to; when 9router is reachable, live
 * derived data wins. The exported hook signatures are unchanged throughout.
 */

const providerAccountKeys = {
    all: () => ["providerAccounts"] as const,
    detail: (providerId: ProviderAccountId) =>
        [...providerAccountKeys.all(), providerId] as const,
};

/**
 * Seed stub data, shaped after docs/rework/design/accounts-oauth.md's
 * `catalogDefs` mock. Every provider starts `not-configured` except the
 * two auth kinds that already work today without any OAuth (OpenRouter via
 * existing API key settings, Ollama via local detection) — those are left
 * `not-configured` too here since P2 does not yet join the existing
 * ApiKeysForm / OllamaClient state; that join is a P5/P6 TODO tracked in
 * .rework/PROGRESS.md, not a silent gap.
 */
function seedStubProviderAccounts(): IProviderAccount[] {
    return [
        {
            providerId: "anthropic",
            authKind: "oauth",
            label: `oauth · ${PROVIDER_ACCOUNT_DISPLAY_NAMES.anthropic}`,
            status: "not-configured",
        },
        {
            providerId: "openai",
            authKind: "oauth",
            label: `oauth · ${PROVIDER_ACCOUNT_DISPLAY_NAMES.openai}`,
            status: "not-configured",
        },
        {
            providerId: "google",
            authKind: "oauth",
            label: `oauth · ${PROVIDER_ACCOUNT_DISPLAY_NAMES.google}`,
            status: "not-configured",
        },
        {
            providerId: "copilot",
            authKind: "oauth",
            label: `oauth · ${PROVIDER_ACCOUNT_DISPLAY_NAMES.copilot}`,
            status: "not-configured",
        },
        {
            providerId: "openrouter",
            authKind: "api-key",
            label: "api key",
            status: "not-configured",
        },
        {
            providerId: "local",
            authKind: "none-local",
            label: "ollama · local",
            status: "not-configured",
        },
    ];
}

// Module-level stub store. Deliberately not persisted to SQLite yet — see
// the file-level comment. Mutated in place by the stub mutation functions
// below so repeated fetches within a session observe prior connect/disconnect
// calls (useful for downstream UI dev without a real backend).
let stubStore: IProviderAccount[] = seedStubProviderAccounts();

/** Test-only escape hatch to reset module state between test cases. */
export function __resetProviderAccountsStubForTests(): void {
    stubStore = seedStubProviderAccounts();
}

/**
 * How long a cached 9router-derived row is trusted before re-deriving.
 * Usage endpoints are rate-limited upstream (docs/rework/w1-provider-notes.md
 * §2.4's Claude 429-cooldown note) — this is deliberately not fast.
 */
const NINEROUTER_QUOTA_REFRESH_INTERVAL_MS = 60_000;

type ProviderAccountRow = {
    provider_id: string;
    auth_kind: string;
    label: string | null;
    account_email: string | null;
    status: string;
    quota_json: string | null;
    updated_at: string;
};

type StoredQuota = {
    usedFraction: number;
    resetsAt?: string;
};

function readProviderAccountRow(
    row: ProviderAccountRow,
): { account: IProviderAccount; updatedAt: Date } | undefined {
    if (
        !isProviderAccountId(row.provider_id) ||
        !isProviderAuthKind(row.auth_kind) ||
        !isProviderAccountStatus(row.status)
    ) {
        // A row this module didn't write (or a 9router-side rename we don't
        // know about yet) — drop it rather than guess.
        return undefined;
    }

    let quota: IQuotaSnapshot | undefined;
    if (row.quota_json) {
        try {
            const parsed = JSON.parse(row.quota_json) as unknown;
            if (
                typeof parsed === "object" &&
                parsed !== null &&
                "usedFraction" in parsed &&
                typeof (parsed as StoredQuota).usedFraction === "number"
            ) {
                const stored = parsed as StoredQuota;
                quota = makeQuotaSnapshot(
                    stored.usedFraction,
                    stored.resetsAt ? new Date(stored.resetsAt) : undefined,
                );
            }
        } catch {
            // Malformed cache entry — treat as no quota rather than throwing.
        }
    }

    return {
        account: {
            providerId: row.provider_id,
            authKind: row.auth_kind,
            label: row.label ?? PROVIDER_ACCOUNT_DISPLAY_NAMES[row.provider_id],
            accountEmail: row.account_email ?? undefined,
            status: row.status,
            quota,
        },
        // SQLite's CURRENT_TIMESTAMP is a naive UTC string; append "Z" to
        // parse it as UTC (same trick as src/ui/lib/utils.ts's convertDate,
        // reimplemented here rather than importing a ui/ util into core/).
        updatedAt: new Date(row.updated_at + "Z"),
    };
}

async function fetchCachedProviderAccountRows(): Promise<
    Map<ProviderAccountId, { account: IProviderAccount; updatedAt: Date }>
> {
    const rows = await db.select<ProviderAccountRow[]>(
        "SELECT provider_id, auth_kind, label, account_email, status, quota_json, updated_at FROM provider_accounts",
    );
    const map = new Map<
        ProviderAccountId,
        { account: IProviderAccount; updatedAt: Date }
    >();
    for (const row of rows) {
        const parsed = readProviderAccountRow(row);
        if (parsed) map.set(parsed.account.providerId, parsed);
    }
    return map;
}

async function persistProviderAccount(account: IProviderAccount): Promise<void> {
    const quotaJson: StoredQuota | null = account.quota
        ? {
              usedFraction: account.quota.usedFraction,
              resetsAt: account.quota.resetsAt?.toISOString(),
          }
        : null;

    await db.execute(
        `INSERT OR REPLACE INTO provider_accounts
            (provider_id, auth_kind, label, account_email, status, quota_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
            account.providerId,
            account.authKind,
            account.label,
            account.accountEmail ?? null,
            account.status,
            quotaJson ? JSON.stringify(quotaJson) : null,
        ],
    );
}

/**
 * Re-derives a single provider's account from 9router and persists the
 * result. Returns undefined when 9router isn't reachable this round —
 * callers should fall back to the last-cached/stub value, not treat this as
 * "disconnected".
 */
async function refreshProviderAccountFromNineRouter(
    fallback: IProviderAccount,
): Promise<IProviderAccount | undefined> {
    const derived = await deriveProviderAccountFromNineRouter(
        fallback.providerId,
    );
    if (!derived) return undefined;

    const merged: IProviderAccount = {
        ...fallback,
        status: derived.status,
        accountEmail: derived.accountEmail,
        quota: derived.quota,
    };
    await persistProviderAccount(merged);
    return merged;
}

export async function fetchProviderAccounts(): Promise<IProviderAccount[]> {
    const cachedRows = await fetchCachedProviderAccountRows();

    return Promise.all(
        stubStore.map(async (fallback) => {
            // openrouter/local never go through 9router — stub, unchanged.
            if (!getNineRouterProviderRef(fallback.providerId)) {
                return fallback;
            }

            const cached = cachedRows.get(fallback.providerId);
            const isFresh =
                cached !== undefined &&
                Date.now() - cached.updatedAt.getTime() <
                    NINEROUTER_QUOTA_REFRESH_INTERVAL_MS;
            if (isFresh) return cached.account;

            const refreshed = await refreshProviderAccountFromNineRouter(fallback);
            return refreshed ?? cached?.account ?? fallback;
        }),
    );
}

export async function fetchProviderAccount(
    providerId: ProviderAccountId,
): Promise<IProviderAccount | undefined> {
    const accounts = await fetchProviderAccounts();
    return accounts.find((account) => account.providerId === providerId);
}

/**
 * Forces a fresh 9router-derived read for one provider, bypassing the
 * refresh-interval cache gate above — this is what
 * `useRefreshProviderAccountQuota()` calls. Falls back to the stub's
 * refresh behavior for providers with no 9router mapping, or when 9router
 * isn't reachable right now.
 */
export async function forceRefreshProviderAccountQuota(
    providerId: ProviderAccountId,
): Promise<IQuotaSnapshot | undefined> {
    if (getNineRouterProviderRef(providerId)) {
        const fallback = await fetchProviderAccount(providerId);
        if (fallback) {
            const refreshed = await refreshProviderAccountFromNineRouter(fallback);
            if (refreshed) return refreshed.quota;
        }
    }
    return stubRefreshProviderAccountQuota(providerId);
}

/** Pure helper: returns a new list with `providerId`'s account replaced. */
function replaceAccount(
    accounts: IProviderAccount[],
    providerId: ProviderAccountId,
    update: (account: IProviderAccount) => IProviderAccount,
): IProviderAccount[] {
    return accounts.map((account) =>
        account.providerId === providerId ? update(account) : account,
    );
}

/**
 * Stub "connect" — marks the account connected with a placeholder quota.
 * P3/P4 replace the body with a real 9router authorize/exchange round trip;
 * the (providerId) => Promise<IProviderAccount> shape stays the same.
 */
export async function stubConnectProviderAccount(
    providerId: ProviderAccountId,
): Promise<IProviderAccount> {
    stubStore = replaceAccount(stubStore, providerId, (account) => ({
        ...account,
        status: "connected",
        accountEmail: account.accountEmail ?? "you@example.com",
        quota:
            account.authKind === "oauth"
                ? makeQuotaSnapshot(0.62, new Date(Date.now() + 3 * 60 * 60 * 1000))
                : undefined,
    }));
    const updated = await fetchProviderAccount(providerId);
    if (!updated) {
        throw new Error(`Unknown provider account: ${providerId}`);
    }
    return updated;
}

export async function stubDisconnectProviderAccount(
    providerId: ProviderAccountId,
): Promise<IProviderAccount> {
    stubStore = replaceAccount(stubStore, providerId, (account) => ({
        ...account,
        status: "not-configured",
        accountEmail: undefined,
        quota: undefined,
    }));
    const updated = await fetchProviderAccount(providerId);
    if (!updated) {
        throw new Error(`Unknown provider account: ${providerId}`);
    }
    return updated;
}

/**
 * Real connect: for a 9router-forwarded OAuth provider, kick off 9router's
 * authorize flow in the system browser. 9router hosts the OAuth callback and
 * completes the PKCE exchange server-side (Chorus never sees the token); the
 * connected account then surfaces through `fetchProviderAccounts()`'s 9router
 * derivation once the UI re-fetches after the browser round trip.
 *
 * UNTESTED end-to-end (needs a live 9router): this assumes 9router auto-
 * completes at its own callback route. If instead it hands the `code` back to
 * the opener, finishing the exchange would need a Chorus-side loopback
 * listener (new Rust) calling `nineRouterClient.exchangeCode(...)` — the client
 * method already exists. Tracked as a follow-up in .rework/progress/W1.md.
 * openrouter/local keep the existing stub behavior.
 */
export async function connectProviderAccount(
    providerId: ProviderAccountId,
): Promise<IProviderAccount> {
    const ref = getNineRouterProviderRef(providerId);
    if (ref) {
        const redirectUri = `${NINEROUTER_BASE_URL}/api/oauth/${ref.id}/callback`;
        const authorize = await nineRouterClient.getAuthorizeUrl(
            ref.id,
            redirectUri,
        );
        await openUrl(authorize.url);
        // The browser flow is async and out-of-process; return the current
        // (still-pending) account. The mutation's onSuccess invalidates the
        // queries, and useProviderAccounts/useNineRouterStatus polling flips it
        // to "connected" once 9router stores the connection.
        const current = await fetchProviderAccount(providerId);
        if (current) return current;
    }
    return stubConnectProviderAccount(providerId);
}

/**
 * Real disconnect: 9router's only "disconnect" is DELETE /api/providers/:id
 * (docs/rework/w1-provider-notes.md §2.2). Delete the matching connection,
 * then re-derive so the cached row reflects the removal immediately. Falls
 * back to the local stub update when 9router is unreachable or the provider
 * isn't 9router-mapped.
 */
export async function disconnectProviderAccount(
    providerId: ProviderAccountId,
): Promise<IProviderAccount> {
    const ref = getNineRouterProviderRef(providerId);
    if (ref) {
        try {
            const connections = await nineRouterClient.listConnections();
            const active = findActiveConnectionForProvider(connections, ref.id);
            if (active) {
                await nineRouterClient.deleteConnection(active.id);
                const fallback = await fetchProviderAccount(providerId);
                if (fallback) {
                    const refreshed =
                        await refreshProviderAccountFromNineRouter(fallback);
                    if (refreshed) return refreshed;
                }
            }
        } catch {
            // 9router unreachable — nothing to delete server-side; fall through
            // to the local stub update so the UI still reflects the intent.
        }
    }
    return stubDisconnectProviderAccount(providerId);
}

/**
 * Stub "refresh" fallback — used by `forceRefreshProviderAccountQuota` for
 * providers with no 9router mapping (openrouter/local), or when 9router
 * isn't reachable. Just re-reads the current (stub) quota; there's nothing
 * to actually refresh without a real backend for those cases.
 */
export async function stubRefreshProviderAccountQuota(
    providerId: ProviderAccountId,
): Promise<IQuotaSnapshot | undefined> {
    const account = await fetchProviderAccount(providerId);
    if (!account || account.status !== "connected") {
        return undefined;
    }
    return account.quota;
}

/**
 * The connect flow completes OUT OF PROCESS (OAuth happens in the system
 * browser via 9router), so the one-shot invalidate in `useConnectProviderAccount`
 * fires before the user has finished. The global QueryClient uses
 * `staleTime: Infinity` + no refetch-on-focus, so without this the Accounts
 * view would show "not-configured" indefinitely after a successful connect.
 * Poll on a bounded interval; the underlying 9router derivation is itself
 * cache-gated (~60s) in `fetchProviderAccounts`, so this stays cheap.
 */
const PROVIDER_ACCOUNTS_POLL_INTERVAL_MS = 20_000;

export function useProviderAccounts() {
    return useQuery({
        queryKey: providerAccountKeys.all(),
        queryFn: fetchProviderAccounts,
        refetchInterval: PROVIDER_ACCOUNTS_POLL_INTERVAL_MS,
    });
}

export function useQuota(providerId: ProviderAccountId) {
    return useQuery({
        queryKey: providerAccountKeys.detail(providerId),
        queryFn: async () => {
            const account = await fetchProviderAccount(providerId);
            return account?.quota;
        },
    });
}

/**
 * How often to re-probe 9router's health endpoint while its status is
 * displayed (e.g. the P4 onboarding card's "9router not detected — Check
 * again" state). Not part of the frozen IProviderAccount contract — this is
 * lifecycle-detection plumbing additive to it (docs/rework/w1-provider-notes.md §6).
 */
const NINEROUTER_HEALTH_POLL_INTERVAL_MS = 10_000;

/**
 * Is a local 9router instance reachable on :20128 right now? Polled on an
 * interval (via TanStack Query's `refetchInterval`, not a manual
 * `setTimeout`) so onboarding UI can reflect the user starting/stopping it
 * without a manual refresh.
 */
export function useNineRouterStatus() {
    return useQuery({
        queryKey: ["nineRouterStatus"] as const,
        queryFn: detectNineRouter,
        refetchInterval: NINEROUTER_HEALTH_POLL_INTERVAL_MS,
    });
}

export function useConnectProviderAccount() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["connectProviderAccount"] as const,
        mutationFn: async ({
            providerId,
        }: {
            providerId: ProviderAccountId;
        }) => connectProviderAccount(providerId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: providerAccountKeys.all(),
            });
        },
    });
}

export function useDisconnectProviderAccount() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["disconnectProviderAccount"] as const,
        mutationFn: async ({
            providerId,
        }: {
            providerId: ProviderAccountId;
        }) => disconnectProviderAccount(providerId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: providerAccountKeys.all(),
            });
        },
    });
}

export function useRefreshProviderAccountQuota() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["refreshProviderAccountQuota"] as const,
        mutationFn: async ({
            providerId,
        }: {
            providerId: ProviderAccountId;
        }) => forceRefreshProviderAccountQuota(providerId),
        onSuccess: async (_data, { providerId }) => {
            // A forced refresh can change status/email too (not just quota),
            // so invalidate the list alongside this provider's detail entry.
            await queryClient.invalidateQueries({
                queryKey: providerAccountKeys.detail(providerId),
            });
            await queryClient.invalidateQueries({
                queryKey: providerAccountKeys.all(),
            });
        },
    });
}
