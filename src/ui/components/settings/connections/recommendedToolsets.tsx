import { RiSupabaseFill } from "react-icons/ri";
import { SiStripe, SiElevenlabs } from "react-icons/si";

/** Pure data, split into its own file (not co-located with `CustomToolsetRow`)
 *  because `react-refresh/only-export-components` wants component files to
 *  export only components. */
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
