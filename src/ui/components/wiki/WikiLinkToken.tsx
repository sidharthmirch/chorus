import { useState } from "react";
import { Link as LinkIcon } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@ui/components/ui/alert-dialog";
import { useCreateNote, useResolveWikilink } from "@core/chorus/wiki/useWiki";
import { titleFromPath } from "@core/chorus/wiki/parse";

/**
 * A single `[[wikilink]]` / `![[embed]]` rendered as a real interactive
 * element (not a markdown `<a>` -- see .rework/w8-PROGRESS.md's decisions
 * log for why: MessageMarkdown's link path always opens the system browser
 * and appends an external-link icon, neither of which is right here).
 * Resolves the mention against the vault's known files; an existing note
 * navigates in-wiki on click, a missing one shows a subdued affordance
 * that offers to create it (design/wiki.md: "Create new note?" modal).
 */
export function WikiLinkToken({
    vaultPath,
    target,
    label,
    isEmbed,
    onNavigate,
}: {
    vaultPath: string | undefined;
    target: string;
    label: string;
    isEmbed: boolean;
    onNavigate: (path: string) => void;
}) {
    const resolvedPath = useResolveWikilink(vaultPath, target);
    const createNote = useCreateNote(vaultPath);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const suggestedPath = `${target}.md`;

    if (resolvedPath) {
        return (
            <button
                type="button"
                className="text-accent-600 hover:underline underline-offset-2 inline-flex items-center gap-0.5"
                onClick={() => onNavigate(resolvedPath)}
            >
                {isEmbed && <LinkIcon className="size-3 opacity-60" strokeWidth={1.5} />}
                {label}
            </button>
        );
    }

    return (
        <>
            <button
                type="button"
                className="text-muted-foreground/80 hover:text-muted-foreground underline decoration-dotted underline-offset-2"
                title={`"${target}" doesn't exist yet -- click to create it`}
                onClick={() => setConfirmOpen(true)}
            >
                {label}
            </button>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Create new note?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="font-geist-mono text-xs">{suggestedPath}</span> doesn&rsquo;t
                            exist in this vault yet. Create it now with the title{" "}
                            <span className="font-medium text-foreground">
                                {titleFromPath(suggestedPath)}
                            </span>
                            ?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                createNote.mutate(
                                    { path: suggestedPath },
                                    {
                                        onSuccess: (path) => {
                                            setConfirmOpen(false);
                                            onNavigate(path);
                                        },
                                    },
                                );
                            }}
                        >
                            Create
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
