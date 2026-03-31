import React from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";

/**
 * Combines useDraggable + useDroppable on the same element so it acts as
 * both a drag source and a drop target — the standard @dnd-kit pattern for
 * building a sortable list without @dnd-kit/sortable.
 *
 * While dragging, the original element is hidden (opacity 0) so only the
 * DragOverlay provided by the parent DndContext is visible.
 */
export function SortableColumnItem({
    id,
    disabled,
    className,
    children,
}: {
    id: string;
    disabled: boolean;
    className: string;
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

    return (
        <div
            ref={(node) => {
                setDragRef(node);
                setDropRef(node);
            }}
            {...attributes}
            className={className}
            style={{ opacity: isDragging ? 0 : 1 }}
        >
            {children(disabled ? undefined : listeners)}
        </div>
    );
}
