import React, { forwardRef, useCallback } from "react";
import { Textarea } from "@ui/components/ui/textarea";
import { cn } from "@ui/lib/utils";

interface AutoExpandingTextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    autoFocus?: boolean;
    onHeightChange?: (height: number) => void;
}

const AutoExpandingTextarea = forwardRef<
    HTMLTextAreaElement,
    AutoExpandingTextareaProps
>(
    (
        { value, onChange, className, autoFocus, onHeightChange, ...props },
        ref,
    ) => {
        const adjustHeight = useCallback(
            (element: HTMLTextAreaElement | null) => {
                if (element) {
                    const scrollTop = window.scrollY;

                    element.style.height = "auto";
                    element.style.height = `${element.scrollHeight}px`;
                    onHeightChange?.(element.scrollHeight);

                    // Restore scroll position once state changes
                    window.scrollTo(0, scrollTop);
                }
            },
            [onHeightChange],
        );

        return (
            <Textarea
                rows={1}
                ref={(node) => {
                    adjustHeight(node);
                    if (typeof ref === "function") {
                        ref(node);
                    } else if (ref) {
                        ref.current = node;
                    }
                }}
                value={value}
                onChange={(e) => {
                    onChange(e);
                    adjustHeight(e.target);
                }}
                autoFocus={autoFocus}
                className={cn(
                    "resize-none overflow-hidden min-h-0 p-0",
                    className,
                )}
                {...props}
            />
        );
    },
);

export default AutoExpandingTextarea;
