import { Pencil, Trash2 } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { RiSupabaseFill } from "react-icons/ri";
import { SiStripe, SiElevenlabs } from "react-icons/si";
import { ExternalLinkIcon } from "lucide-react";
import { Button } from "../../ui/button";
import { CodeBlock } from "../../renderers/CodeBlock";
import { CustomToolsetConfig, getEnvFromJSON } from "@core/chorus/Toolsets";

export const RECOMMENDED_TOOLSETS = [
    {
        name: "context7",
        command: "npx",
        args: "-y @upstash/context7-mcp@latest",
        description: "Gets up-to-date documentation and code examples.",
        logo: <img src="/context7.png" className="size-8 rounded-lg" />,
        docsUrl: "https://github.com/upstash/context7-mcp",
        needsUserInput: false,
    },
    {
        name: "replicate",
        command: "npx",
        args: "-y mcp-remote@latest https://mcp.replicate.com/sse",
        env: `{"REPLICATE_API_TOKEN": "your-replicate-api-token"}`,
        description: "Run and manage machine learning models in the cloud.",
        logo: <img src="/replicate.png" className="size-8" />,
        docsUrl: "https://www.npmjs.com/package/replicate-mcp",
        apiKeyUrl: "https://replicate.com/account/api-tokens",
        needsUserInput: false,
    },
    {
        name: "stripe",
        command: "npx",
        args: "-y @stripe/mcp --tools=all --api-key=YOUR_STRIPE_API_KEY",
        description: "Manage payments, customers, and subscriptions.",
        logo: <SiStripe className="size-8" />,
        docsUrl: "https://docs.stripe.com/building-with-llms",
        apiKeyUrl: "https://dashboard.stripe.com/apikeys",
        needsUserInput: true,
    },
    {
        name: "elevenlabs",
        command: "uvx",
        args: "elevenlabs-mcp",
        env: `{"ELEVENLABS_API_KEY": "your-elevenlabs-api-key"}`,
        description: "Generate high-quality speech from text using AI voices.",
        logo: <SiElevenlabs className="size-8" />,
        docsUrl: "https://github.com/elevenlabs/elevenlabs-mcp",
        apiKeyUrl: "https://elevenlabs.io/app/settings/api-keys",
        needsUserInput: true,
    },
    {
        name: "supabase",
        command: "npx",
        args: "-y @supabase/mcp-server-supabase@latest --access-token <personal-access-token>",
        description:
            "Manage databases, authentication, and real-time subscriptions.",
        logo: <RiSupabaseFill className="size-8" />,
        docsUrl: "https://supabase.com/blog/mcp-server",
        apiKeyUrl: "https://supabase.com/dashboard/project/settings/api",
        needsUserInput: true,
    },
];

export type CustomToolsetRowProps = {
    toolset: CustomToolsetConfig;
    onEdit: (toolset: CustomToolsetConfig) => void;
    onDelete: (name: string) => void;
};

export function CustomToolsetRow({
    toolset,
    onEdit,
    onDelete,
}: CustomToolsetRowProps) {
    const recommendedMatch = RECOMMENDED_TOOLSETS.find(
        (t) => t.name === toolset.name,
    );
    const docsUrl = recommendedMatch?.docsUrl;
    const apiKeyUrl = recommendedMatch?.apiKeyUrl;
    const needsUserInput = recommendedMatch?.needsUserInput;

    // Convert env to a list of commands, e.g. FOO=bar QUUX=baz
    const envToCommands = () => {
        const parsedEnv = getEnvFromJSON(toolset.env);
        if (parsedEnv._type === "error") return "";
        return Object.entries(parsedEnv)
            .map(([key, value]) => `${key}=${value}`)
            .join(" ");
    };

    // Create a "full" command (for copying) and a truncated command (for display)
    const fullCommandText =
        `${envToCommands()} ${toolset.command} ${toolset.args || ""}`.trim();
    const displayCommandText =
        `${toolset.command} ${toolset.args || ""}`.trim();
    const truncatedCommandText =
        displayCommandText.length > 75
            ? displayCommandText.slice(0, 75) + "..."
            : displayCommandText;

    return (
        <div className="flex flex-col justify-between items-start p-4 border rounded-lg shadow-sm bg-card">
            <div className="w-full flex justify-between items-center">
                <div className="font-semibold  text-card-foreground flex items-center gap-2">
                    {recommendedMatch?.logo} {/* Display logo if available */}
                    {toolset.name}
                </div>
                <div className="flex space-x-1">
                    <Button
                        variant="ghost"
                        size="iconSm"
                        onClick={() => onEdit(toolset)}
                        title="Edit"
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="iconSm"
                        onClick={() => onDelete(toolset.name)}
                        title="Delete"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <div className="mt-2 w-full border border-border text-sm rounded-md">
                <CodeBlock
                    language="sh"
                    overrideRunCommand={true}
                    contentToCopy={fullCommandText}
                    content={truncatedCommandText}
                />
            </div>
            {(docsUrl || (apiKeyUrl && needsUserInput)) && (
                <div className="text-[10px] flex justify-end items-center gap-2 mt-2 w-full">
                    {docsUrl && (
                        <button
                            type="button"
                            className="hover:text-foreground flex items-center gap-1"
                            onClick={(e) => {
                                e.preventDefault();
                                void openUrl(docsUrl);
                            }}
                        >
                            <InfoCircledIcon className="size-3" /> Docs
                        </button>
                    )}
                    {apiKeyUrl && needsUserInput && (
                        <button
                            type="button"
                            className="hover:text-foreground flex items-center gap-1"
                            onClick={(e) => {
                                e.preventDefault();
                                void openUrl(apiKeyUrl);
                            }}
                        >
                            <ExternalLinkIcon className="size-3" /> Get API Key
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
