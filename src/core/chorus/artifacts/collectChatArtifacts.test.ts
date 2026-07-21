import { describe, expect, it } from "vitest";
import { collectChatArtifacts } from "./collectChatArtifacts";
import type { Message, MessageSetDetail } from "../ChatState";

function fence(lang: string, body: string): string {
    return "```" + lang + "\n" + body + "\n```";
}

function makeMessage(overrides: Partial<Message> & { id: string }): Message {
    return {
        chatId: "chat-1",
        messageSetId: "set-1",
        blockType: "tools",
        text: "",
        model: "claude-opus",
        selected: true,
        attachments: undefined,
        isReview: false,
        state: "idle",
        streamingToken: undefined,
        errorMessage: undefined,
        reviewState: undefined,
        level: 0,
        parts: [],
        replyChatId: undefined,
        branchedFromId: undefined,
        ...overrides,
    };
}

function withParts(message: Message, ...contents: string[]): Message {
    return {
        ...message,
        parts: contents.map((content, level) => ({
            chatId: message.chatId,
            messageId: message.id,
            level,
            content,
        })),
    };
}

function makeSet(overrides: Partial<MessageSetDetail>): MessageSetDetail {
    return {
        id: "set-1",
        chatId: "chat-1",
        type: "ai",
        level: 0,
        selectedBlockType: "tools",
        createdAt: "2026-07-21T00:00:00",
        userBlock: { type: "user", message: undefined },
        chatBlock: { type: "chat", message: undefined, reviews: [] },
        compareBlock: { type: "compare", messages: [], synthesis: undefined },
        toolsBlock: { type: "tools", chatMessages: [] },
        brainstormBlock: { type: "brainstorm", ideaMessages: [] },
        ...overrides,
    };
}

const identityResolver = (modelId: string) => modelId;

describe("collectChatArtifacts", () => {
    it("extracts artifacts from toolsBlock.chatMessages", () => {
        const message = withParts(
            makeMessage({ id: "msg-1" }),
            fence("html", "<p>hi</p>"),
        );
        const sets = [
            makeSet({ toolsBlock: { type: "tools", chatMessages: [message] } }),
        ];

        const artifacts = collectChatArtifacts(sets, identityResolver);
        expect(artifacts).toHaveLength(1);
        expect(artifacts[0].messageId).toBe("msg-1");
        expect(artifacts[0].chatId).toBe("chat-1");
        expect(artifacts[0].modelName).toBe("claude-opus");
    });

    it("extracts from chatBlock.message and chatBlock.reviews", () => {
        const main = withParts(
            makeMessage({ id: "msg-main" }),
            fence("html", "<p>main</p>"),
        );
        const review = withParts(
            makeMessage({ id: "msg-review" }),
            fence("html", "<p>review</p>"),
        );
        const sets = [
            makeSet({
                chatBlock: { type: "chat", message: main, reviews: [review] },
            }),
        ];

        const artifacts = collectChatArtifacts(sets, identityResolver);
        expect(artifacts.map((a) => a.messageId)).toEqual([
            "msg-main",
            "msg-review",
        ]);
    });

    it("extracts from compareBlock.messages and compareBlock.synthesis", () => {
        const a = withParts(makeMessage({ id: "a" }), fence("html", "<p>a</p>"));
        const b = withParts(makeMessage({ id: "b" }), fence("html", "<p>b</p>"));
        const synthesis = withParts(
            makeMessage({ id: "synth" }),
            fence("html", "<p>synth</p>"),
        );
        const sets = [
            makeSet({
                compareBlock: { type: "compare", messages: [a, b], synthesis },
            }),
        ];

        const artifacts = collectChatArtifacts(sets, identityResolver);
        expect(artifacts.map((a2) => a2.messageId)).toEqual(["a", "b", "synth"]);
    });

    it("extracts from brainstormBlock.ideaMessages", () => {
        const idea = withParts(
            makeMessage({ id: "idea-1" }),
            fence("html", "<p>idea</p>"),
        );
        const sets = [
            makeSet({
                brainstormBlock: { type: "brainstorm", ideaMessages: [idea] },
            }),
        ];

        const artifacts = collectChatArtifacts(sets, identityResolver);
        expect(artifacts).toHaveLength(1);
        expect(artifacts[0].messageId).toBe("idea-1");
    });

    it("skips messages with no text content", () => {
        const empty = withParts(makeMessage({ id: "empty" }));
        const sets = [
            makeSet({ toolsBlock: { type: "tools", chatMessages: [empty] } }),
        ];
        expect(collectChatArtifacts(sets, identityResolver)).toHaveLength(0);
    });

    it("preserves message-set order (oldest first)", () => {
        const first = withParts(
            makeMessage({ id: "first" }),
            fence("html", "<p>1</p>"),
        );
        const second = withParts(
            makeMessage({ id: "second" }),
            fence("html", "<p>2</p>"),
        );
        const sets = [
            makeSet({ toolsBlock: { type: "tools", chatMessages: [first] } }),
            makeSet({ toolsBlock: { type: "tools", chatMessages: [second] } }),
        ];

        const artifacts = collectChatArtifacts(sets, identityResolver);
        expect(artifacts.map((a) => a.messageId)).toEqual(["first", "second"]);
    });

    it("resolves modelName through the provided resolver (e.g. id -> display name)", () => {
        const message = withParts(
            makeMessage({ id: "msg-1", model: "anthropic::claude-opus" }),
            fence("html", "<p>hi</p>"),
        );
        const sets = [
            makeSet({ toolsBlock: { type: "tools", chatMessages: [message] } }),
        ];

        const artifacts = collectChatArtifacts(sets, () => "Claude Opus 4.8");
        expect(artifacts[0].modelName).toBe("Claude Opus 4.8");
    });

    it("joins multi-part messages with newlines before extracting (mirrors the fullscreen dialog's own text join)", () => {
        const message = withParts(
            makeMessage({ id: "msg-1" }),
            "Some preamble text.",
            fence("html", "<p>hi</p>"),
        );
        const sets = [
            makeSet({ toolsBlock: { type: "tools", chatMessages: [message] } }),
        ];

        const artifacts = collectChatArtifacts(sets, identityResolver);
        expect(artifacts).toHaveLength(1);
    });
});
