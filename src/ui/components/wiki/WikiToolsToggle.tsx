import { Switch } from "@ui/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui/components/ui/tooltip";
import { useToolsetsConfig, useUpdateToolsetsConfig } from "@core/chorus/api/ToolsetsAPI";

/**
 * Self-contained "enable wiki-mcp tools in chat" toggle. wiki-mcp
 * (read_note/write_note/search_vault/get_backlinks — wiki/wikiToolset.ts)
 * is a normal builtin toolset and starts disabled like every other one;
 * it would normally be flipped on from Settings' Connections tab, but
 * Settings.tsx isn't built on this integration branch yet. This calls the
 * same, already-shared `useUpdateToolsetsConfig` mutation that tab would
 * use — no Settings.tsx edits, and nothing to remove later beyond this one
 * small header control once that tab exists.
 */
export function WikiToolsToggle() {
    const toolsetsConfigQuery = useToolsetsConfig();
    const updateToolsetsConfig = useUpdateToolsetsConfig();

    const isEnabled = toolsetsConfigQuery.data?.["wiki"]?.["enabled"] === "true";

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <Switch
                        checked={isEnabled}
                        disabled={toolsetsConfigQuery.isPending || updateToolsetsConfig.isPending}
                        onCheckedChange={(checked) => {
                            updateToolsetsConfig.mutate({
                                toolsetName: "wiki",
                                parameterId: "enabled",
                                value: checked ? "true" : "false",
                            });
                        }}
                    />
                    Wiki tools in chat
                </label>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
                Lets any model read and write notes in this vault during chat
                (read_note, write_note, search_vault, get_backlinks).
            </TooltipContent>
        </Tooltip>
    );
}
