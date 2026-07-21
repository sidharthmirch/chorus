import { useEffect, useState } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { ExternalLinkIcon } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { CustomToolsetConfig } from "@core/chorus/Toolsets";
import * as ToolsetsAPI from "@core/chorus/api/ToolsetsAPI";

export type ToolsetFormProps = {
    toolset: CustomToolsetConfig;
    errors: Record<string, string>;
    isReadOnly?: boolean;
    onChange: (field: keyof CustomToolsetConfig, value: string) => void;
    onSave: () => void;
    onCancel: () => void;
    title: string;
    apiKeyUrl?: string;
    docsUrl?: string;
};

export function RemoteToolsetForm({
    isOpen,
    onClose,
    onSubmit,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (name: string, url: string) => void;
}) {
    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    const [errors, setErrors] = useState<{ name?: string; url?: string }>({});
    const { data: customToolsetConfigs = [] } =
        ToolsetsAPI.useCustomToolsetConfigs();

    // Validate name field
    const validateName = (value: string) => {
        if (!value.trim()) {
            return "Name is required";
        } else if (!/^[a-z0-9-]+$/.test(value)) {
            return "Name must be one word, lowercase, and contain only letters, numbers, and dashes";
        } else if (customToolsetConfigs.some((t) => t.name === value)) {
            return "Name already exists";
        }
        return undefined;
    };

    // Validate URL field
    const validateUrl = (value: string) => {
        if (!value.trim()) {
            return "URL is required";
        } else if (
            !value.startsWith("http://") &&
            !value.startsWith("https://")
        ) {
            return "URL must start with http:// or https://";
        } else {
            try {
                new URL(value);
            } catch {
                return "Invalid URL format";
            }
        }
        return undefined;
    };

    const validateForm = () => {
        const nameError = validateName(name);
        const urlError = validateUrl(url);

        const newErrors: { name?: string; url?: string } = {};
        if (nameError) newErrors.name = nameError;
        if (urlError) newErrors.url = urlError;

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setName(value);
        const error = validateName(value);
        setErrors((prev) => {
            const newErrors = { ...prev };
            if (error) {
                newErrors.name = error;
            } else {
                delete newErrors.name;
            }
            return newErrors;
        });
    };

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setUrl(value);
        const error = validateUrl(value);
        setErrors((prev) => {
            const newErrors = { ...prev };
            if (error) {
                newErrors.url = error;
            } else {
                delete newErrors.url;
            }
            return newErrors;
        });
    };

    const handleSubmit = () => {
        if (validateForm()) {
            onSubmit(name, url);
            setName("");
            setUrl("");
            setErrors({});
        }
    };

    // Clear form when closing
    useEffect(() => {
        if (!isOpen) {
            setName("");
            setUrl("");
            setErrors({});
        }
    }, [isOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="space-y-4 border rounded-md p-4 max-w-full overflow-hidden">
            <h4 className="font-semibold flex items-center justify-between gap-1">
                Add Remote MCP
            </h4>

            <div className="space-y-2">
                <label htmlFor="remote-mcp-name" className="font-semibold">
                    Name
                </label>
                <Input
                    id="remote-mcp-name"
                    value={name}
                    onChange={handleNameChange}
                    onKeyDown={handleKeyDown}
                    placeholder="zapier"
                    className={errors.name ? "border-destructive" : ""}
                    autoFocus
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                />
                {errors.name && (
                    <div className="text-destructive text-sm">
                        {errors.name}
                    </div>
                )}
                <p className="text-xs text-muted-foreground">
                    One word, lowercase, letters, numbers, and dashes only
                </p>
            </div>

            <div className="space-y-2">
                <label htmlFor="remote-mcp-url" className="font-semibold">
                    URL
                </label>
                <Input
                    id="remote-mcp-url"
                    value={url}
                    onChange={handleUrlChange}
                    onKeyDown={handleKeyDown}
                    placeholder="https://mcp.zapier.com/api/mcp/s/.../sse"
                    className={errors.url ? "border-destructive" : ""}
                />
                {errors.url && (
                    <div className="text-destructive text-sm">{errors.url}</div>
                )}
                <p className="text-xs text-muted-foreground">
                    The URL of the remote MCP server.
                </p>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                    Cancel
                </Button>
                <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={Object.keys(errors).length > 0}
                >
                    Save
                </Button>
            </div>
        </div>
    );
}

export function ToolsetForm({
    toolset,
    errors,
    isReadOnly = false,
    onChange,
    onSave,
    onCancel,
    title,
    docsUrl,
    apiKeyUrl,
}: ToolsetFormProps) {
    return (
        <div className="space-y-4 border rounded-md p-4 max-w-full overflow-hidden">
            <h4 className="font-semibold flex items-center justify-between gap-1">
                {title}
                {docsUrl && (
                    <Button
                        variant="link"
                        size="iconSm"
                        onClick={() => void openUrl(docsUrl)}
                    >
                        Docs <ExternalLinkIcon className="w-4 h-4" />
                    </Button>
                )}
            </h4>

            {errors._general && (
                <div className="text-destructive ">{errors._general}</div>
            )}

            {!isReadOnly && (
                <div className="space-y-2">
                    <label className="font-semibold">Name</label>
                    <Input
                        value={toolset.name}
                        onChange={(e) => onChange("name", e.target.value)}
                        className={errors.name ? "border-destructive" : ""}
                        readOnly={isReadOnly}
                        placeholder="myserver"
                        autoCapitalize="off"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    <span className="text-[10px] ">
                        One word, lowercase, letters, numbers, and dashes only
                    </span>
                    {errors.name && (
                        <div className="text-destructive ">{errors.name}</div>
                    )}
                </div>
            )}

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="font-semibold">Command</label>
                    {toolset.command.includes("docker") && (
                        <p className="text-[10px]  flex items-center gap-1">
                            <InfoCircledIcon className="w-3 h-3" />
                            Make sure you have Docker running. We recommend{" "}
                            <button
                                className="font-semibold"
                                onClick={() =>
                                    void openUrl("https://orbstack.dev/")
                                }
                            >
                                OrbStack
                            </button>
                        </p>
                    )}
                </div>
                <Input
                    value={toolset.command}
                    spellCheck={false}
                    onChange={(e) => onChange("command", e.target.value)}
                    className={errors.command ? "border-destructive" : ""}
                    placeholder="/path/to/mcp/server/executable"
                />
                <span className="text-[10px] ">
                    Absolute path to a program, or a program available on your
                    PATH. For example: npx or /usr/bin/my-mcp-server
                </span>
                {errors.command && (
                    <div className="text-destructive ">{errors.command}</div>
                )}
            </div>

            <div className="space-y-2">
                <label className="font-semibold">Arguments</label>
                <Input
                    value={toolset.args || ""}
                    spellCheck={false}
                    onChange={(e) => onChange("args", e.target.value)}
                    className={errors.args ? "border-destructive" : ""}
                    placeholder="--port 8080 --host 0.0.0.0"
                />
                <span className="text-[10px] ">
                    Arguments to pass to the program. For example:{" "}
                    <code>--port 8080 --host 0.0.0.0</code>
                </span>
                {errors.args && (
                    <div className="text-destructive ">{errors.args}</div>
                )}
            </div>

            <div className="space-y-2">
                <div className=" items-center flex justify-between">
                    <label className="font-semibold">Environment (JSON)</label>
                    {apiKeyUrl && (
                        <Button
                            variant="default"
                            size="sm"
                            className="font-semibold"
                            onClick={() => void openUrl(apiKeyUrl)}
                        >
                            Get API key <ExternalLinkIcon className="w-4 h-4" />
                        </Button>
                    )}
                </div>
                <Input
                    spellCheck={false} // prevent smart quotes
                    value={toolset.env || "{}"}
                    onChange={(e) => onChange("env", e.target.value)}
                    className={errors.env ? "border-destructive" : ""}
                />
                <span className="text-[10px] ">
                    Environment variables to pass to the program. For example:{" "}
                    <code>
                        {`{
    "GITHUB_API_KEY": "...",
    "OPENAI_API_KEY": "..."
}`}
                    </code>
                </span>

                {errors.env && (
                    <div className="text-destructive ">{errors.env}</div>
                )}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
                <Button variant="outline" size="sm" onClick={onCancel}>
                    Cancel
                </Button>
                <Button
                    size="sm"
                    onClick={onSave}
                    disabled={Object.keys(errors).length > 0}
                >
                    Save
                </Button>
            </div>
        </div>
    );
}
