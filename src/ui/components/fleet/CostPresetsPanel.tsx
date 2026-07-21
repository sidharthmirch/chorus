import { agentProviderName } from "@core/chorus/fleet/agentDisplay";
import { FLEET_ROLES } from "@core/chorus/fleet/copy";
import {
    useActiveFleetCostPreset,
    useFleetCostPresets,
} from "@core/chorus/fleet/useFleet";
import { useSetFleetCostPresetId } from "@core/chorus/fleet/fleetSettings";
import { ProviderLogo } from "@ui/components/ui/provider-logo";
import { Tabs, TabsList, TabsTrigger } from "@ui/components/ui/tabs";

const TAB_TRIGGER_CLASS =
    "h-6 rounded-sm px-2.5 text-xs data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none";

/**
 * Board-only footer section (design/fleet.md's Board ASCII layout; the
 * Worktrees layout has no cost-preset row — see `FleetView.tsx`): preset
 * segmented control + Planner/Worker/Supervisor role chips + estimate line.
 */
export function CostPresetsPanel() {
    const { data: presets } = useFleetCostPresets();
    const activePreset = useActiveFleetCostPreset();
    const setPresetId = useSetFleetCostPresetId();

    if (!presets || presets.length === 0 || !activePreset) return null;

    return (
        <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
            <Tabs
                value={activePreset.id}
                onValueChange={(value) => setPresetId.mutate(value)}
            >
                <TabsList className="h-7 gap-0.5 bg-muted p-0.5">
                    {presets.map((preset) => (
                        <TabsTrigger
                            key={preset.id}
                            value={preset.id}
                            className={TAB_TRIGGER_CLASS}
                        >
                            {preset.name}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            <div className="flex flex-col gap-1">
                {FLEET_ROLES.map((role) => {
                    const assignment = activePreset.roles[role.id];
                    const provider = agentProviderName(assignment.agent);
                    return (
                        <div
                            key={role.id}
                            className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs"
                        >
                            <span className="w-44 shrink-0 text-muted-foreground">
                                {role.label}
                            </span>
                            <span className="inline-flex shrink-0 items-center gap-1.5 text-foreground">
                                {provider && (
                                    <ProviderLogo provider={provider} size="sm" />
                                )}
                                {assignment.modelLabel}
                            </span>
                            <span className="text-muted-foreground">
                                {role.note}
                            </span>
                        </div>
                    );
                })}
            </div>

            <p className="font-geist-mono text-[11px] text-muted-foreground">
                {activePreset.estimateText}
            </p>
        </div>
    );
}
