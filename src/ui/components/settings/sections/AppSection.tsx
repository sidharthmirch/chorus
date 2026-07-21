import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../ui/select";
import { useTheme } from "@ui/hooks/useTheme";
import { Separator } from "../../ui/separator";
import { Button } from "../../ui/button";
import { Switch } from "../../ui/switch";
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
import { SettingsManager } from "@core/utilities/Settings";
import { useModelConfigs } from "@core/chorus/api/ModelsAPI";
import { PermissionsTab } from "../PermissionsTab";
import { AmbientChatPanel } from "../AmbientChatPanel";
import FeedbackButton from "../../FeedbackButton";
import type { ISettingsSectionProps } from "../registry";

const FONT_OPTIONS = {
    sans: [
        { label: "Geist", value: "Geist" },
        { label: "Inter", value: "Inter" },
        { label: "Fira Code", value: "Fira Code" },
        { label: "Monaspace Neon", value: "Monaspace Neon" },
        { label: "Monaspace Xenon", value: "Monaspace Xenon" },
    ],
} as const;

export function AppSection({ navigateToSection }: ISettingsSectionProps) {
    const settingsManager = SettingsManager.getInstance();
    const { mode, setMode, setSansFont, setMonoFont, sansFont } = useTheme();
    const queryClient = useQueryClient();
    const modelConfigsQuery = useModelConfigs();

    const [autoConvertLongText, setAutoConvertLongText] = useState(true);
    const [autoScrapeUrls, setAutoScrapeUrls] = useState(true);
    const [cautiousEnter, setCautiousEnter] = useState(false);
    const [showCost, setShowCost] = useState(false);
    const [titleGenerationModelConfigId, setTitleGenerationModelConfigId] =
        useState<string | undefined>(undefined);
    const [advancedOpen, setAdvancedOpen] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            const settings = await settingsManager.get();
            setSansFont(settings.sansFont ?? "Geist");
            setMonoFont(settings.monoFont ?? "Fira Code");
            setAutoConvertLongText(settings.autoConvertLongText ?? true);
            setAutoScrapeUrls(settings.autoScrapeUrls ?? true);
            setCautiousEnter(settings.cautiousEnter ?? false);
            setShowCost(settings.showCost ?? false);
            setTitleGenerationModelConfigId(
                settings.titleGenerationModelConfigId,
            );
        };
        void loadSettings();
    }, [setMonoFont, setSansFont, settingsManager]);

    const cheapOpenRouterModelOptions = (modelConfigsQuery.data ?? [])
        .filter(
            (c) =>
                c.modelId.startsWith("openrouter::") &&
                c.isEnabled &&
                !c.isInternal &&
                !c.isDeprecated,
        )
        .sort((a, b) => {
            const priceA =
                (a.promptPricePerToken ?? Infinity) +
                (a.completionPricePerToken ?? Infinity);
            const priceB =
                (b.promptPricePerToken ?? Infinity) +
                (b.completionPricePerToken ?? Infinity);
            return priceA - priceB;
        });

    const getCurrentThemeValue = () => `default-${mode}`;
    const handleThemeChange = (value: string) => {
        const [, newMode] = value.split("-");
        setMode(newMode as "light" | "dark" | "system");
    };

    const handleSansFontChange = async (value: string) => {
        setSansFont(value);
        const currentSettings = await settingsManager.get();
        void settingsManager.set({ ...currentSettings, sansFont: value });
    };

    const handleTitleGenerationModelChange = async (
        value: string | undefined,
    ) => {
        setTitleGenerationModelConfigId(value);
        const currentSettings = await settingsManager.get();
        void settingsManager.set({
            ...currentSettings,
            titleGenerationModelConfigId: value,
        });
    };

    const handleAutoConvertLongTextChange = async (enabled: boolean) => {
        setAutoConvertLongText(enabled);
        const currentSettings = await settingsManager.get();
        void settingsManager.set({
            ...currentSettings,
            autoConvertLongText: enabled,
        });
    };

    const handleAutoScrapeUrlsChange = async (enabled: boolean) => {
        setAutoScrapeUrls(enabled);
        const currentSettings = await settingsManager.get();
        void settingsManager.set({
            ...currentSettings,
            autoScrapeUrls: enabled,
        });
    };

    const handleCautiousEnterChange = async (enabled: boolean) => {
        setCautiousEnter(enabled);
        const currentSettings = await settingsManager.get();
        void settingsManager.set({
            ...currentSettings,
            cautiousEnter: enabled,
        });

        const db = await Database.load(config.dbUrl);
        await db.execute(
            `INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('cautious_enter', ?)`,
            [enabled ? "true" : "false"],
        );
        await queryClient.invalidateQueries({ queryKey: ["appMetadata"] });
    };

    const handleShowCostChange = async (enabled: boolean) => {
        setShowCost(enabled);
        const currentSettings = await settingsManager.get();
        void settingsManager.set({ ...currentSettings, showCost: enabled });
    };

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

            <div className="space-y-4">
                <div>
                    <label
                        htmlFor="theme-selector"
                        className="block  font-semibold mb-2"
                    >
                        Theme
                    </label>
                    <Select
                        onValueChange={(value) => handleThemeChange(value)}
                        value={getCurrentThemeValue()}
                    >
                        <SelectTrigger id="theme-selector" className="w-full">
                            <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="default-system">
                                System
                            </SelectItem>
                            <Separator />
                            <SelectItem value="default-light">
                                Light
                            </SelectItem>
                            <SelectItem value="default-dark">Dark</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <label
                        htmlFor="sans-font"
                        className="block font-semibold mb-2"
                    >
                        Sans Font
                    </label>
                    <Select
                        onValueChange={(value) =>
                            void handleSansFontChange(value)
                        }
                        value={sansFont}
                    >
                        <SelectTrigger id="sans-font" className="w-full">
                            <SelectValue placeholder="Select sans font" />
                        </SelectTrigger>
                        <SelectContent>
                            {FONT_OPTIONS.sans.map((font) => (
                                <SelectItem
                                    key={font.value}
                                    value={font.value}
                                    onFocus={() =>
                                        void handleSansFontChange(font.value)
                                    }
                                >
                                    <span
                                        className={`font-${font.value
                                            .toLowerCase()
                                            .replace(/\s+/g, "-")}`}
                                    >
                                        {font.label}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <label
                        htmlFor="title-model-selector"
                        className="block font-semibold mb-1"
                    >
                        Chat title model
                    </label>
                    <p className="text-sm text-muted-foreground mb-2">
                        Model used to auto-generate chat titles. Defaults to
                        the ambient chat model.
                    </p>
                    <Select
                        value={titleGenerationModelConfigId ?? "__ambient__"}
                        onValueChange={(value) =>
                            void handleTitleGenerationModelChange(
                                value === "__ambient__" ? undefined : value,
                            )
                        }
                    >
                        <SelectTrigger
                            id="title-model-selector"
                            className="w-full"
                        >
                            <SelectValue placeholder="Ambient model" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__ambient__">
                                Ambient model (default)
                            </SelectItem>
                            {cheapOpenRouterModelOptions.map((config) => (
                                <SelectItem key={config.id} value={config.id}>
                                    {config.displayName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center justify-between pt-2">
                    <div className="space-y-0.5">
                        <div className="font-semibold ">
                            Auto-convert long text
                        </div>
                        <div className=" ">
                            Automatically convert pasted text longer than 5000
                            characters to a file attachment
                        </div>
                    </div>
                    <Switch
                        checked={autoConvertLongText}
                        onCheckedChange={(enabled) =>
                            void handleAutoConvertLongTextChange(enabled)
                        }
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <div className="font-semibold ">
                            Auto-scrape URLs
                        </div>
                        <div className=" ">
                            Automatically scrape and attach content from URLs
                            in your messages
                        </div>
                    </div>
                    <Switch
                        checked={autoScrapeUrls}
                        onCheckedChange={(enabled) =>
                            void handleAutoScrapeUrlsChange(enabled)
                        }
                    />
                </div>

                <div className="flex items-center justify-between pt-2">
                    <div className="space-y-0.5">
                        <div className="font-semibold ">Cautious Enter</div>
                        <div className=" ">
                            Require Cmd+Enter to send messages instead of
                            Enter
                        </div>
                    </div>
                    <Switch
                        checked={cautiousEnter}
                        onCheckedChange={(enabled) =>
                            void handleCautiousEnterChange(enabled)
                        }
                    />
                </div>

                <div className="flex items-center justify-between pt-2">
                    <div className="space-y-0.5">
                        <div className="font-semibold ">
                            Show model cost
                        </div>
                        <div className=" ">
                            Display $ estimate per response, alongside
                            messages and in the sidebar
                        </div>
                    </div>
                    <Switch
                        checked={showCost}
                        onCheckedChange={(enabled) =>
                            void handleShowCostChange(enabled)
                        }
                    />
                </div>
            </div>

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

            {/* Font preloader — hidden, forces the browser to load every
                selectable font-face now rather than on first dropdown open
                (ported verbatim from the pre-rework Settings.tsx; scoped to
                this section since the font selects above are the only thing
                that ever needed it). */}
            <div aria-hidden="true" className="hidden">
                <span className="font-monaspace-xenon">Font preload</span>
                <span className="font-geist">Font preload</span>
                <span className="font-monaspace-neon">Font preload</span>
                <span className="font-sf-pro">Font preload</span>
                <span className="font-inter">Font preload</span>
                <span className="font-jetbrains-mono">Font preload</span>
                <span className="font-fira-code">Font preload</span>
                <span className="font-monaspace-argon">Font preload</span>
                <span className="font-monaspace-krypton">Font preload</span>
                <span className="font-monaspace-radon">Font preload</span>
                <span className="font-geist-mono">Font preload</span>
            </div>
        </div>
    );
}
