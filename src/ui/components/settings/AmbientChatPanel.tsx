/**
 * Ambient (quick) chat enable/shortcut + OS accessibility permission, split
 * out of the pre-rework `DefaultsTab.tsx` (docs/rework/w3-settings-inventory.md
 * items #22-24). Mounted inside the App section's Advanced disclosure.
 */
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { SettingsManager } from "@core/utilities/Settings";
import { toast } from "sonner";
import { relaunch } from "@tauri-apps/plugin-process";
import ShortcutRecorder from "./ShortcutRecorder";
import { AccessibilitySettings } from "./AccessibilityCheck";

export function AmbientChatPanel() {
    const settingsManager = SettingsManager.getInstance();
    const [quickChatEnabled, setQuickChatEnabled] = useState(true);
    const [quickChatShortcut, setQuickChatShortcut] = useState("Alt+Space");

    useEffect(() => {
        const load = async () => {
            const s = await settingsManager.get();
            setQuickChatEnabled(s.quickChat?.enabled ?? true);
            setQuickChatShortcut(s.quickChat?.shortcut ?? "Alt+Space");
        };
        void load();
    }, [settingsManager]);

    const onDefaultQcShortcutClick = async () => {
        setQuickChatShortcut("Alt+Space");
        setQuickChatEnabled(true);
        const currentSettings = await settingsManager.get();
        await settingsManager.set({
            ...currentSettings,
            quickChat: {
                ...currentSettings.quickChat,
                shortcut: "Alt+Space",
                enabled: true,
            },
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <label className="font-semibold">Ambient Chat</label>
                    <p className="text-sm text-muted-foreground">
                        Start an ambient chat with{" "}
                        <span className="font-mono">{quickChatShortcut}</span>
                    </p>
                </div>
                <Switch
                    checked={quickChatEnabled}
                    onCheckedChange={(enabled) => {
                        setQuickChatEnabled(enabled);
                        void (async () => {
                            const current = await settingsManager.get();
                            await settingsManager.set({
                                ...current,
                                quickChat: {
                                    ...current.quickChat,
                                    enabled,
                                },
                            });
                        })();
                    }}
                />
            </div>

            <div className="space-y-2">
                <label className="font-semibold">Keyboard Shortcut</label>
                <p className="text-sm text-muted-foreground">
                    Enter the shortcut you want to use to start an ambient
                    chat.
                </p>
                <ShortcutRecorder
                    value={quickChatShortcut}
                    onChange={(shortcut) => {
                        setQuickChatShortcut(shortcut);
                        void (async () => {
                            const current = await settingsManager.get();
                            await settingsManager.set({
                                ...current,
                                quickChat: {
                                    ...current.quickChat,
                                    shortcut,
                                },
                            });
                        })();
                    }}
                />
                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void onDefaultQcShortcutClick()}
                    >
                        Set to default
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                            if (!quickChatShortcut.trim()) {
                                toast.error("Invalid shortcut", {
                                    description: "Shortcut cannot be empty",
                                });
                                return;
                            }
                            void relaunch().catch(console.error);
                        }}
                    >
                        Save and restart
                    </Button>
                </div>
            </div>

            <AccessibilitySettings />
        </div>
    );
}
