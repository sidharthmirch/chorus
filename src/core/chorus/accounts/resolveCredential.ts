import {
    getNineRouterApiKey,
    setNineRouterApiKey,
} from "../api/AppMetadataAPI";
import {
    NINEROUTER_BASE_URL,
    NineRouterClient,
    buildNineRouterModelId,
    findActiveConnectionForProvider,
    getNineRouterProviderRef,
    nineRouterClient as defaultNineRouterClient,
} from "./nineRouterClient";
import { ProviderAccountId } from "./ProviderAccounts";

/**
 * Verified Chorus-model-id → 9router-upstream-model-id map. Per
 * docs/rework/w1-provider-notes.md §2.6, this is deliberately sparse: each
 * entry was cross-checked against 9router's actual registry (not guessed),
 * and Chorus's own catalog mostly does NOT overlap with 9router's model
 * lists (different version numbering, different releases tracked). A
 * missing entry means "no 9router route for this specific model" — that is
 * the expected, common case today, not a bug. `resolveNineRouterCredential`
 * treats it as "fall back to existing behavior."
 *
 * Widening this later needs either manual re-curation against a fresh
 * 9router clone, or a live-`/v1/models`-lookup-plus-fuzzy-match strategy
 * (more robust to both catalogs moving independently, more code — deferred).
 */
export const NINEROUTER_MODEL_MAP: Partial<
    Record<ProviderAccountId, Record<string, string>>
> = {
    anthropic: {
        "claude-haiku-4-5-20251001": "claude-haiku-4-5-20251001",
    },
    google: {
        "gemini-2.5-flash": "gemini-2.5-flash",
        "gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
    },
    // openai: intentionally empty — zero verified overlaps between Chorus's
    // OpenAI catalog and 9router's `codex` registry as of the source read.
};

export function mapToNineRouterUpstreamModelId(
    providerId: ProviderAccountId,
    chorusModelId: string,
): string | undefined {
    return NINEROUTER_MODEL_MAP[providerId]?.[chorusModelId];
}

export interface INineRouterCredential {
    baseUrl: string;
    apiKey: string;
    /** `<alias>/<upstreamModelId>` — ready to use as the outgoing request's model field. */
    model: string;
}

const CHORUS_NINEROUTER_KEY_NAME = "chorus";

/** The subset of NineRouterClient's methods resolveCredential needs — kept narrow for easy test doubles. */
type NineRouterClientForCredentials = Pick<
    NineRouterClient,
    "healthCheck" | "listConnections" | "createApiKey"
>;

/**
 * Ensures Chorus has a usable 9router API key, creating and persisting one
 * on first use. 9router only ever returns a key's plaintext once (at
 * creation) — see docs/rework/w1-provider-notes.md §2.5 — so this always
 * prefers the cached value over creating a new one.
 */
export async function ensureNineRouterApiKey(
    client: NineRouterClientForCredentials = defaultNineRouterClient,
): Promise<string> {
    const cached = await getNineRouterApiKey();
    if (cached) return cached;

    const created = await client.createApiKey(CHORUS_NINEROUTER_KEY_NAME);
    await setNineRouterApiKey(created.key);
    return created.key;
}

/**
 * The credential-resolution step referenced by 00-ARCHITECTURE.md §4.2 and
 * the ORCHESTRATION.md 9router pivot: given a Chorus provider + model,
 * decides whether a chat request should route through 9router, and if so,
 * what baseUrl/apiKey/model to use.
 *
 * Returns `undefined` whenever any precondition isn't met (no oauth mapping
 * for this provider, no known model mapping, 9router not running, no active
 * connection for the provider, or key creation failed). Callers — the
 * `ModelProviders/*` classes — must treat `undefined` as "use existing
 * behavior" (API key / backend proxy), never as an error to surface.
 */
export async function resolveNineRouterCredential(
    providerId: ProviderAccountId,
    chorusModelId: string,
    client: NineRouterClientForCredentials = defaultNineRouterClient,
): Promise<INineRouterCredential | undefined> {
    const providerRef = getNineRouterProviderRef(providerId);
    if (!providerRef) return undefined;

    const upstreamModelId = mapToNineRouterUpstreamModelId(
        providerId,
        chorusModelId,
    );
    if (!upstreamModelId) return undefined;

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
    if (!connection) return undefined;

    let apiKey: string;
    try {
        apiKey = await ensureNineRouterApiKey(client);
    } catch {
        return undefined;
    }

    return {
        baseUrl: NINEROUTER_BASE_URL,
        apiKey,
        model: buildNineRouterModelId(providerRef.alias, upstreamModelId),
    };
}
