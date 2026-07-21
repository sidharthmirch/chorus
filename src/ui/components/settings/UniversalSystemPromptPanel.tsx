/**
 * The single global system prompt prepended to every chat — distinct from
 * the per-mode prompts above (docs/rework/w3-settings-inventory.md #12).
 * Ported from the pre-rework "System Prompt" tab.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useReactQueryAutoSync } from "use-react-query-auto-sync";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { useDatabase } from "@ui/hooks/useDatabase";
import * as AppMetadataAPI from "@core/chorus/api/AppMetadataAPI";
import { UNIVERSAL_SYSTEM_PROMPT_DEFAULT } from "@core/chorus/prompts/prompts";

export function UniversalSystemPromptPanel() {
    const { db } = useDatabase();
    const queryClient = useQueryClient();

    const { draft: universalSystemPrompt, setDraft: setUniversalSystemPrompt } =
        useReactQueryAutoSync({
            queryOptions: {
                queryKey: ["universalSystemPrompt"],
                queryFn: async () => {
                    const appMetadata = await AppMetadataAPI.fetchAppMetadata();
                    return (
                        appMetadata["universal_system_prompt"] ??
                        UNIVERSAL_SYSTEM_PROMPT_DEFAULT
                    );
                },
            },
            mutationOptions: {
                mutationFn: async (value: string) => {
                    await db.execute(
                        `INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('universal_system_prompt', ?)`,
                        [value],
                    );
                    await queryClient.invalidateQueries({
                        queryKey: ["appMetadata"],
                    });
                    return value;
                },
            },
            autoSaveOptions: {
                wait: 1000,
            },
        });

    return (
        <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
                Applied before any per-mode stance prompt, on every chat with
                every model.
            </p>
            <Textarea
                value={universalSystemPrompt || ""}
                onChange={(e) => setUniversalSystemPrompt(e.target.value)}
                placeholder="Enter your custom system prompt..."
                rows={12}
                className="w-full font-mono text-sm resize-y min-h-[160px]"
            />
            <div className="flex justify-end pt-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                        await db.execute(
                            `DELETE FROM app_metadata WHERE key = 'universal_system_prompt'`,
                        );
                        setUniversalSystemPrompt(
                            UNIVERSAL_SYSTEM_PROMPT_DEFAULT,
                        );
                        await queryClient.invalidateQueries({
                            queryKey: ["appMetadata"],
                        });
                    }}
                >
                    Reset to default
                </Button>
            </div>
        </div>
    );
}
