import {
    FLEET_SUPERVISOR_LABEL,
    FLEET_SUPERVISOR_TONE,
    FLEET_TICKET_WORKER_CHIP_STATUSES,
} from "@core/chorus/fleet/copy";
import { formatFeatureBadge, formatTicketMeta } from "@core/chorus/fleet/worktreeFormat";
import { IFeature, ITicket } from "@core/chorus/fleet/protocol";
import { cn } from "@ui/lib/utils";
import { FleetStatusDot } from "./FleetStatusDot";
import { FLEET_TONE_TEXT_CLASS } from "./fleetTone";

/** One feature branch + its ticket worktrees + on-demand supervisor — design/fleet.md's Worktrees tree. */
export function FeatureCard({ feature, now }: { feature: IFeature; now: Date }) {
    const badge = formatFeatureBadge(feature);
    const supervisorTone = FLEET_SUPERVISOR_TONE[feature.supervisor.state];

    return (
        <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2">
                <FleetStatusDot tone={badge.tone} />
                <span
                    className="truncate font-geist-mono text-xs text-muted-foreground"
                    title={feature.branch}
                >
                    {feature.branch}
                </span>
                <span className="truncate text-sm text-foreground">
                    {feature.title}
                </span>
                <span
                    className={cn(
                        "ml-auto shrink-0 font-geist-mono text-[11px]",
                        FLEET_TONE_TEXT_CLASS[badge.tone],
                    )}
                >
                    {badge.text}
                </span>
            </div>

            <div className="mt-2 flex flex-col gap-1.5 border-l border-border pl-3">
                {feature.tickets.map((ticket) => (
                    <TicketRow key={ticket.id} ticket={ticket} now={now} />
                ))}
            </div>

            <div className="mt-2 flex items-center gap-2 border-l border-border pl-3 text-xs">
                <FleetStatusDot
                    tone={supervisorTone}
                    pulse={feature.supervisor.state === "reviewing"}
                />
                <span className="shrink-0 text-foreground">
                    Supervisor: {FLEET_SUPERVISOR_LABEL[feature.supervisor.state]}
                </span>
                <span className="truncate text-muted-foreground">
                    — {feature.supervisor.note}
                </span>
            </div>
        </div>
    );
}

function TicketRow({ ticket, now }: { ticket: ITicket; now: Date }) {
    const meta = formatTicketMeta(ticket, now);
    const showWorkerChip = FLEET_TICKET_WORKER_CHIP_STATUSES.includes(
        ticket.status,
    );

    return (
        <div className="flex items-center gap-2 text-xs">
            <FleetStatusDot tone={meta.tone} />
            <span className="shrink-0 text-muted-foreground">{ticket.id}</span>
            <span
                className="truncate font-geist-mono text-[11px] text-muted-foreground"
                title={ticket.worktreePath}
            >
                {ticket.worktreePath}
            </span>
            {showWorkerChip && (
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                    <FleetStatusDot tone="success" className="!size-1" />
                    Worker
                </span>
            )}
            <span
                className={cn(
                    "ml-auto shrink-0 font-geist-mono text-[11px]",
                    FLEET_TONE_TEXT_CLASS[meta.tone],
                )}
            >
                {meta.text}
            </span>
        </div>
    );
}
