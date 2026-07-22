import { useState } from "react";
import { ArrowRightIcon, PauseIcon, PlayIcon } from "lucide-react";
import {
    useDispatchSession,
    usePauseSession,
    useResumeSession,
} from "@core/chorus/fleet/useFleet";
import { IKanbanCard, IMachine } from "@core/chorus/fleet/protocol";
import { FLEET_REVIEW_BADGE_TEXT } from "@core/chorus/fleet/copy";
import { Badge } from "@ui/components/ui/badge";
import { Button } from "@ui/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@ui/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui/components/ui/tooltip";
import { cn } from "@ui/lib/utils";
import { AgentBadge } from "./AgentBadge";
import { FleetProgressBar } from "./FleetProgressBar";
import { FLEET_TONE_TEXT_CLASS } from "./fleetTone";

/** Card anatomy per docs/rework/design/fleet.md's Component Inventory. */
export function KanbanCard({
    card,
    machines,
}: {
    card: IKanbanCard;
    machines: IMachine[];
}) {
    const { session, metaText, metaTone, hasReviewBadge } = card;
    const showBar = session.progressPct !== undefined;
    const showLog = Boolean(session.logTail);

    return (
        <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
            <p className="text-sm text-foreground line-clamp-2">{session.title}</p>

            {/* Header row: agent avatar + name + machine, action icon at the far right. */}
            <div className="mt-1.5 flex items-center gap-2">
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
                    <AgentBadge agent={session.agent} />
                    <span className="truncate">· {session.machine}</span>
                </span>
                <CardAction card={card} machines={machines} />
            </div>

            <p
                className="mt-1 truncate font-geist-mono text-[11px] text-muted-foreground"
                title={session.branch}
            >
                {session.branch}
            </p>

            {showBar && (
                <div className="mt-2 flex items-center gap-2">
                    <FleetProgressBar
                        pct={session.progressPct ?? 0}
                        tone={metaTone}
                        className="flex-1"
                    />
                    <span className="shrink-0 font-geist-mono text-[11px] tabular-nums text-muted-foreground">
                        {Math.round(session.progressPct ?? 0)}%
                    </span>
                </div>
            )}

            {showLog && (
                <p className="mt-1.5 truncate font-geist-mono text-xs text-muted-foreground">
                    {session.logTail}
                </p>
            )}

            <div className="mt-1.5 flex items-center gap-2">
                <span
                    className={cn(
                        "font-geist-mono text-[11px] tabular-nums",
                        FLEET_TONE_TEXT_CLASS[metaTone],
                    )}
                >
                    {metaText}
                </span>
                {session.paused && (
                    <span className="font-geist-mono text-[11px] text-muted-foreground">
                        paused
                    </span>
                )}
                {hasReviewBadge && (
                    <Badge variant="outline" className="text-muted-foreground">
                        {FLEET_REVIEW_BADGE_TEXT}
                    </Badge>
                )}
            </div>
        </div>
    );
}

function CardAction({
    card,
    machines,
}: {
    card: IKanbanCard;
    machines: IMachine[];
}) {
    const { session } = card;
    const dispatchSession = useDispatchSession();
    const pauseSession = usePauseSession();
    const resumeSession = useResumeSession();
    const [pickerOpen, setPickerOpen] = useState(false);

    if (session.status === "queued") {
        return (
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                size="iconSm"
                                aria-label="Dispatch to a machine"
                            >
                                <ArrowRightIcon strokeWidth={1.5} className="!size-3.5" />
                            </Button>
                        </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Dispatch</TooltipContent>
                </Tooltip>
                <PopoverContent align="end" className="w-56 p-1.5">
                    <p className="px-1.5 py-1 sidebar-label text-muted-foreground">
                        Dispatch to
                    </p>
                    {machines.length === 0 && (
                        <p className="px-1.5 py-1 text-sm text-muted-foreground">
                            No machines available.
                        </p>
                    )}
                    {machines.map((machine) => (
                        <button
                            key={machine.id}
                            onClick={() => {
                                setPickerOpen(false);
                                dispatchSession.mutate({
                                    sessionId: session.id,
                                    machineId: machine.id,
                                });
                            }}
                            disabled={
                                dispatchSession.isPending ||
                                machine.status === "offline"
                            }
                            className="flex w-full items-center justify-between rounded px-1.5 py-1 text-left text-sm hover:bg-muted disabled:opacity-50"
                        >
                            <span>{machine.name}</span>
                            <span className="font-geist-mono text-[11px] text-muted-foreground">
                                {machine.load.current}/{machine.load.max}
                            </span>
                        </button>
                    ))}
                </PopoverContent>
            </Popover>
        );
    }

    if (session.status === "running") {
        const isPaused = Boolean(session.paused);
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="iconSm"
                        aria-label={isPaused ? "Resume" : "Pause"}
                        disabled={pauseSession.isPending || resumeSession.isPending}
                        onClick={() =>
                            isPaused
                                ? resumeSession.mutate(session.id)
                                : pauseSession.mutate(session.id)
                        }
                    >
                        {isPaused ? (
                            <PlayIcon strokeWidth={1.5} className="!size-3.5" />
                        ) : (
                            <PauseIcon strokeWidth={1.5} className="!size-3.5" />
                        )}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>{isPaused ? "Resume" : "Pause"}</TooltipContent>
            </Tooltip>
        );
    }

    return null;
}
