import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@ui/lib/utils";

/**
 * Closed-by-default disclosure for deprecated models. New behavior vs the
 * pre-rework picker, which excluded deprecated models entirely rather than
 * collapsing them (docs/rework/w4-model-select-inventory.md §2) — rows
 * inside are unmounted while closed, so they're simply absent from cmdk's
 * keyboard-nav order until opened (consistent with "collapsed", not a
 * cmdk-specific hack).
 */
export function DeprecatedSection({
    count,
    children,
    className,
}: {
    count: number;
    children: React.ReactNode;
    className?: string;
}) {
    const [open, setOpen] = useState(false);

    if (count === 0) return null;

    return (
        <div className={cn("px-2 py-1", className)}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="flex w-full items-center gap-1 py-1 text-muted-foreground transition-colors hover:text-foreground"
            >
                {open ? (
                    <ChevronDownIcon className="h-3 w-3 shrink-0" />
                ) : (
                    <ChevronRightIcon className="h-3 w-3 shrink-0" />
                )}
                <span className="font-geist-mono text-[10px] uppercase tracking-wider">
                    Deprecated · {count}
                </span>
            </button>
            {open && <div className="mt-1">{children}</div>}
        </div>
    );
}
