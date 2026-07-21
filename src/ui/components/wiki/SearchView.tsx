import { useEffect, useState } from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@ui/components/ui/input";
import { Badge } from "@ui/components/ui/badge";
import { Button } from "@ui/components/ui/button";
import RetroSpinner from "@ui/components/ui/retro-spinner";
import { useSearchVault } from "@core/chorus/wiki/useWiki";

// design/wiki.md: "Live: Filters results as you type (debounce 300ms)".
// setTimeout debounce is orchestrator-pre-authorized for this exact case
// (.rework/ORCHESTRATION.md's forbidden-feature policy).
const DEBOUNCE_MS = 300;

export function SearchView({
    vaultPath,
    initialQuery,
    onNavigate,
    onViewAsGraph,
}: {
    vaultPath: string | undefined;
    initialQuery: string;
    onNavigate: (path: string) => void;
    onViewAsGraph: (query: string) => void;
}) {
    const [inputValue, setInputValue] = useState(initialQuery);
    const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

    // Re-sync when the caller hands us a new initial query (e.g. clicking a
    // frontmatter tag while already on the Search tab).
    useEffect(() => {
        setInputValue(initialQuery);
        setDebouncedQuery(initialQuery);
    }, [initialQuery]);

    useEffect(() => {
        const timeout = setTimeout(() => setDebouncedQuery(inputValue), DEBOUNCE_MS);
        return () => clearTimeout(timeout);
    }, [inputValue]);

    const trimmedQuery = debouncedQuery.trim();
    const searchQuery = useSearchVault(vaultPath, debouncedQuery);
    const results = searchQuery.data ?? [];

    return (
        <div className="h-full overflow-y-auto px-6 py-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <SearchIcon
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground"
                        strokeWidth={1.5}
                    />
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Search vault…"
                        className="pl-8"
                    />
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!trimmedQuery}
                    onClick={() => onViewAsGraph(trimmedQuery)}
                >
                    View results as Graph
                </Button>
            </div>

            {searchQuery.isFetching && (
                <div className="text-muted-foreground">
                    <RetroSpinner />
                </div>
            )}

            {!searchQuery.isFetching && trimmedQuery && results.length === 0 && (
                <p className="text-sm text-muted-foreground">No matches for &ldquo;{trimmedQuery}&rdquo;.</p>
            )}

            {!trimmedQuery && (
                <p className="text-sm text-muted-foreground">Type to search titles and note bodies.</p>
            )}

            <div className="flex flex-col gap-1">
                {results.map((result) => (
                    <button
                        key={result.path}
                        type="button"
                        className="flex flex-col gap-1 text-left rounded-md px-3 py-2 hover:bg-muted"
                        onClick={() => onNavigate(result.path)}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-foreground truncate">{result.path}</span>
                            {result.folder && (
                                <Badge variant="outline" className="shrink-0 normal-case">
                                    {result.folder}
                                </Badge>
                            )}
                            <span className="font-geist-mono text-xs text-muted-foreground shrink-0 ml-auto">
                                ({result.linkCount} links)
                            </span>
                        </div>
                        {result.snippet && (
                            <span className="text-xs text-muted-foreground truncate">
                                {result.snippet}
                            </span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
