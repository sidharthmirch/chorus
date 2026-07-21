import { describe, expect, it } from "vitest";
import { IProviderAccount, makeQuotaSnapshot } from "@core/chorus/accounts/ProviderAccounts";
import {
    authKindBadgeLabel,
    quotaBarFillClassName,
    statusDotClassName,
    statusText,
} from "./providerAccountDisplay";

describe("authKindBadgeLabel", () => {
    it("maps every known auth kind to its badge copy", () => {
        expect(authKindBadgeLabel("oauth")).toBe("OAuth");
        expect(authKindBadgeLabel("api-key")).toBe("API key");
        expect(authKindBadgeLabel("none-local")).toBe("Local");
    });
});

describe("statusText", () => {
    it("maps every known status to display copy", () => {
        expect(statusText("connected")).toBe("Connected");
        expect(statusText("needs-auth")).toBe("Needs authorization");
        expect(statusText("expired")).toBe("Access expired");
        expect(statusText("error")).toBe("Connection error");
        expect(statusText("not-configured")).toBe("Not connected");
    });
});

function account(overrides: Partial<IProviderAccount>): IProviderAccount {
    return {
        providerId: "anthropic",
        authKind: "oauth",
        label: "oauth · Anthropic",
        status: "not-configured",
        ...overrides,
    };
}

describe("statusDotClassName", () => {
    it("is success-green when connected with ok quota", () => {
        expect(
            statusDotClassName(
                account({ status: "connected", quota: makeQuotaSnapshot(0.5) }),
            ),
        ).toBe("bg-success");
    });

    it("is warning-amber when connected with warn-level quota", () => {
        expect(
            statusDotClassName(
                account({ status: "connected", quota: makeQuotaSnapshot(0.9) }),
            ),
        ).toBe("bg-warning");
    });

    it("is success-green when connected with no quota data at all (e.g. api-key providers)", () => {
        expect(statusDotClassName(account({ status: "connected" }))).toBe(
            "bg-success",
        );
    });

    it("is destructive-red for expired, error, and needs-auth", () => {
        expect(statusDotClassName(account({ status: "expired" }))).toBe(
            "bg-destructive",
        );
        expect(statusDotClassName(account({ status: "error" }))).toBe(
            "bg-destructive",
        );
        expect(statusDotClassName(account({ status: "needs-auth" }))).toBe(
            "bg-destructive",
        );
    });

    it("is gray/helper for not-configured", () => {
        expect(statusDotClassName(account({ status: "not-configured" }))).toBe(
            "bg-helper",
        );
    });
});

describe("quotaBarFillClassName", () => {
    it("maps ok/warn levels to success/warning fill colors", () => {
        expect(quotaBarFillClassName("ok")).toBe("bg-success");
        expect(quotaBarFillClassName("warn")).toBe("bg-warning");
    });
});
