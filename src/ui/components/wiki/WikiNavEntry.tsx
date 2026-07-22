import { BookOpenIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@ui/lib/utils";

/**
 * W8 — Wiki sidebar nav entry. Self-contained (own navigate + active-state
 * logic), mirroring `fleet/FleetSessionsCluster.tsx`'s pattern so
 * `AppSidebar.tsx`'s diff for this workstream stays a single import + a
 * single render line, matching the ownership map's "separate,
 * clearly-bounded insertions" rule for that file.
 */
export function WikiNavEntry() {
    const navigate = useNavigate();
    const location = useLocation();
    const isActive = location.pathname === "/wiki";

    return (
        <button
            type="button"
            className={cn(
                "text-base pl-3 pr-3 py-2 flex items-center gap-2 hover:bg-sidebar-accent rounded-md w-full mb-2",
                isActive
                    ? "text-foreground bg-sidebar-accent"
                    : "text-sidebar-muted-foreground hover:text-foreground",
            )}
            onClick={() => navigate("/wiki")}
        >
            <BookOpenIcon className="size-4" strokeWidth={1.5} />
            Wiki
        </button>
    );
}
