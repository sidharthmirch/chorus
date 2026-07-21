import { displayDate } from "@ui/lib/utils";

function formatFrontmatterValue(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return `[${value.map(formatFrontmatterValue).join(", ")}]`;

    switch (typeof value) {
        case "string":
            return value;
        case "number":
        case "boolean":
        case "bigint":
            return String(value);
        case "symbol":
        case "function":
            return value.toString();
        default:
            // plain object (array/null/undefined already handled above)
            return JSON.stringify(value);
    }
}

/**
 * The frontmatter properties table (design/wiki.md: mono keys, `bg-muted`
 * panel). `tags` renders as clickable chips (design: "linked tags") that
 * hand off to the search view; every other key/value renders generically.
 * A final "modified" row is appended from the file's own mtime (NOT a
 * frontmatter value) -- kept visually distinct from any `updated` key the
 * note's own frontmatter might carry, since that's author-written text we
 * shouldn't second-guess.
 */
export function FrontmatterTable({
    frontmatter,
    updatedAt,
    onTagClick,
}: {
    frontmatter: Record<string, unknown>;
    updatedAt: Date;
    onTagClick?: (tag: string) => void;
}) {
    const entries = Object.entries(frontmatter);

    return (
        <div className="bg-muted rounded-md px-2.5 py-2">
            <table className="w-full font-geist-mono text-xs">
                <tbody>
                    {entries.map(([key, value]) => (
                        <tr key={key} className="align-top">
                            <td className="pr-3 py-0.5 text-muted-foreground whitespace-nowrap">
                                {key}
                            </td>
                            <td className="py-0.5 text-foreground w-full">
                                {key === "tags" && Array.isArray(value) ? (
                                    <div className="flex flex-wrap gap-1">
                                        {value.map((tag, i) => {
                                            const label = formatFrontmatterValue(tag);
                                            return (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    disabled={!onTagClick}
                                                    className="rounded-full bg-background px-1.5 text-accent-600 hover:underline disabled:no-underline disabled:cursor-default"
                                                    onClick={() => onTagClick?.(label)}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    formatFrontmatterValue(value)
                                )}
                            </td>
                        </tr>
                    ))}
                    <tr className="align-top">
                        <td className="pr-3 py-0.5 text-muted-foreground whitespace-nowrap">modified</td>
                        <td className="py-0.5 text-foreground">{displayDate(updatedAt)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
