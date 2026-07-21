import { useSearchParams } from "react-router-dom";
import { BookOpenIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@ui/components/ui/button";
import RetroSpinner from "@ui/components/ui/retro-spinner";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@ui/components/ui/resizable";
import { cn } from "@ui/lib/utils";
import {
    useNote,
    useRebuildIndex,
    useVaultPath,
    useVaultTree,
    useWikiVaultWatcher,
} from "@core/chorus/wiki/useWiki";
import { VaultPickerEmptyState } from "./VaultPickerEmptyState";
import { VaultTree } from "./VaultTree";
import { NoteView } from "./NoteView";
import { SearchView } from "./SearchView";
import { GraphView } from "./GraphView";

type WikiTab = "note" | "search" | "graph";

function parseTab(value: string | null): WikiTab {
    return value === "search" || value === "graph" ? value : "note";
}

/**
 * `/wiki` — vault tree + tabbed content panel (Note/Search/Graph). See
 * docs/rework/design/wiki.md for the full spec and
 * docs/rework/agents/W8-wiki.md for the phase plan this was built against.
 * Active tab/note/query live in the URL's search params so the view is
 * deep-linkable without adding a second `<Route>` entry.
 */
export default function WikiView() {
    const [searchParams, setSearchParams] = useSearchParams();
    const vaultPathQuery = useVaultPath();
    const vaultPath = vaultPathQuery.data;

    useWikiVaultWatcher(vaultPath);

    const activeTab = parseTab(searchParams.get("tab"));
    const activePath = searchParams.get("note") ?? undefined;
    const queryParam = searchParams.get("q") ?? "";

    const treeQuery = useVaultTree(vaultPath);
    const rebuildIndex = useRebuildIndex(vaultPath);
    const activeNoteQuery = useNote(vaultPath, activeTab === "note" ? activePath : undefined);

    const navigateToNote = (path: string) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("tab", "note");
            next.set("note", path);
            return next;
        });
    };

    const navigateToSearch = (query: string) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("tab", "search");
            next.set("q", query);
            return next;
        });
    };

    const navigateToGraph = (query: string) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("tab", "graph");
            next.set("q", query);
            return next;
        });
    };

    const setTab = (tab: WikiTab) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("tab", tab);
            return next;
        });
    };

    if (vaultPathQuery.isPending) {
        return (
            <div className="flex h-full items-center justify-center">
                <RetroSpinner />
            </div>
        );
    }

    if (!vaultPath) {
        return <VaultPickerEmptyState />;
    }

    const noteTabLabel = activeNoteQuery.data?.frontmatter["type"] === "concept" ? "Concept" : "Note";
    const tabs: { id: WikiTab; label: string }[] = [
        { id: "note", label: noteTabLabel },
        { id: "search", label: "Search" },
        { id: "graph", label: "Graph" },
    ];

    return (
        <div className="flex h-full min-h-0 flex-col bg-background">
            <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <BookOpenIcon className="size-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                    <h1 className="text-base font-medium shrink-0">Wiki</h1>
                    <span className="font-geist-mono text-xs text-muted-foreground truncate">
                        {vaultPath}
                    </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center rounded-lg border border-border overflow-hidden">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                className={cn(
                                    "px-3 py-1 text-xs",
                                    activeTab === tab.id
                                        ? "bg-foreground text-background"
                                        : "text-muted-foreground hover:bg-muted",
                                )}
                                onClick={() => setTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <Button
                        variant="ghost"
                        size="iconSm"
                        disabled={rebuildIndex.isPending}
                        title="Rebuild index"
                        onClick={() => rebuildIndex.mutate(undefined)}
                    >
                        {rebuildIndex.isPending ? (
                            <RetroSpinner />
                        ) : (
                            <RefreshCwIcon className="size-3" strokeWidth={1.5} />
                        )}
                    </Button>
                </div>
            </div>

            <div className="flex min-h-0 flex-1">
                <ResizablePanelGroup direction="horizontal">
                    <ResizablePanel defaultSize={20} minSize={14} maxSize={35}>
                        <div className="h-full overflow-y-auto border-r border-border">
                            {treeQuery.isPending ? (
                                <div className="flex h-full items-center justify-center">
                                    <RetroSpinner />
                                </div>
                            ) : (
                                <VaultTree
                                    tree={treeQuery.data ?? []}
                                    activePath={activeTab === "note" ? activePath : undefined}
                                    onSelectFile={navigateToNote}
                                />
                            )}
                        </div>
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel defaultSize={80}>
                        {activeTab === "note" &&
                            (activePath ? (
                                <NoteView
                                    vaultPath={vaultPath}
                                    path={activePath}
                                    onNavigate={navigateToNote}
                                    onSearchQuery={navigateToSearch}
                                />
                            ) : (
                                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                    Select a note from the tree to get started.
                                </div>
                            ))}
                        {activeTab === "search" && (
                            <SearchView
                                vaultPath={vaultPath}
                                initialQuery={queryParam}
                                onNavigate={navigateToNote}
                                onViewAsGraph={navigateToGraph}
                            />
                        )}
                        {activeTab === "graph" && (
                            <GraphView
                                vaultPath={vaultPath}
                                initialFilter={queryParam}
                                onNavigate={navigateToNote}
                            />
                        )}
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    );
}
