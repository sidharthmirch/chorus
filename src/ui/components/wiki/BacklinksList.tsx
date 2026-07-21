import type { IBacklinkEntry } from "@core/chorus/wiki/types";

/** Backlinks section (design/wiki.md: "Backlinks · related notes" —
 *  file path, context snippet, link-count badge; click opens the target). */
export function BacklinksList({
    backlinks,
    onNavigate,
}: {
    backlinks: IBacklinkEntry[];
    onNavigate: (path: string) => void;
}) {
    if (backlinks.length === 0) {
        return <p className="text-sm text-muted-foreground">No backlinks yet.</p>;
    }

    return (
        <div className="flex flex-col gap-0.5">
            {backlinks.map((backlink) => (
                <button
                    key={backlink.sourcePath}
                    type="button"
                    className="flex items-start justify-between gap-3 text-left rounded-md px-2 py-1.5 -mx-2 hover:bg-muted"
                    onClick={() => onNavigate(backlink.sourcePath)}
                >
                    <span className="flex flex-col min-w-0">
                        <span className="text-sm text-foreground truncate">
                            {backlink.sourceTitle}
                        </span>
                        {backlink.context && (
                            <span className="text-xs text-muted-foreground truncate">
                                {backlink.context}
                            </span>
                        )}
                    </span>
                    <span className="font-geist-mono text-xs text-muted-foreground shrink-0 pt-0.5">
                        ({backlink.linkCount})
                    </span>
                </button>
            ))}
        </div>
    );
}
