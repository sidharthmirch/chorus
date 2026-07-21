import { useState } from "react";
import { Circle, Check, Settings } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import * as ModesAPI from "@core/chorus/api/ModesAPI";
import { dialogActions } from "@core/infra/DialogStore";
import { SETTINGS_DIALOG_ID } from "../Settings";

/**
 * Composer mode/stance picker (design/composer.md "Mode Selector Popover").
 * Mirrors `PromptProfilePill.tsx`'s structure/conventions closely — same
 * Popover shape, same "None" + list + "Manage ..." footer pattern — but for
 * the *separate* Modes entity (Assist/Critic/Socratic/custom stances), not
 * the pre-existing prompt-profile persona feature. See
 * docs/rework/w6-chat-recon.md §8 for why these are deliberately parallel,
 * not merged.
 *
 * Selecting a mode here sets it as the chat's current mode (persisted via
 * `useSetChatMode`, same "sticky until changed" semantics as
 * `PromptProfilePill`). The per-message-set *historical* record (which mode
 * was actually active when a given turn was sent) is a separate, immutable
 * snapshot written server-side at send time — see `ModesAPI`'s doc comments
 * and docs/rework/w6-chat-recon.md §3/§4. This pill only ever reflects/sets
 * "the mode that will apply to the next message."
 */
export function ModePickerPill({ chatId }: { chatId: string }) {
    const [open, setOpen] = useState(false);
    const activeMode = ModesAPI.useChatMode(chatId);
    const { data: modes } = ModesAPI.useModes();
    const setChatMode = ModesAPI.useSetChatMode();

    const handleSelect = (modeId: string | null) => {
        setChatMode.mutate({ chatId, modeId });
        setOpen(false);
    };

    const handleManage = () => {
        setOpen(false);
        dialogActions.openDialog(SETTINGS_DIALOG_ID);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            {activeMode ? (
                <PopoverTrigger asChild>
                    <button
                        className="inline-flex bg-muted items-center justify-center rounded-full h-7 pl-2 text-sm hover:bg-muted/80 px-3 py-1 ring-offset-background focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 flex-shrink-0 gap-1.5 max-w-[12rem] min-w-0 overflow-hidden"
                        aria-label={`Mode: ${activeMode.name}`}
                    >
                        <span className="text-xs leading-none">
                            {activeMode.icon}
                        </span>
                        <span className="truncate">{activeMode.name}</span>
                    </button>
                </PopoverTrigger>
            ) : (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                            <button
                                className="inline-flex bg-muted items-center justify-center rounded-full h-7 w-7 text-sm hover:bg-muted/80 ring-offset-background focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 flex-shrink-0 text-muted-foreground"
                                aria-label="Set mode"
                            >
                                <Circle className="w-3.5 h-3.5" />
                            </button>
                        </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Mode · next message</TooltipContent>
                </Tooltip>
            )}
            <PopoverContent
                className="w-[300px] p-2"
                align="start"
                side="top"
                sideOffset={8}
            >
                <div className="space-y-1">
                    <div className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Mode · next message
                    </div>

                    {/* None option */}
                    <button
                        className="w-full flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted text-left"
                        onClick={() => handleSelect(null)}
                    >
                        <span className="w-4 flex-shrink-0 pt-0.5">
                            {!activeMode && (
                                <Check className="w-3.5 h-3.5 text-primary" />
                            )}
                        </span>
                        <span className="flex-1 min-w-0">
                            <span className="text-muted-foreground block">
                                None
                            </span>
                            <span className="block text-[11px] text-muted-foreground/70">
                                No stance. Raw model, mode off.
                            </span>
                        </span>
                    </button>

                    {modes?.map((mode) => (
                        <button
                            key={mode.id}
                            className="w-full flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted text-left"
                            onClick={() => handleSelect(mode.id)}
                        >
                            <span className="w-4 flex-shrink-0 pt-0.5">
                                {activeMode?.id === mode.id && (
                                    <Check className="w-3.5 h-3.5 text-primary" />
                                )}
                            </span>
                            <span className="flex-1 min-w-0">
                                <span className="flex items-center gap-1.5 block">
                                    {mode.icon && (
                                        <span className="text-xs flex-shrink-0">
                                            {mode.icon}
                                        </span>
                                    )}
                                    <span className="truncate">
                                        {mode.name}
                                    </span>
                                </span>
                                <span className="block text-[11px] text-muted-foreground/70">
                                    {mode.description}
                                </span>
                            </span>
                        </button>
                    ))}

                    <div className="border-t mt-1 pt-1">
                        <button
                            className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted text-left text-muted-foreground"
                            onClick={handleManage}
                        >
                            <Settings className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Manage modes...</span>
                        </button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
