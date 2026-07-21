import {
    useActiveModelProfile,
    useModelProfiles,
    useSetActiveModelProfile,
} from "@core/chorus/api/ModelProfilesAPI";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@ui/components/ui/select";
import { Button } from "@ui/components/ui/button";

/**
 * Ported from `ManageModelsBox.tsx`'s inline `ProfileSelector` + "Apply"
 * button (docs/rework/w4-model-select-inventory.md §2 — "Model Profiles
 * integration"). Note: `ModelProfilesAPI`'s `ModelProfile` ("named set of
 * models") is unrelated to the design mock's per-model "profile" pill,
 * which `SelectedPreviewPanel` implements separately as a variant switcher
 * — both are surfaced, neither renamed, to avoid colliding two different
 * pre-existing/target concepts that happen to share one word.
 */
export interface ProfileFilterBarProps {
    /** Only the composer's default/compare mode gets "Apply" (replace selection with the profile). */
    showApply?: boolean;
    onApply?: () => void;
    applyDisabled?: boolean;
    applyTitle?: string;
}

export function ProfileFilterBar({
    showApply = false,
    onApply,
    applyDisabled,
    applyTitle,
}: ProfileFilterBarProps) {
    const { data: profiles } = useModelProfiles();
    const activeProfile = useActiveModelProfile();
    const setActiveProfile = useSetActiveModelProfile();

    if (!profiles || profiles.length === 0) return null;

    return (
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <Select
                value={activeProfile?.id ?? "none"}
                onValueChange={(value) =>
                    setActiveProfile.mutate(value === "none" ? null : value)
                }
            >
                <SelectTrigger className="h-7 px-2.5 py-1 text-xs">
                    <SelectValue placeholder="No Profile" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">No Profile</SelectItem>
                    {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                            {p.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {showApply && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 px-3 text-xs font-medium"
                    onClick={(e) => {
                        e.preventDefault();
                        onApply?.();
                    }}
                    disabled={applyDisabled}
                    title={applyTitle}
                >
                    Apply
                </Button>
            )}
        </div>
    );
}
