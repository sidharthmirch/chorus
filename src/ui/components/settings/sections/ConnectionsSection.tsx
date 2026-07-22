import { useState } from "react";
import { toast } from "sonner";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@ui/components/ui/tabs";
import { Plus } from "lucide-react";
import { Separator } from "../../ui/separator";
import { CustomToolsetConfig, getEnvFromJSON } from "@core/chorus/Toolsets";
import * as ToolsetsAPI from "@core/chorus/api/ToolsetsAPI";
import { ToolsetsManager } from "@core/chorus/ToolsetsManager";
import { getToolsetIcon } from "@core/chorus/Toolsets";
import { FleetDaemonCard } from "../connections/FleetDaemonCard";
import {
    RemoteToolsetForm,
    ToolsetForm,
} from "../connections/ToolsetForms";
import { CustomToolsetRow } from "../connections/CustomToolsetRow";
import { RECOMMENDED_TOOLSETS } from "../connections/recommendedToolsets";
import {
    QuickStartGrid,
    GitHubManageConnectionButton,
} from "../connections/QuickStartGrid";

const CORE_BUILTIN_TOOLSETS_DATA = ToolsetsManager.instance
    .listToolsets()
    .filter((toolset) => toolset.isBuiltIn)
    .map((toolset) => ({
        name: toolset.name,
        displayName: toolset.displayName,
        icon: () => getToolsetIcon(toolset.name),
        description: toolset.description,
    }));

/**
 * MCP toolsets + the fleetd endpoint card. "Domain configs" from
 * design/settings.md (bundling tools+mode+artifact-palette per domain) is
 * intentionally not built here — no such concept exists anywhere in the
 * current codebase to migrate; see docs/rework/w3-settings-inventory.md's
 * deviations list. Ported from the pre-rework `Settings.tsx`'s `ToolsTab`.
 */
export function ConnectionsSection() {
    const { data: customToolsetConfigs = [] } =
        ToolsetsAPI.useCustomToolsetConfigs();
    const updateToolset = ToolsetsAPI.useUpdateCustomToolsetConfig();
    const deleteToolset = ToolsetsAPI.useDeleteCustomToolsetConfig();
    const importFromClaudeDesktop = ToolsetsAPI.useImportFromClaudeDesktop();

    const [formMode, setFormMode] = useState<
        "create" | "edit" | "remote" | null
    >(null);
    const [editingToolset, setEditingToolset] = useState<CustomToolsetConfig>({
        name: "",
        command: "",
        args: "",
        env: "{}",
    });
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [activeToolsetTab, setActiveToolsetTab] = useState<
        "custom" | "builtin"
    >("custom");

    const validateToolset = (
        toolset: CustomToolsetConfig,
        isEditing: boolean,
    ) => {
        const errors: Record<string, string> = {};
        if (!toolset.name) errors.name = "Name is required";
        if (!toolset.command) errors.command = "Command is required";

        if (toolset.name && !/^[a-z0-9-]+$/.test(toolset.name)) {
            errors.name =
                "Name must be one word, lowercase, and contain only letters, numbers, and dashes";
        }

        if (
            toolset.name &&
            !isEditing &&
            customToolsetConfigs.some((t) => t.name === toolset.name)
        ) {
            errors.name = "Name already exists";
        }

        if (toolset.env) {
            try {
                const envParsed = getEnvFromJSON(toolset.env);
                if (envParsed._type === "error") {
                    errors.env = envParsed.error;
                }
            } catch {
                errors.env = "Invalid JSON format";
            }
        }

        return errors;
    };

    const handleEditToolset = (toolset: CustomToolsetConfig) => {
        setFormMode("edit");
        setEditingToolset({ ...toolset });
        setFormErrors({});
    };

    const handleCreateToolset = () => {
        setFormMode("create");
        setEditingToolset({ name: "", command: "", args: "", env: "{}" });
        setFormErrors({});
    };

    const handleCreateRemoteToolsetForm = () => {
        setFormMode("remote");
        setFormErrors({});
    };

    const handleCancelForm = () => {
        setFormMode(null);
        setEditingToolset({ name: "", command: "", args: "", env: "{}" });
        setFormErrors({});
    };

    const handleFieldChange = (
        field: keyof CustomToolsetConfig,
        value: string,
    ) => {
        const updatedToolset = { ...editingToolset, [field]: value };
        setEditingToolset(updatedToolset);
        setFormErrors(validateToolset(updatedToolset, formMode === "edit"));
    };

    const handleSaveToolset = async () => {
        const validationErrors = validateToolset(
            editingToolset,
            formMode === "edit",
        );
        if (Object.keys(validationErrors).length > 0) {
            setFormErrors(validationErrors);
            return;
        }

        try {
            await updateToolset.mutateAsync({ toolset: editingToolset });
            toast.success("Success", {
                description: `Connection ${formMode === "create" ? "created" : "updated"} successfully`,
            });
            setFormMode(null);
            setEditingToolset({ name: "", command: "", args: "", env: "{}" });
            setFormErrors({});
        } catch {
            setFormErrors({
                _general: `Failed to ${formMode} connection`,
            });
        }
    };

    const handleCreateRemoteToolset = async (name: string, url: string) => {
        await updateToolset.mutateAsync({
            toolset: {
                name: name,
                command: "npx",
                args: `-y mcp-remote ${url}`,
                env: "{}",
            },
        });
        toast.success("Success", {
            description: `Remote connection created successfully`,
        });
        setFormMode(null);
    };

    const handleDeleteToolset = async (name: string) => {
        try {
            await deleteToolset.mutateAsync(name);
            toast.success("Success", {
                description: "Connection deleted successfully",
            });
        } catch {
            toast.error("Error", {
                description: "Failed to delete connection",
            });
        }
    };

    const handleSuggestedMCP = (
        name: string,
        command: string,
        args: string,
        env: string,
        needsUserInput: boolean,
    ) => {
        if (needsUserInput) {
            setFormMode("create");
            setEditingToolset({ name, command, args, env });
        } else {
            updateToolset
                .mutateAsync({ toolset: { name, command, args, env } })
                .then(() => {
                    toast.success("Success", {
                        description: `${name} connection added successfully`,
                    });
                })
                .catch((err) => {
                    toast.error("Error", {
                        description: `Failed to add ${name} connection ${err}`,
                    });
                });
        }
    };

    const onClaudeDesktopImportClick = async () => {
        try {
            const result = await importFromClaudeDesktop.mutateAsync();
            toast.success("Import Successful", {
                description: `Imported ${result.imported} tools from Claude Desktop`,
            });
        } catch (error) {
            toast.error("Import Failed", {
                description:
                    error instanceof Error
                        ? error.message
                        : "Failed to import tools from Claude Desktop",
            });
        }
    };

    return (
        <div className="space-y-8 max-w-2xl">
            <div>
                <h2 className="text-2xl font-semibold mb-2">Connections</h2>
                <p className="text-sm text-muted-foreground">
                    MCP servers, toolsets, integrations.
                </p>
            </div>

            <FleetDaemonCard />

            <Separator />

            <div className="space-y-6">
                <h3 className="text-lg font-semibold">MCP servers</h3>

                {formMode === "remote" ? (
                    <RemoteToolsetForm
                        isOpen={true}
                        onClose={handleCancelForm}
                        onSubmit={(name, url) =>
                            void handleCreateRemoteToolset(name, url)
                        }
                    />
                ) : formMode ? (
                    <ToolsetForm
                        toolset={editingToolset}
                        errors={formErrors}
                        isReadOnly={formMode === "edit"}
                        onChange={handleFieldChange}
                        onSave={() => void handleSaveToolset()}
                        onCancel={handleCancelForm}
                        apiKeyUrl={
                            RECOMMENDED_TOOLSETS.find(
                                (t) => t.name === editingToolset.name,
                            )?.apiKeyUrl
                        }
                        docsUrl={
                            RECOMMENDED_TOOLSETS.find(
                                (t) => t.name === editingToolset.name,
                            )?.docsUrl
                        }
                        title={
                            formMode === "create"
                                ? "New MCP"
                                : `Edit ${editingToolset.name}`
                        }
                    />
                ) : (
                    <QuickStartGrid
                        customToolsetConfigs={customToolsetConfigs}
                        isImportingFromClaudeDesktop={
                            importFromClaudeDesktop.isPending
                        }
                        onCreateToolset={handleCreateToolset}
                        onCreateRemoteToolset={handleCreateRemoteToolsetForm}
                        onImportFromClaudeDesktop={() =>
                            void onClaudeDesktopImportClick()
                        }
                        onSuggestedMCP={handleSuggestedMCP}
                    />
                )}

                {!formMode && (
                    <Tabs
                        value={activeToolsetTab}
                        onValueChange={(value) =>
                            setActiveToolsetTab(value as "custom" | "builtin")
                        }
                        className="mt-6"
                    >
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="custom">Custom</TabsTrigger>
                            <TabsTrigger value="builtin">Built-in</TabsTrigger>
                        </TabsList>
                        <TabsContent value="custom" className="mt-4">
                            {customToolsetConfigs.length > 0 ? (
                                <div className="space-y-4 overflow-hidden">
                                    {customToolsetConfigs.map((toolset) => (
                                        <CustomToolsetRow
                                            key={toolset.name}
                                            toolset={toolset}
                                            onEdit={handleEditToolset}
                                            onDelete={(name) =>
                                                void handleDeleteToolset(name)
                                            }
                                        />
                                    ))}
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className="relative block w-full hover:bg-muted rounded-lg border-2 border-dashed border-border p-12 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                    onClick={handleCreateToolset}
                                >
                                    <span className="mt-2 block">
                                        <Plus className="size-12 mx-auto text-muted-foreground" />
                                        <span className="mt-2 block  font-semibold">
                                            New MCP
                                        </span>
                                    </span>
                                </button>
                            )}
                        </TabsContent>
                        <TabsContent value="builtin" className="mt-4">
                            <div className="space-y-4 overflow-hidden">
                                {CORE_BUILTIN_TOOLSETS_DATA.map((toolset) => (
                                    <div
                                        key={toolset.name}
                                        className="flex items-start gap-4 p-4 border rounded-lg shadow-sm bg-card"
                                    >
                                        <div className="text-primary flex-shrink-0 mt-1">
                                            {toolset.icon()}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-semibold  text-card-foreground">
                                                {toolset.displayName}
                                            </div>
                                            {toolset.description && (
                                                <p className="text-sm mt-1">
                                                    {toolset.description}
                                                </p>
                                            )}
                                        </div>
                                        {toolset.name === "github" && (
                                            <GitHubManageConnectionButton />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </TabsContent>
                    </Tabs>
                )}

                <p className="text-sm text-muted-foreground">
                    MCP servers are complicated. If you have any trouble,
                    please email us at{" "}
                    <a
                        href="mailto:humans@chorus.sh"
                        className="text-foreground"
                    >
                        humans@chorus.sh
                    </a>
                    .
                </p>
            </div>
        </div>
    );
}
