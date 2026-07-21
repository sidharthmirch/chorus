import { IQuotaSnapshot, formatQuotaLabel } from "@core/chorus/accounts/ProviderAccounts";
import { cn } from "@ui/lib/utils";
import { quotaBarFillClassName } from "./providerAccountDisplay";

/**
 * The 4px quota meter used on provider cards (design/settings.md,
 * design/accounts-oauth.md "UI Surfaces"). Also reusable by W4's model rows
 * (model-select.md specs a narrower 58px variant of the same bar) —
 * `className` controls width, defaults to full width for the account card.
 *
 * Not built on the shared `ui/progress.tsx` Radix primitive: that
 * component's fill color is hardcoded to `bg-foreground` with no per-level
 * color hook, and this bar needs to switch between `success`/`warning`
 * fills plus a mono label underneath — a plain div meter is simpler than
 * forking a shared primitive for one prop it doesn't support.
 */
export function QuotaBar({
    quota,
    className,
    showLabel = true,
}: {
    quota: IQuotaSnapshot | undefined;
    className?: string;
    showLabel?: boolean;
}) {
    if (!quota) {
        return null;
    }

    const percent = Math.round(quota.usedFraction * 100);

    return (
        <div className={cn("flex flex-col gap-1", className)}>
            <div
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-1 w-full overflow-hidden rounded-full bg-muted"
            >
                <div
                    className={cn(
                        "h-full rounded-full transition-all",
                        quotaBarFillClassName(quota.level),
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                />
            </div>
            {showLabel && (
                <span className="font-geist-mono text-xs text-muted-foreground">
                    {formatQuotaLabel(quota)}
                </span>
            )}
        </div>
    );
}
