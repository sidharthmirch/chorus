import RetroSpinner from "@ui/components/ui/retro-spinner";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@ui/components/ui/resizable";
import { useBacklinks, useNote } from "@core/chorus/wiki/useWiki";
import { FrontmatterTable } from "./FrontmatterTable";
import { WikiNoteBody } from "./WikiNoteBody";
import { BacklinksList } from "./BacklinksList";
import { LocalGraph } from "./LocalGraph";

/**
 * Note (and "Concept" — design/wiki.md treats them as the same view; the
 * tab label above just switches based on frontmatter.type) view: title,
 * frontmatter properties, wikilink-aware body, backlinks, and a right-rail
 * 1-hop local graph.
 */
export function NoteView({
    vaultPath,
    path,
    onNavigate,
    onSearchQuery,
}: {
    vaultPath: string | undefined;
    path: string;
    onNavigate: (path: string) => void;
    onSearchQuery: (query: string) => void;
}) {
    const noteQuery = useNote(vaultPath, path);
    const backlinksQuery = useBacklinks(vaultPath, path);

    if (noteQuery.isPending) {
        return (
            <div className="flex h-full items-center justify-center text-muted-foreground">
                <RetroSpinner />
            </div>
        );
    }

    if (noteQuery.isError || !noteQuery.data) {
        return (
            <div className="p-6 text-sm text-destructive">
                Couldn&rsquo;t load &ldquo;{path}&rdquo;.
            </div>
        );
    }

    const note = noteQuery.data;
    const hasFrontmatter = Object.keys(note.frontmatter).length > 0;

    return (
        <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={70} minSize={40}>
                <div className="h-full overflow-y-auto px-6 py-5 flex flex-col gap-5">
                    <div>
                        <div className="font-geist-mono text-xs text-muted-foreground mb-1">
                            {note.path}
                        </div>
                        <h1 className="text-lg font-medium">{note.title}</h1>
                    </div>

                    {hasFrontmatter && (
                        <FrontmatterTable
                            frontmatter={note.frontmatter}
                            updatedAt={note.updatedAt}
                            onTagClick={onSearchQuery}
                        />
                    )}

                    <WikiNoteBody
                        body={note.body}
                        links={note.links}
                        vaultPath={vaultPath}
                        onNavigate={onNavigate}
                    />

                    <div className="border-t border-border pt-4">
                        <div className="sidebar-label text-muted-foreground mb-2">
                            Backlinks · related notes
                        </div>
                        <BacklinksList
                            backlinks={backlinksQuery.data ?? []}
                            onNavigate={onNavigate}
                        />
                    </div>
                </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={30} minSize={20} maxSize={45}>
                <div className="h-full overflow-y-auto px-4 py-5">
                    <div className="sidebar-label text-muted-foreground mb-2">Local graph</div>
                    <LocalGraph vaultPath={vaultPath} path={path} onNavigate={onNavigate} />
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    );
}
