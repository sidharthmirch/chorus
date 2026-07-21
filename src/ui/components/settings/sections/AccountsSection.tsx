import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@ui/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Input } from "../../ui/input";
import { Separator } from "../../ui/separator";
import {
    useProviderAccounts,
    useConnectProviderAccount,
    useDisconnectProviderAccount,
} from "@core/chorus/api/ProviderAccountsAPI";
import type { IProviderAccount } from "@core/chorus/accounts/ProviderAccounts";
import { ProviderAccountCard } from "../../accounts/ProviderAccountCard";
import ApiKeysForm from "../ApiKeysForm";
import * as AppMetadataAPI from "@core/chorus/api/AppMetadataAPI";
import { SettingsManager } from "@core/utilities/Settings";

const settingsManager = SettingsManager.getInstance();

/**
 * `openrouter`'s ProviderAccountsAPI stub only flips to "connected" via the
 * OAuth-style stub connect mutation, which nothing calls automatically when
 * a real API key is typed into ApiKeysForm below — that would show a
 * confusing "not connected" card right next to a key the user just entered.
 * This derives a presentation-only override from the actual `apiKeys` state
 * (never mutates the stub, never touches W1-owned ProviderAccountsAPI.ts).
 */
function withOpenRouterKeyStatus(
    accounts: IProviderAccount[],
    hasOpenRouterKey: boolean,
): IProviderAccount[] {
    return accounts.map((account) =>
        account.providerId === "openrouter"
            ? {
                  ...account,
                  status: hasOpenRouterKey ? "connected" : "not-configured",
              }
            : account,
    );
}

export function AccountsSection() {
    const { data: accounts, isLoading } = useProviderAccounts();
    const connectMutation = useConnectProviderAccount();
    const disconnectMutation = useDisconnectProviderAccount();

    const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
    const [lmStudioBaseUrl, setLmStudioBaseUrl] = useState(
        "http://localhost:1234/v1",
    );
    const queryClient = useQueryClient();
    const customBaseUrl = AppMetadataAPI.useCustomBaseUrl() || "";
    const setCustomBaseUrlMutation = AppMetadataAPI.useSetCustomBaseUrl();

    // Ported verbatim from the pre-rework Settings.tsx (General/API Keys tabs).
    useEffect(() => {
        const loadSettings = async () => {
            const settings = await settingsManager.get();
            setApiKeys(settings.apiKeys ?? {});
            setLmStudioBaseUrl(
                settings.lmStudioBaseUrl ?? "http://localhost:1234/v1",
            );
        };
        void loadSettings();
    }, []);

    const handleApiKeyChange = async (provider: string, value: string) => {
        const currentSettings = await settingsManager.get();
        const newApiKeys = {
            ...currentSettings.apiKeys,
            [provider]: value,
        };
        setApiKeys(newApiKeys);
        void settingsManager.set({
            ...currentSettings,
            apiKeys: newApiKeys,
        });

        void queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
        if (provider === "openrouter") {
            void queryClient.invalidateQueries({ queryKey: ["modelConfigs"] });
        }
    };

    const onLmStudioBaseUrlChange = async (
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const newUrl = e.target.value || "http://localhost:1234/v1";
        setLmStudioBaseUrl(newUrl);
        const currentSettings = await settingsManager.get();
        void settingsManager.set({
            ...currentSettings,
            lmStudioBaseUrl: newUrl,
        });
    };

    const displayAccounts = withOpenRouterKeyStatus(
        accounts ?? [],
        !!apiKeys.openrouter,
    );

    return (
        <div className="space-y-8 max-w-2xl">
            <div>
                <h2 className="text-2xl font-semibold mb-2">Accounts</h2>
                <p className="text-sm text-muted-foreground">
                    Manage providers, keys, and quotas.
                </p>
            </div>

            <div>
                {isLoading ? (
                    <p className="text-sm text-muted-foreground">
                        Loading accounts…
                    </p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {displayAccounts.map((account) => {
                            const isOAuthLike =
                                account.authKind === "oauth" ||
                                account.authKind === "none-local";
                            const isBusyConnect =
                                connectMutation.isPending &&
                                connectMutation.variables?.providerId ===
                                    account.providerId;
                            const isBusyDisconnect =
                                disconnectMutation.isPending &&
                                disconnectMutation.variables?.providerId ===
                                    account.providerId;
                            return (
                                <ProviderAccountCard
                                    key={account.providerId}
                                    account={account}
                                    isBusy={isBusyConnect || isBusyDisconnect}
                                    // Api-key providers (openrouter) connect
                                    // by entering a key below, not via the
                                    // oauth-shaped stub mutation — omitting
                                    // onConnect/onDisconnect here means that
                                    // card renders with no action buttons at
                                    // all, letting the API Keys block below
                                    // be the one honest point of entry.
                                    onConnect={
                                        isOAuthLike
                                            ? () =>
                                                  connectMutation.mutate({
                                                      providerId:
                                                          account.providerId,
                                                  })
                                            : undefined
                                    }
                                    onDisconnect={
                                        isOAuthLike
                                            ? () =>
                                                  disconnectMutation.mutate({
                                                      providerId:
                                                          account.providerId,
                                                  })
                                            : undefined
                                    }
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            <Separator />

            <div className="space-y-2">
                <h3 className="text-lg font-semibold">API keys</h3>
                <p className="text-sm text-muted-foreground">
                    Fallback and additional providers. Used automatically when
                    a provider above isn&apos;t connected via OAuth.
                </p>
                <ApiKeysForm
                    apiKeys={apiKeys}
                    onApiKeyChange={(provider, value) =>
                        void handleApiKeyChange(provider, value)
                    }
                />
            </div>

            <Separator />

            <Collapsible className="space-y-2">
                <CollapsibleTrigger className="flex items-center w-full gap-2 hover:opacity-80">
                    <span className="text-xs font-geist-mono uppercase tracking-wider text-muted-foreground">
                        Advanced
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-6 pt-2">
                    <div className="space-y-2">
                        <label
                            htmlFor="custom-base-url"
                            className="font-semibold"
                        >
                            Custom base URL
                        </label>
                        <Input
                            id="custom-base-url"
                            value={customBaseUrl}
                            onChange={(e) =>
                                void setCustomBaseUrlMutation.mutate(
                                    e.target.value,
                                )
                            }
                            placeholder="https://api.openai.com/v1"
                            className="font-mono"
                        />
                        <p className="text-xs text-muted-foreground">
                            Leave empty to use the default Chorus proxy. When
                            set, all model requests are sent directly to this
                            URL without any path modifications.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor="lm-studio-base-url"
                            className="font-semibold"
                        >
                            LM Studio
                        </label>
                        <p className="text-sm text-muted-foreground">
                            Use a local LM Studio instance.
                        </p>
                        <Input
                            id="lm-studio-base-url"
                            value={lmStudioBaseUrl}
                            onChange={(e) => void onLmStudioBaseUrlChange(e)}
                            placeholder="http://localhost:1234/v1"
                        />
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}
