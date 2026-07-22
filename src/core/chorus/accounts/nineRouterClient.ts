import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { ProviderAccountId } from "./ProviderAccounts";

/**
 * Typed client over 9router's local HTTP API (github.com/decolua/9router).
 * Route shapes below are documented in `docs/rework/w1-provider-notes.md`
 * §2 — that file is the source of truth if 9router's API changes; re-verify
 * against a fresh clone before editing this file's request/response shapes.
 *
 * 9router's management routes (`/api/providers`, `/api/oauth/**`,
 * `/api/usage/**`, `/api/keys`) have no CORS headers, so this client uses
 * `@tauri-apps/plugin-http`'s `fetch` (Rust-mediated, not subject to the
 * webview's CORS enforcement) rather than the global `fetch`. That plugin is
 * already a dependency and already covered by the broad `http:default`
 * capability in `src-tauri/capabilities/default.json` — no capability edit
 * needed (see .rework/PROGRESS.md decisions log).
 */

export const NINEROUTER_BASE_URL = "http://localhost:20128";

type FetchLike = typeof fetch;

/** A provider id + short alias pair as used by 9router (alias appears in model ids, e.g. "cc/claude-sonnet-5"). */
export interface NineRouterProviderRef {
    /** 9router's internal provider id, e.g. "claude" */
    id: string;
    /** 9router's short alias, used as the model-id prefix, e.g. "cc" */
    alias: string;
}

/**
 * Chorus providerId → 9router provider ref, for the OAuth-forwarded
 * subscription accounts only (openrouter/local stay on their existing,
 * non-9router auth paths). Per docs/rework/w1-provider-notes.md §3 — 9router
 * keeps a separate direct-API-key "anthropic"/"openai" entry that is NOT
 * this map's target; those are unrelated to Chorus's oauth authKind.
 */
export const NINEROUTER_OAUTH_PROVIDER_MAP: Partial<
    Record<ProviderAccountId, NineRouterProviderRef>
> = {
    anthropic: { id: "claude", alias: "cc" },
    openai: { id: "codex", alias: "cx" },
    google: { id: "gemini-cli", alias: "gc" },
    copilot: { id: "github", alias: "gh" },
};

export function getNineRouterProviderRef(
    providerId: ProviderAccountId,
): NineRouterProviderRef | undefined {
    return NINEROUTER_OAUTH_PROVIDER_MAP[providerId];
}

/** Builds the `<alias>/<modelId>` id 9router's /v1 endpoints expect. */
export function buildNineRouterModelId(
    alias: string,
    upstreamModelId: string,
): string {
    return `${alias}/${upstreamModelId}`;
}

// ---------------------------------------------------------------------------
// Wire types (subset of 9router's response shape that we rely on)
// ---------------------------------------------------------------------------

export interface NineRouterConnection {
    id: string;
    provider: string; // 9router provider id, e.g. "claude"
    authType: "oauth" | "apikey" | "cookie" | "access_token";
    email?: string;
    displayName?: string;
    isActive: boolean;
    testStatus?: string;
    lastError?: string;
    expiresAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface NineRouterAuthorizeData {
    url: string;
    state?: string;
    codeVerifier?: string;
    codeChallenge?: string;
}

export interface NineRouterExchangeConnection {
    id: string;
    provider: string;
    email?: string;
    displayName?: string;
}

export interface NineRouterExchangeResult {
    success: boolean;
    connection?: NineRouterExchangeConnection;
    error?: string;
}

export interface NineRouterQuotaWindow {
    used: number;
    total: number;
    remaining?: number;
    remainingPercentage?: number;
    resetAt?: string | null;
    unlimited?: boolean;
}

export interface NineRouterUsageResult {
    plan?: string;
    message?: string;
    quotas?: Record<string, NineRouterQuotaWindow>;
}

export interface NineRouterApiKey {
    id: string;
    name: string;
    machineId?: string;
}

export interface NineRouterCreatedApiKey extends NineRouterApiKey {
    key: string; // plaintext, shown once — caller must persist it
}

export class NineRouterError extends Error {
    readonly status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = "NineRouterError";
        this.status = status;
    }
}

// ---------------------------------------------------------------------------
// Light runtime validation (type guards) for JSON coming back over HTTP.
// No `as` casts: every field is read defensively with typeof checks so a
// 9router version bump that renames/drops a field degrades to "field
// missing" rather than a bad cast. See exception (b) in
// .rework/ORCHESTRATION.md's forbidden-feature policy — this is the
// alternative to it: validate-and-narrow via guards instead of `as`.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function readNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value)
        ? value
        : undefined;
}

function toConnection(value: unknown): NineRouterConnection | undefined {
    if (!isRecord(value)) return undefined;
    const id = readString(value.id);
    const provider = readString(value.provider);
    const authType = readString(value.authType);
    if (!id || !provider || !authType) return undefined;
    // authType is validated against the known union below; anything else
    // (a future 9router auth kind) is dropped rather than mis-typed.
    if (
        authType !== "oauth" &&
        authType !== "apikey" &&
        authType !== "cookie" &&
        authType !== "access_token"
    ) {
        return undefined;
    }
    return {
        id,
        provider,
        authType,
        email: readString(value.email),
        displayName: readString(value.displayName),
        isActive: readBoolean(value.isActive, true),
        testStatus: readString(value.testStatus),
        lastError: readString(value.lastError),
        expiresAt: readString(value.expiresAt) ?? null,
        createdAt: readString(value.createdAt),
        updatedAt: readString(value.updatedAt),
    };
}

function toQuotaWindow(value: unknown): NineRouterQuotaWindow | undefined {
    if (!isRecord(value)) return undefined;
    const used = readNumber(value.used);
    const total = readNumber(value.total);
    if (used === undefined || total === undefined) return undefined;
    return {
        used,
        total,
        remaining: readNumber(value.remaining),
        remainingPercentage: readNumber(value.remainingPercentage),
        resetAt: readString(value.resetAt) ?? null,
        unlimited: readBoolean(value.unlimited, false),
    };
}

function toUsageResult(value: unknown): NineRouterUsageResult {
    if (!isRecord(value)) return {};
    const quotasValue = value.quotas;
    let quotas: Record<string, NineRouterQuotaWindow> | undefined;
    if (isRecord(quotasValue)) {
        quotas = {};
        for (const [windowName, windowValue] of Object.entries(quotasValue)) {
            const parsed = toQuotaWindow(windowValue);
            if (parsed) quotas[windowName] = parsed;
        }
    }
    return {
        plan: readString(value.plan),
        message: readString(value.message),
        quotas,
    };
}

/**
 * Picks the connection 9router should be treated as "the" active account
 * for a given provider id. Chorus's frozen IProviderAccount contract is
 * single-account-per-provider (see .rework/PROGRESS.md decisions log); if
 * 9router has multiple active connections for the same provider (it
 * supports round-robin multi-account), we deterministically pick the most
 * recently updated one rather than an arbitrary array position.
 */
export function findActiveConnectionForProvider(
    connections: NineRouterConnection[],
    nineRouterProviderId: string,
): NineRouterConnection | undefined {
    const matches = connections.filter(
        (c) => c.provider === nineRouterProviderId && c.isActive,
    );
    if (matches.length === 0) return undefined;
    return matches.reduce((latest, candidate) =>
        (candidate.updatedAt ?? "") > (latest.updatedAt ?? "")
            ? candidate
            : latest,
    );
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class NineRouterClient {
    constructor(
        private readonly baseUrl: string = NINEROUTER_BASE_URL,
        private readonly fetchImpl: FetchLike = tauriFetch,
    ) {}

    private async request(
        path: string,
        init?: { method?: string; body?: unknown },
    ): Promise<unknown> {
        let response: Response;
        try {
            response = await this.fetchImpl(`${this.baseUrl}${path}`, {
                method: init?.method ?? "GET",
                headers: init?.body
                    ? { "Content-Type": "application/json" }
                    : undefined,
                body: init?.body ? JSON.stringify(init.body) : undefined,
            });
        } catch (error) {
            throw new NineRouterError(
                `9router request failed (network): ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }

        let json: unknown = undefined;
        try {
            json = await response.json();
        } catch {
            // Non-JSON body (e.g. empty 204) — leave json undefined.
        }

        if (!response.ok) {
            const message =
                isRecord(json) && readString(json.error)
                    ? readString(json.error)
                    : `9router returned ${response.status}`;
            throw new NineRouterError(message ?? "9router request failed", response.status);
        }

        return json;
    }

    /** GET /api/health — cheapest way to detect a running instance on :20128. */
    async healthCheck(): Promise<boolean> {
        try {
            const json = await this.request("/api/health");
            return isRecord(json) && readBoolean(json.ok, false);
        } catch {
            return false;
        }
    }

    /** GET /api/providers — all connections, secrets stripped. */
    async listConnections(): Promise<NineRouterConnection[]> {
        const json = await this.request("/api/providers");
        if (!isRecord(json) || !Array.isArray(json.connections)) return [];
        const parsed: NineRouterConnection[] = [];
        for (const entry of json.connections) {
            const connection = toConnection(entry);
            if (connection) parsed.push(connection);
        }
        return parsed;
    }

    /** DELETE /api/providers/:id — this is 9router's "disconnect". */
    async deleteConnection(connectionId: string): Promise<void> {
        await this.request(`/api/providers/${encodeURIComponent(connectionId)}`, {
            method: "DELETE",
        });
    }

    /**
     * GET /api/oauth/:provider/authorize — generates the URL to open in the
     * system browser plus the PKCE state 9router expects back at exchange.
     */
    async getAuthorizeUrl(
        nineRouterProviderId: string,
        redirectUri: string,
    ): Promise<NineRouterAuthorizeData> {
        const json = await this.request(
            `/api/oauth/${encodeURIComponent(nineRouterProviderId)}/authorize?redirect_uri=${encodeURIComponent(redirectUri)}`,
        );
        const url = isRecord(json) ? readString(json.url) : undefined;
        if (!url) {
            throw new NineRouterError(
                `9router did not return an authorize URL for provider "${nineRouterProviderId}"`,
            );
        }
        return {
            url,
            state: isRecord(json) ? readString(json.state) : undefined,
            codeVerifier: isRecord(json) ? readString(json.codeVerifier) : undefined,
            codeChallenge: isRecord(json)
                ? readString(json.codeChallenge)
                : undefined,
        };
    }

    /**
     * POST /api/oauth/:provider/exchange — completes the PKCE round trip and
     * saves the resulting connection inside 9router (Chorus never sees the
     * token itself).
     */
    async exchangeCode(
        nineRouterProviderId: string,
        params: {
            code: string;
            redirectUri: string;
            codeVerifier?: string;
            state?: string;
        },
    ): Promise<NineRouterExchangeResult> {
        const json = await this.request(
            `/api/oauth/${encodeURIComponent(nineRouterProviderId)}/exchange`,
            { method: "POST", body: params },
        );
        if (!isRecord(json)) {
            return { success: false, error: "Malformed exchange response" };
        }
        const success = readBoolean(json.success, false);
        const connectionValue = json.connection;
        let connection: NineRouterExchangeConnection | undefined;
        if (isRecord(connectionValue)) {
            const id = readString(connectionValue.id);
            const provider = readString(connectionValue.provider);
            if (id && provider) {
                connection = {
                    id,
                    provider,
                    email: readString(connectionValue.email),
                    displayName: readString(connectionValue.displayName),
                };
            }
        }
        return { success, connection, error: readString(json.error) };
    }

    /** GET /api/usage/:connectionId — per-connection quota/usage. */
    async getUsage(connectionId: string): Promise<NineRouterUsageResult> {
        const json = await this.request(
            `/api/usage/${encodeURIComponent(connectionId)}`,
        );
        return toUsageResult(json);
    }

    /** GET /api/keys — Chorus's own 9router-issued API keys (no secrets on list). */
    async listApiKeys(): Promise<NineRouterApiKey[]> {
        const json = await this.request("/api/keys");
        if (!isRecord(json) || !Array.isArray(json.keys)) return [];
        const parsed: NineRouterApiKey[] = [];
        for (const entry of json.keys) {
            if (!isRecord(entry)) continue;
            const id = readString(entry.id);
            const name = readString(entry.name);
            if (!id || !name) continue;
            parsed.push({ id, name, machineId: readString(entry.machineId) });
        }
        return parsed;
    }

    /**
     * POST /api/keys — creates a new key. The plaintext `key` is shown only
     * in this response; the caller (P5/P6) is responsible for persisting it
     * (e.g. app_metadata) since 9router will never return it again.
     */
    async createApiKey(name: string): Promise<NineRouterCreatedApiKey> {
        const json = await this.request("/api/keys", {
            method: "POST",
            body: { name },
        });
        const key = isRecord(json) ? readString(json.key) : undefined;
        const id = isRecord(json) ? readString(json.id) : undefined;
        const returnedName = isRecord(json) ? readString(json.name) : undefined;
        if (!key || !id || !returnedName) {
            throw new NineRouterError("9router did not return a usable API key");
        }
        return {
            key,
            id,
            name: returnedName,
            machineId: isRecord(json) ? readString(json.machineId) : undefined,
        };
    }
}

/** Shared singleton, mirroring the OllamaClient/ollamaClient precedent. */
export const nineRouterClient = new NineRouterClient();

/** Convenience wrapper for lifecycle checks (P3). */
export async function detectNineRouter(): Promise<boolean> {
    return nineRouterClient.healthCheck();
}
