import * as React from "react";
import { DialogTitle, type DialogProps } from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";

import { cn } from "@/ui/lib/utils";
import { Dialog, DialogContent } from "@/ui/components/ui/dialog";

const Command = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
    <CommandPrimitive
        ref={ref}
        className={cn(
            "flex h-full w-full flex-col overflow-hidden rounded-md",
            className,
        )}
        {...props}
    />
));
Command.displayName = CommandPrimitive.displayName;

// modifications made here per https://github.com/shadcn-ui/ui/discussions/4147
// to support shouldFilter={false} -JDC
interface CommandDialogProps extends DialogProps {
    commandProps?: React.ComponentPropsWithoutRef<typeof CommandPrimitive>;
    id: string;
}

const CommandDialog = ({
    children,
    commandProps,
    id,
    ...props
}: CommandDialogProps) => {
    return (
        <Dialog {...props} id={id}>
            <DialogContent
                className="overflow-hidden p-0 shadow-lg max-w-xl h-[600px]"
                aria-describedby={undefined}
                onKeyDown={(e) => {
                    // Prevent Escape key from propagating to parent components
                    if (e.key === "Escape") {
                        e.stopPropagation();
                    }
                }}
            >
                <DialogTitle className="sr-only">Search</DialogTitle>
                <Command
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5]"
                    {...commandProps}
                >
                    {children}
                </Command>
            </DialogContent>
        </Dialog>
    );
};

type CommandInputProps = React.ComponentPropsWithoutRef<
    typeof CommandPrimitive.Input
> & {
    /** Shown at the end of the search row (e.g. keyboard hints). */
    trailing?: React.ReactNode;
};

const CommandInput = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.Input>,
    CommandInputProps
>(({ className, trailing, ...props }, ref) => (
    <div
        className="relative flex items-center border-b px-3 bg-background min-w-0"
        cmdk-input-wrapper=""
    >
        <Search className="mr-2 !h-4 !w-4 shrink-0 opacity-50" />
        <CommandPrimitive.Input
            ref={ref}
            className={cn(
                "flex h-11 min-w-0 flex-1 rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground placeholder:text-base disabled:cursor-not-allowed disabled:opacity-50 bg-background",
                trailing && "pr-[10.5rem]",
                className,
            )}
            {...props}
        />
        {trailing ? (
            <div
                className="pointer-events-none absolute inset-y-0 right-3 z-[1] flex items-center justify-end gap-1.5 text-xs text-muted-foreground whitespace-nowrap"
                aria-hidden
            >
                {trailing}
            </div>
        ) : null}
    </div>
));

CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
    <CommandPrimitive.List
        ref={ref}
        className={cn("overflow-y-auto overflow-x-hidden", className)}
        {...props}
    />
));

CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.Empty>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
    <CommandPrimitive.Empty
        ref={ref}
        className="py-6 text-center text-sm tracking-wider uppercase font-[350] text-gray-500 font-geist-mono"
        {...props}
    />
));

CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.Group>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
    <CommandPrimitive.Group
        ref={ref}
        className={cn(
            "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:font-geist-mono [&_[cmdk-group-heading]]:text-muted-foreground",
            className,
        )}
        {...props}
    />
));

CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.Separator>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
    <CommandPrimitive.Separator
        ref={ref}
        className={cn("-mx-1 h-px bg-border", className)}
        {...props}
    />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = React.forwardRef<
    React.ElementRef<typeof CommandPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
    <CommandPrimitive.Item
        ref={ref}
        className={cn(
            "relative flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 outline-none weight-medium data-[disabled=true]:pointer-events-none data-[selected='true']:bg-sidebar-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
            className,
        )}
        {...props}
    />
));

CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
    return (
        <span
            className={cn(
                "ml-auto text-sm tracking-widest text-muted-foreground",
                className,
            )}
            {...props}
        />
    );
};
CommandShortcut.displayName = "CommandShortcut";

export {
    Command,
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandShortcut,
    CommandSeparator,
};
