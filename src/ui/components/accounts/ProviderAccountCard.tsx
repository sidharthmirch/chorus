import {
    IProviderAccount,
    PROVIDER_ACCOUNT_DISPLAY_NAMES,
    ProviderAccountId,
} from "@core/chorus/accounts/ProviderAccounts";
import { ProviderLogo, ProviderLogoProps } from "@ui/components/ui/provider-logo";
import { Badge } from "@ui/components/ui/badge";
import { Button } from "@ui/components/ui/button";
import { cn } from "@ui/lib/utils";
import { RiGithubFill } from "react-icons/ri";
import { authKindBadgeLabel, statusDotClassName, statusText } from "./providerAccountDisplay";
import { QuotaBar } from "./QuotaBar";

/**
 * ProviderAccountId values that map directly onto ProviderLogo's
 * ProviderName union (the models-catalog icon set). "copilot" has no entry
 * there — see `ProviderIcon` below for the self-contained fallback.
 */
const LOGO_PROVIDER_MAP: Partial<
    Record<ProviderAccountId, ProviderLogoProps["provider"]>
> = {
    anthropic: "anthropic",
    openai: "openai",
    google: "google",
    openrouter: "openrouter",
    local: "ollama",
};

function ProviderIcon({ providerId }: { providerId: ProviderAccountId }) {
    const mapped = LOGO_PROVIDER_MAP[providerId];
    if (mapped) {
        return <ProviderLogo provider={mapped} size="lg" />;
    }
    // GitHub Copilot isn't in the models-catalog ProviderLogo set (that
    // component maps model providers, not account providers) — kept as a
    // local fallback so this card stays self-contained rather than editing
    // a shared ui/ primitive other workstreams also touch.
    return (
        <div className="flex h-8 w-8 items-center justify-center">
            <RiGithubFill className="h-6 w-6" />
        </div>
    );
}

export interface ProviderAccountCardProps {
    account: IProviderAccount;
    /** Start a fresh connect, or re-run auth for an expired/errored account. */
    onConnect?: () => void;
    onManage?: () => void;
    onDisconnect?: () => void;
    /** True while a connect/disconnect/refresh mutation for this account is in flight. */
    isBusy?: boolean;
    className?: string;
}

/**
 * Reference implementation of the Accounts provider card
 * (docs/rework/design/settings.md "Provider cards" anatomy: avatar, name,
 * oauth badge, email/status detail line, quota bar + mono label,
 * Connect/Manage/Disconnect buttons). W1 owns this as a standalone,
 * self-contained component — per docs/rework/agents/W1-provider-oauth.md
 * "UI note", W3 mounts it inside the real Accounts settings section; this
 * workstream does not wire it into Settings.tsx itself.
 */
export function ProviderAccountCard({
    account,
    onConnect,
    onManage,
    onDisconnect,
    isBusy = false,
    className,
}: ProviderAccountCardProps) {
    const name = PROVIDER_ACCOUNT_DISPLAY_NAMES[account.providerId];
    const detailLine = account.accountEmail ?? statusText(account.status);
    const needsAuth =
        account.status === "expired" ||
        account.status === "needs-auth" ||
        account.status === "error";

    return (
        <div
            className={cn(
                "flex min-h-[160px] w-full max-w-[280px] flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm",
                className,
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-hidden">
                    <span
                        className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            statusDotClassName(account),
                        )}
                        aria-hidden
                    />
                    <span className="truncate text-sm font-medium">{name}</span>
                </div>
                <Badge variant="outline" className="shrink-0">
                    {authKindBadgeLabel(account.authKind)}
                </Badge>
            </div>

            <div className="flex flex-1 items-center justify-center py-1">
                <ProviderIcon providerId={account.providerId} />
            </div>

            <p
                className="truncate text-xs text-muted-foreground"
                title={detailLine}
            >
                {detailLine}
            </p>

            <QuotaBar quota={account.quota} />

            <div className="flex items-center justify-end gap-1.5">
                {account.status === "not-configured" && onConnect && (
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={onConnect}
                        disabled={isBusy}
                    >
                        Connect
                    </Button>
                )}
                {needsAuth && onConnect && (
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={onConnect}
                        disabled={isBusy}
                    >
                        Reauthorize
                    </Button>
                )}
                {account.status === "connected" && onManage && (
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={onManage}
                        disabled={isBusy}
                    >
                        Manage
                    </Button>
                )}
                {account.status === "connected" && onDisconnect && (
                    <Button
                        variant="destructive"
                        size="xs"
                        onClick={onDisconnect}
                        disabled={isBusy}
                    >
                        Disconnect
                    </Button>
                )}
            </div>
        </div>
    );
}
