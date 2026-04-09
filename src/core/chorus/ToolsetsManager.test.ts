import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolsetsManager } from "./ToolsetsManager";
import type { Toolset, UserToolCall } from "./Toolsets";
import { checkToolPermission } from "./api/ToolPermissionsAPI";
import { checkToolYolo } from "./api/ToolYoloAPI";
import { fetchProjectYoloMode } from "./api/ProjectAPI";
import { fetchAppMetadata } from "./api/AppMetadataAPI";

vi.mock("./api/ToolPermissionsAPI", () => ({
    checkToolPermission: vi.fn(),
}));

vi.mock("./api/ToolYoloAPI", () => ({
    checkToolYolo: vi.fn(),
}));

vi.mock("./api/ProjectAPI", () => ({
    fetchProjectYoloMode: vi.fn(),
}));

vi.mock("./api/AppMetadataAPI", () => ({
    fetchAppMetadata: vi.fn(),
}));

vi.mock("@core/infra/ToolPermissionStore", () => ({
    toolPermissionActions: {
        addRequest: vi.fn(),
    },
}));

describe("ToolsetsManager.executeToolCall", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchProjectYoloMode).mockResolvedValue(undefined);
        vi.mocked(fetchAppMetadata).mockResolvedValue({});
        vi.mocked(checkToolYolo).mockResolvedValue(false);
    });

    it("does not execute a tool when permission is always_deny, even if project YOLO is enabled", async () => {
        const manager = new ToolsetsManager();
        const executeTool = vi.fn().mockResolvedValue("should-not-run");

        (manager as unknown as { _builtInToolsets: Toolset[] })._builtInToolsets = [
            {
                name: "web",
                executeTool,
                listTools: () => [],
            } as unknown as Toolset,
        ];

        vi.mocked(fetchProjectYoloMode).mockResolvedValue(true);
        vi.mocked(checkToolPermission).mockResolvedValue({
            shouldAsk: false,
            isAllowed: false,
            permission: null,
        });

        const toolCall: UserToolCall = {
            id: "call-1",
            namespacedToolName: "web_search",
            args: {},
        };

        const result = await manager.executeToolCall(
            toolCall,
            "model-x",
            "project-1",
        );

        expect(checkToolPermission).toHaveBeenCalledWith("web", "search", "ask");
        expect(executeTool).not.toHaveBeenCalled();
        expect(result.content).toContain("denied by saved preference");
    });
});
