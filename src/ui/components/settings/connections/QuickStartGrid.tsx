import { Loader2, Plus, LinkIcon } from "lucide-react";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { openUrl } from "@tauri-apps/plugin-opener";
import { RiClaudeFill } from "react-icons/ri";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "../../ui/tooltip";
import { Button } from "../../ui/button";
import { CustomToolsetConfig } from "@core/chorus/Toolsets";
import { RECOMMENDED_TOOLSETS } from "./recommendedToolsets";

/** The "Quick start" grid — new local/remote MCP, Claude Desktop import, and
 *  one-click recommended-server buttons. Extracted verbatim from the
 *  pre-rework `ToolsTab`'s top block. */
export function QuickStartGrid({
    customToolsetConfigs,
    isImportingFromClaudeDesktop,
    onCreateToolset,
    onCreateRemoteToolset,
    onImportFromClaudeDesktop,
    onSuggestedMCP,
}: {
    customToolsetConfigs: CustomToolsetConfig[];
    isImportingFromClaudeDesktop: boolean;
    onCreateToolset: () => void;
    onCreateRemoteToolset: () => void;
    onImportFromClaudeDesktop: () => void;
    onSuggestedMCP: (
        name: string,
        command: string,
        args: string,
        env: string,
        needsUserInput: boolean,
    ) => void;
}) {
    return (
        <div className="gap-2">
            <h5 className="text-sm font-geist-mono uppercase tracking-wider font-[350]">
                Quick start
            </h5>
            <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="col-span-1">
                    <button
                        onClick={onCreateToolset}
                        className="flex flex-col font-semibold items-center gap-2 border border-border hover:bg-muted rounded-md w-full py-4 disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    >
                        <Plus className="size-9" />
                        New Local MCP
                    </button>
                </div>
                <div className="col-span-1">
                    <button
                        onClick={onCreateRemoteToolset}
                        className="flex flex-col font-medium items-center gap-2 border border-border hover:bg-muted rounded-md w-full py-4 disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    >
                        <Plus className="size-9" />
                        New Remote MCP
                    </button>
                </div>
                <div className="col-span-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={onImportFromClaudeDesktop}
                                className="flex flex-col font-semibold items-center gap-2  border border-border hover:bg-muted rounded-md w-full py-4 disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                            >
                                {isImportingFromClaudeDesktop ? (
                                    <>
                                        <Loader2 className="size-9 animate-spin" />
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        <RiClaudeFill className="size-9" />
                                        Import from Claude Desktop
                                    </>
                                )}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[300px]">
                            Import MCPs from Claude Desktop. If you've made
                            changes to your MCPs in Claude Desktop, you can
                            click this button again to refresh your Chorus
                            MCPs.
                        </TooltipContent>
                    </Tooltip>
                </div>

                {RECOMMENDED_TOOLSETS.map((toolset) => (
                    <div key={toolset.name} className="relative">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    disabled={customToolsetConfigs.some(
                                        (t) => t.name === toolset.name,
                                    )}
                                    className="flex flex-col items-center gap-2  font-semibold border border-border hover:bg-muted rounded-md w-full py-4 disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                                    onClick={() => {
                                        onSuggestedMCP(
                                            toolset.name,
                                            toolset.command,
                                            toolset.args,
                                            toolset.env || "{}",
                                            toolset.needsUserInput,
                                        );
                                    }}
                                >
                                    {toolset.logo}
                                    <span className="flex items-center gap-1">
                                        {toolset.name}{" "}
                                    </span>
                                </button>
                            </TooltipTrigger>
                            {toolset.description && (
                                <TooltipContent
                                    side="bottom"
                                    className="max-w-[300px]"
                                >
                                    {toolset.description}
                                </TooltipContent>
                            )}
                        </Tooltip>

                        <div className="text-[10px] flex justify-end absolute top-1 right-1.5">
                            <button
                                type="button"
                                className="hover:text-foreground flex items-center gap-1"
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (toolset.docsUrl) {
                                        void openUrl(toolset.docsUrl);
                                    }
                                }}
                            >
                                <InfoCircledIcon className="size-3" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function GitHubManageConnectionButton() {
    return (
        <Button
            onClick={() => {
                void openUrl(
                    "https://github.com/settings/connections/applications/Ov23liViInr7fzLZk61V",
                );
            }}
            variant="outline"
            size="iconSm"
        >
            <LinkIcon className="size-4" />
            Manage Connection
        </Button>
    );
}
