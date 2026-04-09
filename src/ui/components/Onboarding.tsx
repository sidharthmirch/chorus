import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { SettingsManager } from "@core/utilities/Settings";
import * as AppMetadataAPI from "@core/chorus/api/AppMetadataAPI";
import { useQueryClient } from "@tanstack/react-query";

type OnboardingProvider = "openrouter" | "google" | "openai" | "anthropic";

const ONBOARDING_API_KEY_FIELDS: Array<{
    provider: OnboardingProvider;
    label: string;
    placeholder: string;
}> = [
    {
        provider: "openrouter",
        label: "OpenRouter API key",
        placeholder: "sk-or-v1-...",
    },
    {
        provider: "google",
        label: "Google AI API key",
        placeholder: "AIza...",
    },
    {
        provider: "openai",
        label: "OpenAI API key",
        placeholder: "sk-...",
    },
    {
        provider: "anthropic",
        label: "Anthropic API key",
        placeholder: "sk-ant-...",
    },
];

const EMPTY_API_KEY_INPUTS: Record<OnboardingProvider, string> = {
    openrouter: "",
    google: "",
    openai: "",
    anthropic: "",
};

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
    const onboardingStep = AppMetadataAPI.useOnboardingStep();
    const setOnboardingStep = AppMetadataAPI.useSetOnboardingStep();
    const [apiKeyInputs, setApiKeyInputs] = useState(EMPTY_API_KEY_INPUTS);
    const [isSaving, setIsSaving] = useState(false);
    const queryClient = useQueryClient();

    const hasAnyApiKey = useMemo(
        () =>
            Object.values(apiKeyInputs).some(
                (apiKey) => apiKey.trim().length > 0,
            ),
        [apiKeyInputs],
    );

    const handleNextStep = useCallback(() => {
        setOnboardingStep.mutate({ step: 1 });
    }, [setOnboardingStep]);

    const handleSaveAndComplete = useCallback(async () => {
        setIsSaving(true);
        try {
            const settingsManager = SettingsManager.getInstance();
            const currentSettings = await settingsManager.get();

            const trimmedApiKeys: Partial<Record<OnboardingProvider, string>> =
                {};
            for (const field of ONBOARDING_API_KEY_FIELDS) {
                const value = apiKeyInputs[field.provider].trim();
                if (value.length > 0) {
                    trimmedApiKeys[field.provider] = value;
                }
            }

            const updatedSettings = {
                ...currentSettings,
                apiKeys: {
                    ...currentSettings.apiKeys,
                    ...trimmedApiKeys,
                },
            };

            await settingsManager.set(updatedSettings);
            await queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
        } finally {
            setIsSaving(false);
        }

        onComplete();
    }, [apiKeyInputs, queryClient, onComplete]);

    const handleApiKeyChange = useCallback(
        (provider: OnboardingProvider, value: string) => {
            setApiKeyInputs((previous) => ({
                ...previous,
                [provider]: value,
            }));
        },
        [],
    );

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                if (onboardingStep === 0) {
                    handleNextStep();
                } else if (onboardingStep === 1 && !isSaving) {
                    void handleSaveAndComplete();
                }
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [onboardingStep, handleNextStep, handleSaveAndComplete, isSaving]);

    if (onboardingStep === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="text-center space-y-6 max-w-3xl w-full">
                    <div className="space-y-2">
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Welcome to Chorus
                        </h1>
                        <p className="text text-muted-foreground pb-6">
                            All the AI, on your Mac.
                        </p>
                        <img
                            src="https://meltylabs.t3.storage.dev/screenshot_light.png"
                            className="rounded-lg max-w-3xl mx-auto border border-border shadow-sm"
                            alt="Chorus screenshot"
                        />
                    </div>

                    <Button className="mt-4" onClick={handleNextStep}>
                        Get started <span className="text-sm">↵</span>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="w-full max-w-md space-y-6">
                <div className="space-y-2 text-center">
                    <h2 className="text-xl font-semibold tracking-tight">
                        Optional API keys
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Add keys now or skip and configure them later in
                        Settings.
                    </p>
                </div>

                <div className="space-y-4">
                    {ONBOARDING_API_KEY_FIELDS.map((field) => (
                        <div key={field.provider} className="space-y-2">
                            <Label htmlFor={`${field.provider}-api-key`}>
                                {field.label}
                            </Label>
                            <Input
                                id={`${field.provider}-api-key`}
                                placeholder={field.placeholder}
                                value={apiKeyInputs[field.provider]}
                                onChange={(event) =>
                                    handleApiKeyChange(
                                        field.provider,
                                        event.target.value,
                                    )
                                }
                            />
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-2">
                    <Button
                        className="w-full"
                        onClick={() => void handleSaveAndComplete()}
                        disabled={isSaving}
                    >
                        {hasAnyApiKey ? "Save and continue" : "Skip for now"}{" "}
                        <span className="text-sm">↵</span>
                    </Button>
                </div>
            </div>
        </div>
    );
}
