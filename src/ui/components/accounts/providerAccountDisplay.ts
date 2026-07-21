import {
    IProviderAccount,
    ProviderAccountStatus,
    ProviderAuthKind,
} from "@core/chorus/accounts/ProviderAccounts";

/**
 * Pure display-mapping helpers for `ProviderAccountCard`. Kept free of JSX
 * so they're unit-testable without a DOM/jsdom environment — see
 * `providerAccountDisplay.test.ts`.
 */

/** Badge copy for the auth-kind pill (design/settings.md: "OAuth" / "API key"). */
export function authKindBadgeLabel(authKind: ProviderAuthKind): string {
    switch (authKind) {
        case "oauth":
            return "OAuth";
        case "api-key":
            return "API key";
        case "none-local":
            return "Local";
        default: {
            const exhaustiveCheck: never = authKind;
            throw new Error(
                `Unhandled auth kind: ${exhaustiveCheck as string}`,
            );
        }
    }
}

/** Human-readable status copy for the detail line when there's no account email. */
export function statusText(status: ProviderAccountStatus): string {
    switch (status) {
        case "connected":
            return "Connected";
        case "needs-auth":
            return "Needs authorization";
        case "expired":
            return "Access expired";
        case "error":
            return "Connection error";
        case "not-configured":
            return "Not connected";
        default: {
            const exhaustiveCheck: never = status;
            throw new Error(`Unhandled status: ${exhaustiveCheck as string}`);
        }
    }
}

/**
 * Tailwind background-color class for the small status dot. Design
 * semantics (design/accounts-oauth.md "OAuth Badge Semantics"): green when
 * authenticated with quota ok, amber when authenticated with quota warn,
 * red when not authenticated or errored, gray when unconfigured.
 */
export function statusDotClassName(account: IProviderAccount): string {
    switch (account.status) {
        case "connected":
            return account.quota?.level === "warn" ? "bg-warning" : "bg-success";
        case "expired":
        case "error":
        case "needs-auth":
            return "bg-destructive";
        case "not-configured":
            return "bg-helper";
        default: {
            const exhaustiveCheck: never = account.status;
            throw new Error(
                `Unhandled status: ${exhaustiveCheck as string}`,
            );
        }
    }
}

/** Tailwind background-color class for the quota bar fill. */
export function quotaBarFillClassName(level: "ok" | "warn"): string {
    return level === "warn" ? "bg-warning" : "bg-success";
}
