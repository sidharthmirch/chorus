/**
 * Core types + pure helpers for the Accounts / provider-OAuth-forward feature
 * (W1). Frozen shape per docs/rework/00-ARCHITECTURE.md §4.1 — consumed by
 * `api/ProviderAccountsAPI.ts` and, downstream, by W3 (Accounts settings),
 * W4 (model rows/popover), W6 (composer), W7 (quota-aware fallback).
 *
 * Do not add fields here without updating 00-ARCHITECTURE.md §4.1 and
 * flagging the change in your PR — this is the frozen consumer contract.
 */

/**
 * Provider identifiers for accounts that can be connected via OAuth-forward
 * (subscription forwarding through 9router) or another auth kind. Distinct
 * from `ModelProviders`' `ProviderName` (models catalog) — see
 * docs/rework/w1-provider-notes.md §3 for the full id/alias mapping this
 * bridges to on the 9router side.
 */
export type ProviderAccountId =
    | "anthropic"
    | "openai"
    | "google"
    | "copilot"
    | "openrouter"
    | "local";

export type ProviderAuthKind = "oauth" | "api-key" | "none-local";

export type ProviderAccountStatus =
    | "connected"
    | "needs-auth"
    | "expired"
    | "error"
    | "not-configured";

export type QuotaLevel = "ok" | "warn";

/**
 * Fraction (0..1) at or above which a quota snapshot is considered "warn".
 * Named constant per docs/rework/00-ARCHITECTURE.md §4.3 / design/accounts-oauth.md.
 */
export const QUOTA_WARN_THRESHOLD = 0.8;

export interface IQuotaSnapshot {
    usedFraction: number; // 0..1
    resetsAt?: Date; // undefined => no known reset window (e.g. pay-per-use)
    level: QuotaLevel; // "warn" when usedFraction >= QUOTA_WARN_THRESHOLD
}

export interface IProviderAccount {
    providerId: ProviderAccountId;
    authKind: ProviderAuthKind;
    label: string; // e.g. "oauth · max 20x", "api key", "ollama · detected"
    accountEmail?: string;
    status: ProviderAccountStatus;
    quota?: IQuotaSnapshot;
}

/** Derives the display level for a used-fraction value. */
export function deriveQuotaLevel(usedFraction: number): QuotaLevel {
    return usedFraction >= QUOTA_WARN_THRESHOLD ? "warn" : "ok";
}

/** Builds a well-formed IQuotaSnapshot, clamping usedFraction to [0, 1]. */
export function makeQuotaSnapshot(
    usedFraction: number,
    resetsAt?: Date,
): IQuotaSnapshot {
    const clamped = Math.min(1, Math.max(0, usedFraction));
    return {
        usedFraction: clamped,
        resetsAt,
        level: deriveQuotaLevel(clamped),
    };
}

/**
 * Human-readable display names for provider accounts, used by the
 * `ProviderAccountCard` reference component and anywhere else a label is
 * needed without pulling in the full models catalog.
 */
export const PROVIDER_ACCOUNT_DISPLAY_NAMES: Record<ProviderAccountId, string> =
    {
        anthropic: "Anthropic",
        openai: "OpenAI",
        google: "Google AI",
        copilot: "GitHub Copilot",
        openrouter: "OpenRouter",
        local: "Local",
    };

/**
 * Formats the time remaining until `resetsAt` as a short countdown label
 * ("45m", "3h", "1d") for the "62% · resets 3h" style copy specified in
 * `IQuotaSnapshot`'s own doc comment / docs/rework/design/accounts-oauth.md.
 * `now` is injectable for deterministic tests. Returns undefined when there
 * is no reset window (e.g. pay-per-use) or the window has already elapsed
 * (callers should treat that as "now"/refresh-pending, not display a label).
 */
export function formatQuotaResetWindow(
    resetsAt: Date | undefined,
    now: Date = new Date(),
): string | undefined {
    if (!resetsAt) return undefined;
    const diffMs = resetsAt.getTime() - now.getTime();
    if (diffMs <= 0) return undefined;

    const diffMinutes = Math.round(diffMs / (60 * 1000));
    if (diffMinutes < 60) return `${Math.max(1, diffMinutes)}m`;

    const diffHours = Math.round(diffMs / (60 * 60 * 1000));
    if (diffHours < 24) return `${diffHours}h`;

    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
    return `${diffDays}d`;
}

/**
 * Formats a quota snapshot into the "62% · resets 3h" label used on quota
 * bars throughout the app (design/accounts-oauth.md, IQuotaSnapshot's doc
 * comment). Falls back to a bare percentage when there's no reset window.
 */
export function formatQuotaLabel(
    quota: IQuotaSnapshot,
    now: Date = new Date(),
): string {
    const percent = Math.round(quota.usedFraction * 100);
    const window = formatQuotaResetWindow(quota.resetsAt, now);
    return window ? `${percent}% · resets ${window}` : `${percent}%`;
}
