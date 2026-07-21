import { describe, expect, it } from "vitest";
import { agentDisplayName, agentProviderName } from "./agentDisplay";

describe("agentProviderName", () => {
    it("maps claude-code to anthropic", () => {
        expect(agentProviderName("claude-code")).toBe("anthropic");
    });

    it("maps codex to openai", () => {
        expect(agentProviderName("codex")).toBe("openai");
    });

    it("returns undefined for an agent fleetd might add later, rather than throwing", () => {
        expect(agentProviderName("some-future-agent")).toBeUndefined();
    });
});

describe("agentDisplayName", () => {
    it("passes the id through as-is", () => {
        expect(agentDisplayName("claude-code")).toBe("claude-code");
    });
});
