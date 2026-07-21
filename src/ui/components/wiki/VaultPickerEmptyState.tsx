import { BookOpenIcon } from "lucide-react";
import { Button } from "@ui/components/ui/button";
import RetroSpinner from "@ui/components/ui/retro-spinner";
import { usePickVault } from "@core/chorus/wiki/useWiki";

/** Shown when no vault directory has been chosen yet (first run, or after
 *  clearing the vault path). */
export function VaultPickerEmptyState() {
    const pickVault = usePickVault();

    return (
        <div className="flex h-full flex-col items-center justify-center gap-4 text-center px-6">
            <BookOpenIcon className="size-8 text-muted-foreground" strokeWidth={1.5} />
            <div className="flex flex-col gap-1">
                <h2 className="text-lg font-medium">Choose a vault to get started</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                    Pick a local folder of Markdown notes — Chorus reads its frontmatter and
                    [[wikilinks]] and never stores note content anywhere but on disk.
                </p>
            </div>
            <Button
                variant="default"
                disabled={pickVault.isPending}
                onClick={() => pickVault.mutate()}
            >
                {pickVault.isPending && <RetroSpinner />}
                Choose folder
            </Button>
        </div>
    );
}
