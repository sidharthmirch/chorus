import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Separator } from "../../ui/separator";
import { Button } from "../../ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@ui/components/ui/collapsible";
import { BookOpen, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { SiOpenai } from "react-icons/si";
import { RiClaudeFill } from "react-icons/ri";
import Database from "@tauri-apps/plugin-sql";
import { config } from "@core/config";
import { openUrl } from "@tauri-apps/plugin-opener";
import { dialogActions } from "@core/infra/DialogStore";
import { PermissionsTab } from "../PermissionsTab";
import { AmbientChatPanel } from "../AmbientChatPanel";
import { AppPreferencesPanel } from "../AppPreferencesPanel";
import FeedbackButton from "../../FeedbackButton";
import type { ISettingsSectionProps } from "../registry";

export function AppSection({ navigateToSection }: ISettingsSectionProps) {
    const queryClient = useQueryClient();
    const [advancedOpen, setAdvancedOpen] = useState(false);

    const showOnboarding = async () => {
        const db = await Database.load(config.dbUrl);
        await db.execute(
            "UPDATE app_metadata SET value = 'false' WHERE key = 'has_dismissed_onboarding'; UPDATE app_metadata SET value = '0' WHERE key = 'onboarding_step';",
        );
        await queryClient.invalidateQueries({ queryKey: ["appMetadata"] });
        await queryClient.invalidateQueries({
            queryKey: ["hasDismissedOnboarding"],
        });
        toast("Onboarding Reset", {
            description: "Onboarding will appear now.",
        });
    };

    const handleImportHistory = (platform: "openai" | "anthropic") => {
        dialogActions.openDialog(`import-${platform}`);
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h2 className="text-2xl font-semibold mb-2">App</h2>
                <p className="text-sm text-muted-foreground">
                    Appearance, behavior, permissions, data.
                </p>
            </div>

            <AppPreferencesPanel />

            <Separator />

            <div>
                <PermissionsTab />
            </div>

            <Separator />

            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold mb-1">
                        Import chat history
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Import your conversation history from other AI chat
                        platforms.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleImportHistory("openai")}
                        className="flex items-center gap-2"
                    >
                        <SiOpenai className="h-4 w-4" />
                        Import from OpenAI
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleImportHistory("anthropic")}
                        className="flex items-center gap-2"
                    >
                        <RiClaudeFill className="h-4 w-4" />
                        Import from Anthropic
                    </Button>
                </div>
            </div>

            <Separator />

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger className="flex items-center w-full gap-2 hover:opacity-80">
                    <span className="text-xs font-geist-mono uppercase tracking-wider text-muted-foreground">
                        Advanced
                    </span>
                    <ChevronDown
                        className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                            advancedOpen ? "rotate-180" : ""
                        }`}
                    />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-8 pt-6">
                    <div>
                        <h3 className="text-lg font-semibold mb-3">
                            Ambient Chat
                        </h3>
                        <AmbientChatPanel />
                    </div>

                    <Separator />

                    <div className="space-y-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void showOnboarding()}
                        >
                            <BookOpen className="h-4 w-4 mr-2" />
                            Restart Onboarding
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigateToSection("accounts")}
                        >
                            Configure API Keys
                        </Button>
                        <p className="text-sm text-muted-foreground flex items-center flex-wrap gap-1">
                            Send us
                            <FeedbackButton className="underline hover:no-underline">
                                feedback
                            </FeedbackButton>
                            anytime, or
                            <button
                                className="underline hover:no-underline"
                                onClick={() => {
                                    void openUrl("https://cal.com/choltz/jam");
                                }}
                            >
                                book a call
                            </button>
                            with the founders.
                        </p>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}
