import { useState } from "react";
import { UserCircle, Check, Settings } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
    useChatPromptProfile,
    usePromptProfiles,
    useSetChatPromptProfile,
} from "@core/chorus/api/PromptProfilesAPI";
import { dialogActions } from "@core/infra/DialogStore";
import { SETTINGS_DIALOG_ID } from "./Settings";

export function PromptProfilePill({ chatId }: { chatId: string }) {
    const [open, setOpen] = useState(false);
    const activeProfile = useChatPromptProfile(chatId);
    const { data: profiles } = usePromptProfiles();
    const setProfile = useSetChatPromptProfile();

    const handleSelect = (profileId: string | null) => {
        setProfile.mutate({ chatId, profileId });
        setOpen(false);
    };

    const handleManage = () => {
        setOpen(false);
        dialogActions.openDialog(SETTINGS_DIALOG_ID);
    };

    const trigger = activeProfile ? (
        <button
            className="inline-flex bg-muted items-center justify-center rounded-full h-7 pl-2 text-sm hover:bg-muted/80 px-3 py-1 ring-offset-background focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 flex-shrink-0 gap-1.5"
            aria-label={`Prompt profile: ${activeProfile.name}`}
        >
            {activeProfile.icon ? (
                <span className="text-xs leading-none">{activeProfile.icon}</span>
            ) : (
                <UserCircle className="w-3 h-3" />
            )}
            <span>{activeProfile.name}</span>
        </button>
    ) : (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    className="inline-flex bg-muted items-center justify-center rounded-full h-7 w-7 text-sm hover:bg-muted/80 ring-offset-background focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 flex-shrink-0 text-muted-foreground"
                    aria-label="Set prompt profile"
                >
                    <UserCircle className="w-3.5 h-3.5" />
                </button>
            </TooltipTrigger>
            <TooltipContent>Set prompt profile</TooltipContent>
        </Tooltip>
    );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent
                className="w-64 p-2"
                align="start"
                side="top"
                sideOffset={8}
            >
                <div className="space-y-1">
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Prompt Profile
                    </div>

                    {/* None option */}
                    <button
                        className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted text-left"
                        onClick={() => handleSelect(null)}
                    >
                        <span className="w-4 flex-shrink-0">
                            {!activeProfile && (
                                <Check className="w-3.5 h-3.5 text-primary" />
                            )}
                        </span>
                        <span className="text-muted-foreground">None</span>
                    </button>

                    {profiles?.map((p) => (
                        <button
                            key={p.id}
                            className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted text-left"
                            onClick={() => handleSelect(p.id)}
                        >
                            <span className="w-4 flex-shrink-0">
                                {activeProfile?.id === p.id && (
                                    <Check className="w-3.5 h-3.5 text-primary" />
                                )}
                            </span>
                            <span className="flex items-center gap-1.5 min-w-0">
                                {p.icon && (
                                    <span className="text-xs flex-shrink-0">
                                        {p.icon}
                                    </span>
                                )}
                                <span className="truncate">{p.name}</span>
                            </span>
                        </button>
                    ))}

                    <div className="border-t mt-1 pt-1">
                        <button
                            className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted text-left text-muted-foreground"
                            onClick={handleManage}
                        >
                            <Settings className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Manage profiles...</span>
                        </button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
