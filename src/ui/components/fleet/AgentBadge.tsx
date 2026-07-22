import { agentDisplayName, agentProviderName } from "@core/chorus/fleet/agentDisplay";
import { FleetAgentId } from "@core/chorus/fleet/protocol";
import { ProviderLogo } from "@ui/components/ui/provider-logo";
import { cn } from "@ui/lib/utils";

/**
 * Card anatomy's "Agent avatar (16px, provider color) + agent name (12px)"
 * (design/fleet.md). Uses the existing `ProviderLogo` (`size="sm"` = 16px)
 * instead of a hex-colored letter chip — see `agentDisplay.ts`'s header
 * comment and the PROGRESS.md decisions log for why.
 */
export function AgentBadge({
    agent,
    className,
}: {
    agent: FleetAgentId;
    className?: string;
}) {
    const provider = agentProviderName(agent);
    return (
        <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
            {provider ? (
                <ProviderLogo provider={provider} size="sm" />
            ) : (
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] text-muted-foreground">
                    ?
                </span>
            )}
            <span className="truncate text-sm text-foreground">
                {agentDisplayName(agent)}
            </span>
        </span>
    );
}
