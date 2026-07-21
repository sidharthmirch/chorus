import { useState } from "react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@ui/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Separator } from "../../ui/separator";
import { ModelSettingsRows } from "../../model-select/ModelSettingsRows";
import { ModelProfilesTab } from "../ModelProfilesTab";
import { ModelDefaultsPanel } from "../ModelDefaultsPanel";
import { useSettings } from "../../hooks/useSettings";
import type { ISettingsSectionProps } from "../registry";

export function ModelsSection({ navigateToSection }: ISettingsSectionProps) {
    const settings = useSettings();
    const showCost = settings?.showCost ?? false;
    const [advancedOpen, setAdvancedOpen] = useState(false);

    return (
        <div className="space-y-8 max-w-2xl">
            <div>
                <h2 className="text-2xl font-semibold mb-2">Models</h2>
                <p className="text-sm text-muted-foreground">
                    Configure model profiles and visibility.
                </p>
            </div>

            <ModelSettingsRows
                showCost={showCost}
                onAddApiKey={() => navigateToSection("accounts")}
            />

            <Separator />

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger className="flex items-center w-full gap-2 hover:opacity-80">
                    <span className="text-xs font-geist-mono uppercase tracking-wider text-muted-foreground">
                        Advanced
                    </span>
                    <ChevronDown
                        className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                            advancedOpen ? "rotate-180" : ""
                        }`}
                    />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-10 pt-6">
                    <div>
                        <h3 className="text-lg font-semibold mb-3">
                            Chat defaults
                        </h3>
                        <ModelDefaultsPanel />
                    </div>

                    <Separator />

                    <ModelProfilesTab />
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}
