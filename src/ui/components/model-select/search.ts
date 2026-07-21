import type { ProviderName } from "@core/chorus/Models";

/**
 * Model-catalog search/relevance scoring — ported verbatim (logic-for-logic)
 * from the pre-rework `ManageModelsBox.tsx` so the new `model-select/**`
 * module and `QuickChatModelSelector` share exactly one search
 * implementation (docs/rework/w4-model-select-inventory.md §2 flags that
 * the two previously disagreed: `ManageModelsBox` used this scorer,
 * `QuickChatModelSelector` used cmdk's built-in fuzzy filter).
 *
 * Deliberately has ZERO runtime dependency on `Models.ts` (only a
 * type-only import, elided at build time) so it stays unit-testable under
 * this repo's vitest setup (`Models.ts` transitively reaches `DB.ts`'s
 * top-level `await Database.load(...)`, which throws without a `window` —
 * same landmine documented in `core/chorus/api/ModelAccountView.ts`).
 * Callers extract `displayName`/`providerLabel`/`modelId`/`providerKey`
 * from their own `ModelConfig`s (via `Models.ts`'s `getProviderName`/
 * `getProviderLabel`, which *are* safe to call at runtime in the real app —
 * only importing them into a vitest file is the problem) and pass plain
 * strings in.
 */

export interface ParsedSearchQuery {
    /** Normalized provider key (e.g. "anthropic"), or null if the query had no `provider:` prefix. */
    providerFilter: string | null;
    modelTerms: string[];
}

export const normalizeSearchValue = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Exhaustiveness helper: keeps a curated provider-prefix list honest against
 * `Models.ts`'s `ProviderName` union at compile time (a missing provider
 * fails the build, not silently). Only used for its TYPE parameter — no
 * runtime dependency on `Models.ts`.
 */
export const ensureKnownProvidersExhaustive = <T extends readonly ProviderName[]>(
    providers: T &
        (Exclude<ProviderName, T[number]> extends never
            ? unknown
            : "KNOWN_PROVIDERS must include every ProviderName"),
): T => providers;

/** Curated list aligned with `ProviderName` for `provider:` prefix search parsing. */
export const KNOWN_PROVIDERS = ensureKnownProvidersExhaustive([
    "anthropic",
    "openai",
    "google",
    "perplexity",
    "grok",
    "ollama",
    "lmstudio",
    "openrouter",
    "meta",
] as const);

/**
 * Parses `"provider:term term2"` syntax. `knownProviders` is injected
 * (rather than reading the module constant directly) purely so this stays
 * generic; in practice callers pass `KNOWN_PROVIDERS`.
 */
export function parseSearchQuery(
    query: string,
    knownProviders: readonly string[] = KNOWN_PROVIDERS,
): ParsedSearchQuery {
    const colonIndex = query.indexOf(":");
    if (colonIndex !== -1) {
        const potentialProvider = normalizeSearchValue(query.slice(0, colonIndex));
        if (potentialProvider.length > 0) {
            // Exact match first
            const exactMatch = knownProviders.find((p) => p === potentialProvider);
            if (exactMatch) {
                const remainder = query.slice(colonIndex + 1).toLowerCase();
                const modelTerms = remainder.split(" ").filter(Boolean);
                return { providerFilter: exactMatch, modelTerms };
            }
            // Unambiguous prefix match
            const prefixMatches = knownProviders.filter((p) =>
                p.startsWith(potentialProvider),
            );
            if (prefixMatches.length === 1) {
                const remainder = query.slice(colonIndex + 1).toLowerCase();
                const modelTerms = remainder.split(" ").filter(Boolean);
                return { providerFilter: prefixMatches[0], modelTerms };
            }
        }
    }
    const modelTerms = query.toLowerCase().split(" ").filter(Boolean);
    return { providerFilter: null, modelTerms };
}

/** Returns a match score > 0 if term matches haystack, 0 for no match. */
export function scoreMatch(term: string, haystack: string): number {
    if (!term) return 100;

    // Exact substring match
    if (haystack.includes(term)) return 100;

    // Word-boundary match: term matches the start of any whitespace-separated word
    const words = haystack.split(/[\s\-_.:/]+/);
    if (words.some((word) => word.startsWith(term))) return 80;

    const normalizedTerm = normalizeSearchValue(term);
    const normalizedHaystack = normalizeSearchValue(haystack);

    if (!normalizedTerm) return 0;

    // For purely numeric terms, require contiguous match in number groups
    if (/^\d+$/.test(normalizedTerm)) {
        const numberGroups = normalizedHaystack.match(/\d+/g) ?? [];
        const contiguous = numberGroups.some(
            (group) => group === normalizedTerm || group.startsWith(normalizedTerm),
        );
        return contiguous ? 60 : 0;
    }

    // Normalized substring match (strip non-alphanumeric)
    if (normalizedHaystack.includes(normalizedTerm)) return 60;

    return 0;
}

/**
 * Generic, model-shape-agnostic relevance filter+sort. Callers supply
 * `getHaystack`/`getProviderKey` extractors (backed by `Models.ts`'s
 * `getProviderLabel`/`getProviderName` in real usage) so this module never
 * needs to import model types at runtime.
 */
export function filterBySearch<T>(
    items: T[],
    modelTerms: string[],
    providerFilter: string | null,
    getHaystack: (item: T) => string,
    getProviderKey: (item: T) => string,
): T[] {
    if (modelTerms.length === 0 && providerFilter === null) return items;

    // Compute score once per item to avoid redundant work in the sort comparator
    const scored = items.reduce<{ item: T; score: number }[]>((acc, item) => {
        if (providerFilter !== null && getProviderKey(item) !== providerFilter) {
            return acc;
        }

        if (modelTerms.length === 0) {
            acc.push({ item, score: 0 });
            return acc;
        }

        const haystack = getHaystack(item).toLowerCase();
        const termScores = modelTerms.map((term) => scoreMatch(term, haystack));

        if (termScores.some((s) => s <= 0)) return acc;

        acc.push({
            item,
            score: termScores.reduce((total, s) => total + s, 0),
        });
        return acc;
    }, []);

    if (modelTerms.length > 0) {
        scored.sort((a, b) => b.score - a.score);
    }

    return scored.map(({ item }) => item);
}
