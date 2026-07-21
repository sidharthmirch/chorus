import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    IProviderAccount,
    IQuotaSnapshot,
    PROVIDER_ACCOUNT_DISPLAY_NAMES,
    ProviderAccountId,
    makeQuotaSnapshot,
} from "../accounts/ProviderAccounts";
import { detectNineRouter } from "../accounts/nineRouterClient";

/**
 * Frozen consumer surface for provider accounts (OAuth-forward + quota
 * meters). Per docs/rework/00-ARCHITECTURE.md §4.1, W3 (Accounts settings),
 * W4 (model rows/popover), W6 (composer), and W7 (quota-aware fallback) all
 * render from `useProviderAccounts()` / `useQuota()` — no one else should
 * touch token/quota logic directly.
 *
 * P2 status: backed by an in-memory stub store so downstream streams can
 * build against the real shape immediately. P3/P4 replace `stubConnect`
 * with a real 9router OAuth connect flow (`accounts/nineRouterClient.ts`);
 * P6 replaces the stub quota values with `accounts/QuotaService.ts`, cached
 * in the `provider_accounts` SQLite table (migration 147). The exported
 * hook signatures below do not change across those phases.
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

export function fetchProviderAccounts(): Promise<IProviderAccount[]> {
    // Not `async` — there is nothing to await yet (in-memory stub). Kept as
    // a Promise-returning function so the signature doesn't change once
    // P6 swaps this for a real SQLite read.
    return Promise.resolve(stubStore);
}

export async function fetchProviderAccount(
    providerId: ProviderAccountId,
): Promise<IProviderAccount | undefined> {
    const accounts = await fetchProviderAccounts();
    return accounts.find((account) => account.providerId === providerId);
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
 * Stub "refresh" — re-derives the same quota (no-op beyond touching the
 * timestamp implicitly via a new Date). P6 replaces this with a real
 * QuotaService fetch.
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

export function useProviderAccounts() {
    return useQuery({
        queryKey: providerAccountKeys.all(),
        queryFn: fetchProviderAccounts,
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
        }) => stubConnectProviderAccount(providerId),
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
        }) => stubDisconnectProviderAccount(providerId),
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
        }) => stubRefreshProviderAccountQuota(providerId),
        onSuccess: async (_data, { providerId }) => {
            await queryClient.invalidateQueries({
                queryKey: providerAccountKeys.detail(providerId),
            });
        },
    });
}
