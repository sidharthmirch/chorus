import { useEffect, useState } from "react";
import { useCopyToClipboard } from "usehooks-ts";
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    CopyIcon,
    DownloadIcon,
    ExternalLinkIcon,
    Maximize2Icon,
    Minimize2Icon,
    MoreHorizontalIcon,
    RotateCwIcon,
    ShapesIcon,
    XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@ui/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@ui/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@ui/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@ui/components/ui/tooltip";
import { ProviderLogo } from "@ui/components/ui/provider-logo";
import { CodeBlock } from "@ui/components/renderers/CodeBlock";
import { cn } from "@ui/lib/utils";
import type { ArtifactKind, IArtifact } from "@core/chorus/artifacts/types";
import { getArtifactRenderer } from "./registry";
import { registerDefaultArtifactRenderers } from "./defaultRenderers";
import { downloadArtifact } from "./downloadArtifact";
import { openArtifactInWindow } from "./openArtifactWindow";

// Idempotent — safe to call on every module load (e.g. hot reload).
registerDefaultArtifactRenderers();

export interface IArtifactPanelProps {
    /**
     * Chronologically-ordered artifacts for the current chat-scoped
     * selection (P4 builds this list; P5 sorts it by the source message's
     * own timestamp — see types.ts's note on `IArtifact.createdAt`).
     */
    artifacts: IArtifact[];
    selectedIndex: number;
    onSelectIndex: (index: number) => void;
    onClose: () => void;
    className?: string;
}

const KIND_LABELS: Record<ArtifactKind, string> = {
    html: "HTML preview",
    svg: "SVG graphic",
    mermaid: "Mermaid diagram",
    chart: "Chart",
    table: "Table",
};

function EmptyState({
    className,
    onClose,
}: {
    className?: string;
    onClose: () => void;
}) {
    return (
        <div
            className={cn(
                "flex h-full min-h-0 w-full flex-col bg-sidebar",
                className,
            )}
        >
            <div className="flex h-10 shrink-0 items-center justify-end border-b border-border px-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="iconSm"
                            onClick={onClose}
                            aria-label="Close artifact panel"
                        >
                            <XIcon strokeWidth={1.5} className="!size-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Close artifact panel</TooltipContent>
                </Tooltip>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                <ShapesIcon
                    strokeWidth={1.5}
                    className="size-5 text-muted-foreground"
                />
                <p className="text-sm text-foreground">No artifacts yet</p>
                <p className="max-w-[26ch] text-xs text-muted-foreground">
                    Artifacts appear here when a model writes HTML, SVG, or a
                    Mermaid diagram.
                </p>
            </div>
        </div>
    );
}

function UnsupportedKind({ kind }: { kind: ArtifactKind }) {
    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
            <p className="text-sm">
                {KIND_LABELS[kind]} artifacts aren&rsquo;t previewable yet.
            </p>
        </div>
    );
}

/**
 * Side panel for inline artifacts (docs/rework/design/artifacts.md):
 * header (close, title, model pill, overflow actions, fullscreen) + tabs row
 * (Preview/Code, version stepper) + content (dispatches through
 * `getArtifactRenderer`) . Purely presentational over the `artifacts`/
 * `selectedIndex` props — P4 owns the chat-level state this reads/writes.
 */
export function ArtifactPanel({
    artifacts,
    selectedIndex,
    onSelectIndex,
    onClose,
    className,
}: IArtifactPanelProps) {
    const [tab, setTab] = useState<"preview" | "code">("preview");
    const [fullscreen, setFullscreen] = useState(false);
    const [reloadToken, setReloadToken] = useState(0);
    const [, copyToClipboard] = useCopyToClipboard();

    const clampedIndex =
        artifacts.length === 0
            ? 0
            : Math.min(Math.max(selectedIndex, 0), artifacts.length - 1);
    const current = artifacts[clampedIndex];

    // Reduced-motion users don't get the fullscreen CSS transition (see
    // className below); esc still exits fullscreen either way.
    useEffect(() => {
        if (!fullscreen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setFullscreen(false);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [fullscreen]);

    if (!current) {
        return <EmptyState className={className} onClose={onClose} />;
    }

    const Renderer = getArtifactRenderer(current.kind);
    const hasMultipleVersions = artifacts.length > 1;

    const goToPrevious = () => onSelectIndex(Math.max(0, clampedIndex - 1));
    const goToNext = () =>
        onSelectIndex(Math.min(artifacts.length - 1, clampedIndex + 1));

    const handleCopy = async () => {
        await copyToClipboard(current.code);
        toast.success("Copied artifact code");
    };

    // esc closes the panel when something INSIDE it has focus (relies on
    // ordinary DOM event bubbling from whatever descendant is focused — a
    // sandboxed iframe's own keydowns never reach here at all, since a
    // cross-document boundary doesn't bubble, so this never steals Escape
    // from an artifact that uses it as an in-content key, e.g. a game's
    // pause action). Fullscreen-exit (above) is intentionally separate and
    // window-level, since fullscreen visually covers the whole viewport.
    const handlePanelKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "Escape" && !fullscreen) {
            onClose();
        }
    };

    return (
        <div
            onKeyDown={handlePanelKeyDown}
            className={cn(
                "flex h-full w-full min-h-0 flex-col bg-sidebar motion-reduce:transition-none",
                fullscreen && "fixed inset-0 z-50",
                className,
            )}
        >
            {/* Header (40px) */}
            <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-border px-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="iconSm"
                            onClick={onClose}
                            aria-label="Close artifact panel"
                        >
                            <XIcon strokeWidth={1.5} className="!size-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Close artifact panel</TooltipContent>
                </Tooltip>

                <div className="flex min-w-0 flex-1 items-center gap-1.5 px-1">
                    <span className="truncate text-sm font-medium text-foreground">
                        {current.title}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        <ProviderLogo modelId={current.modelName} size="xs" />
                        <span className="max-w-[7rem] truncate">
                            {current.modelName}
                        </span>
                    </span>
                </div>

                <DropdownMenu>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="iconSm"
                                    aria-label="More actions"
                                >
                                    <MoreHorizontalIcon
                                        strokeWidth={1.5}
                                        className="!size-3.5"
                                    />
                                </Button>
                            </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>More actions</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => void handleCopy()}>
                            <CopyIcon className="mr-2 size-3.5" />
                            Copy code
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={() => void downloadArtifact(current)}
                        >
                            <DownloadIcon className="mr-2 size-3.5" />
                            Download
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={() => void openArtifactInWindow(current)}
                        >
                            <ExternalLinkIcon className="mr-2 size-3.5" />
                            Open in window
                        </DropdownMenuItem>
                        {tab === "preview" && Renderer && (
                            <DropdownMenuItem
                                onSelect={() =>
                                    setReloadToken((token) => token + 1)
                                }
                            >
                                <RotateCwIcon className="mr-2 size-3.5" />
                                Reload preview
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="iconSm"
                            onClick={() => setFullscreen((f) => !f)}
                            aria-label="Toggle fullscreen"
                        >
                            {fullscreen ? (
                                <Minimize2Icon
                                    strokeWidth={1.5}
                                    className="!size-3.5"
                                />
                            ) : (
                                <Maximize2Icon
                                    strokeWidth={1.5}
                                    className="!size-3.5"
                                />
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        {fullscreen ? "Exit fullscreen" : "Fullscreen"}
                    </TooltipContent>
                </Tooltip>
            </div>

            {/* Tabs row (32px) */}
            <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border px-2">
                <Tabs
                    value={tab}
                    onValueChange={(value) =>
                        setTab(value === "code" ? "code" : "preview")
                    }
                >
                    <TabsList className="h-6 gap-0.5 bg-transparent p-0.5">
                        <TabsTrigger
                            value="preview"
                            className="h-5 rounded-sm px-2 text-[11.5px] data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none"
                        >
                            Preview
                        </TabsTrigger>
                        <TabsTrigger
                            value="code"
                            className="h-5 rounded-sm px-2 text-[11.5px] data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none"
                        >
                            Code
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {hasMultipleVersions && (
                    <div className="flex items-center gap-0.5 font-mono text-[11px] text-muted-foreground">
                        <Button
                            variant="ghost"
                            size="iconSm"
                            className="h-6 w-6 px-0"
                            onClick={goToPrevious}
                            disabled={clampedIndex === 0}
                            aria-label="Previous version"
                        >
                            <ChevronLeftIcon className="!size-3" />
                        </Button>
                        <span className="tabular-nums">
                            v{clampedIndex + 1} of {artifacts.length}
                        </span>
                        <Button
                            variant="ghost"
                            size="iconSm"
                            className="h-6 w-6 px-0"
                            onClick={goToNext}
                            disabled={clampedIndex === artifacts.length - 1}
                            aria-label="Next version"
                        >
                            <ChevronRightIcon className="!size-3" />
                        </Button>
                    </div>
                )}
            </div>

            {/* Content (scrollable) */}
            <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
                {tab === "preview" ? (
                    Renderer ? (
                        <Renderer
                            key={current.id}
                            artifact={current}
                            reloadToken={reloadToken}
                        />
                    ) : (
                        <UnsupportedKind kind={current.kind} />
                    )
                ) : (
                    <div className="h-full overflow-auto p-2">
                        <CodeBlock
                            content={current.code}
                            language={current.language}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
