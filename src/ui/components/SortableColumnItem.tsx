import React from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";

/**
 * Combines useDraggable + useDroppable on the same element so it acts as
 * both a drag source and a drop target — the standard @dnd-kit pattern for
 * building a sortable list without @dnd-kit/sortable.
 *
 * While dragging, the original element is hidden (opacity 0) so only the
 * DragOverlay provided by the parent DndContext is visible.
 *
 * When another item is being dragged over a neighbor, items between the
 * drag source and the drop target shift horizontally to preview the
 * reorder.
 */
export function SortableColumnItem({
    id,
    disabled,
    className,
    activeDragId,
    overId,
    itemOrder,
    children,
}: {
    id: string;
    disabled: boolean;
    className: string;
    /** The id of the item currently being dragged (null if no drag) */
    activeDragId: string | null;
    /** The id of the item currently being hovered over (null if none) */
    overId: string | null;
    /** The current order of item ids, used to calculate shift direction */
    itemOrder: string[];
    children: (
        listeners: ReturnType<typeof useDraggable>["listeners"],
    ) => React.ReactNode;
}) {
    const {
        attributes,
        listeners,
        setNodeRef: setDragRef,
        isDragging,
    } = useDraggable({ id, disabled });
    const { setNodeRef: setDropRef } = useDroppable({ id });

    // Calculate whether this item should shift to make room for the dragged item
    let translatePercent = 0;
    let replacementDirection: "left" | "right" | null = null;
    if (activeDragId && overId && activeDragId !== overId && !isDragging) {
        const activeIndex = itemOrder.indexOf(activeDragId);
        const overIndex = itemOrder.indexOf(overId);
        const myIndex = itemOrder.indexOf(id);

        if (activeIndex !== -1 && overIndex !== -1 && myIndex !== -1) {
            // Dragging right: items between active+1..over shift left
            if (
                activeIndex < overIndex &&
                myIndex > activeIndex &&
                myIndex <= overIndex
            ) {
                translatePercent = -100;
            }
            // Dragging left: items between over..active-1 shift right
            if (
                activeIndex > overIndex &&
                myIndex >= overIndex &&
                myIndex < activeIndex
            ) {
                translatePercent = 100;
            }

            // Highlight the hovered replacement target so it's clear which item
            // is being displaced by the drop.
            if (id === overId) {
                replacementDirection = activeIndex < overIndex ? "left" : "right";
            }
        }
    }

    const replacementNudgePx =
        replacementDirection === "left"
            ? -14
            : replacementDirection === "right"
              ? 14
              : 0;
    const transform =
        translatePercent !== 0 || replacementNudgePx !== 0
            ? `translateX(calc(${translatePercent}% + ${replacementNudgePx}px))`
            : undefined;
    const isReplacementTarget = replacementDirection !== null;
    const stackOffset = replacementNudgePx > 0 ? 8 : -8;

    return (
        <div
            ref={(node) => {
                setDragRef(node);
                setDropRef(node);
            }}
            {...attributes}
            className={className}
            style={{
                opacity: isDragging ? 0 : isReplacementTarget ? 0.92 : 1,
                transform,
                boxShadow: isReplacementTarget
                    ? `${stackOffset}px 0 0 hsl(var(--border-accent) / 0.22)`
                    : undefined,
                outline: isReplacementTarget
                    ? "1px dashed hsl(var(--border-accent) / 0.7)"
                    : undefined,
                outlineOffset: isReplacementTarget ? "2px" : undefined,
                transition: activeDragId
                    ? "transform 220ms ease, box-shadow 180ms ease, opacity 180ms ease"
                    : undefined,
            }}
        >
            {children(disabled ? undefined : listeners)}
        </div>
    );
}
