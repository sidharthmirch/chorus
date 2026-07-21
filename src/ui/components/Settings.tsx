import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@ui/components/ui/dialog";
import { Button } from "./ui/button";
import { useDialogStore, dialogActions } from "@core/infra/DialogStore";
import ImportChatDialog from "./ImportChatDialog";
import { SettingsShell } from "./settings/SettingsShell";
import { resolveSettingsSection } from "./settings/registry";
import type { SettingsSectionId } from "./settings/registry";

export const SETTINGS_DIALOG_ID = "settings";

/** Re-exported so existing call sites (`App.tsx`, `CommandMenu.tsx`) keep
 *  importing a section id type from "./Settings" without knowing it now
 *  lives in `settings/registry.ts`. */
export type { SettingsSectionId };

interface SettingsProps {
    /**
     * Accepts the new 5-section ids *and* every pre-rework 12-tab id (plus
     * the dead legacy `"quick-chat"` value) — `resolveSettingsSection` maps
     * old values onto the new IA so every existing `open_settings` emitter
     * (menu, sidebar, ManageModelsBox, ModelSettingsRows' fallback) keeps
     * working without each call site needing to know about the rework.
     */
    section?: string;
}

const SETTINGS_ROUTE_PATTERN = /^\/settings\/?([a-z-]*)$/;

/**
 * Thin Dialog wrapper + route bridge around `SettingsShell`. Deliberately
 * NOT a `<Route>` element inside `App.tsx`'s `<Routes>` — Settings has
 * always been a floating overlay that never unmounts whatever chat is open
 * behind it (unlike Fleet/Wiki, which are destinations you navigate *to*).
 * `/settings` and `/settings/:section` are layered on top as an *additional*
 * way in: this component watches `useLocation()` and opens the dialog when
 * the URL matches, and leaves the URL behind (`navigate(-1)`) when the
 * dialog closes any other way (Escape, overlay click, the [x] below).
 * Full reasoning: `settings/MIGRATION-NOTES.md`.
 */
export default function Settings({ section }: SettingsProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const isSettingsDialogOpen = useDialogStore(
        (state) => state.activeDialogId === SETTINGS_DIALOG_ID,
    );
    const isRouteActive = SETTINGS_ROUTE_PATTERN.test(location.pathname);

    // Deep link: navigating to /settings or /settings/:section from
    // anywhere (typed URL, another feature's `navigate()`) opens the dialog
    // even though nothing called `open_settings`/`openDialog` directly.
    useEffect(() => {
        if (isRouteActive && !isSettingsDialogOpen) {
            dialogActions.openDialog(SETTINGS_DIALOG_ID);
        }
    }, [isRouteActive, isSettingsDialogOpen]);

    const handleOpenChange = (open: boolean) => {
        if (!open && isRouteActive) {
            navigate(-1);
        }
    };

    const handleCloseClick = () => {
        dialogActions.closeDialog(SETTINGS_DIALOG_ID);
        if (isRouteActive) {
            navigate(-1);
        }
    };

    const requestedSection = resolveSettingsSection(section);

    return (
        <>
            <Dialog id={SETTINGS_DIALOG_ID} onOpenChange={handleOpenChange}>
                <DialogContent
                    className="max-w-4xl p-0 h-[85vh] overflow-hidden flex flex-col"
                    aria-describedby={undefined}
                >
                    <DialogHeader className="sr-only">
                        <DialogTitle>Settings</DialogTitle>
                        <DialogDescription>
                            Manage your Chorus settings
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
                        <span className="text-base font-medium">Settings</span>
                        <Button
                            variant="ghost"
                            size="iconSm"
                            onClick={handleCloseClick}
                            aria-label="Close settings"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex-1 min-h-0">
                        <SettingsShell requestedSection={requestedSection} />
                    </div>
                </DialogContent>
            </Dialog>
            <ImportChatDialog provider="openai" />
            <ImportChatDialog provider="anthropic" />
        </>
    );
}
