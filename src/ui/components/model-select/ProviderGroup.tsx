import { ReactNode } from "react";
import { CommandGroup } from "@ui/components/ui/command";

export interface ProviderGroupProps {
    heading: ReactNode;
    /** Trailing slot next to the heading (refresh button, hide toggle, "Add" for Custom). */
    trailing?: ReactNode;
    /** Replaces `children` entirely when the group has nothing selectable to show. */
    emptyState?: ReactNode;
    children: ReactNode;
}

/**
 * Thin, generic heading+rows wrapper over `command.tsx`'s `CommandGroup` —
 * ported from `ManageModelsBox.tsx`'s inline `ModelGroup`, but decoupled
 * from any specific mode/callback shape so it's reusable across the
 * composer popover, add/single lists, and Settings rows.
 */
export function ProviderGroup({ heading, trailing, emptyState, children }: ProviderGroupProps) {
    return (
        <CommandGroup
            heading={
                <div className="flex w-full items-center justify-between">
                    {heading}
                    {trailing}
                </div>
            }
        >
            {emptyState ?? children}
        </CommandGroup>
    );
}
