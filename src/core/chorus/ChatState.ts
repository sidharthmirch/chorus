import type { LLMMessage } from "./Models";
import type { Attachment } from "./api/AttachmentsAPI";
import * as Toolsets from "./Toolsets";
import type { UserToolCall, UserToolResult } from "./Toolsets";
import * as Prompts from "./prompts/prompts";
import * as Reviews from "./reviews";

// ----------------------------------
// Types
// ----------------------------------

export type MessageSet = {
    id: string;
    chatId: string;
    type: "user" | "ai";
    level: number;
    selectedBlockType: BlockType;
    createdAt: string;
    // Which mode/stance (see IMode below) was active when this set was
    // created, if any. Written once at creation time on the "ai" set of a
    // turn; undefined means no mode was active (raw model, mode off).
    modeId?: string;
};

// ----------------------------------
// Modes / stances (W6 rework — frozen export per docs/rework/00-ARCHITECTURE.md §5)
// ----------------------------------

/**
 * A reusable system-prompt "stance" (Assist/Critic/Socratic, or a
 * user-created one) that can be applied per-chat (default) or per-message-set
 * (override for a single send). Backed by the `modes` table
 * (src-tauri/src/migrations.rs, migration 148); CRUD lives in
 * `api/ModesAPI.ts`. Consumed by W3's Settings > Modes section as well as
 * this workstream's composer picker — do not change this shape without
 * updating 00-ARCHITECTURE.md §5 and flagging it in the PR.
 */
export interface IMode {
    id: string;
    icon?: string;
    name: string;
    description: string;
    prompt: string;
    tag: "app-default" | "per-chat" | "custom";
    usageCount: number;
    author: "user" | "system";
    createdAt: string;
    updatedAt: string;
}

// ----------------------------------
// View modes (W6 rework — frozen export per docs/rework/00-ARCHITECTURE.md §5)
// ----------------------------------

/**
 * Per-chat presentation mode for multi-model responses (`chats.view_mode`,
 * migration 149; default "columns" = today's existing behavior, unchanged).
 * "focus" and "fused" are purely presentational reinterpretations of the
 * same underlying `ToolsBlock.chatMessages` fan-out — see
 * docs/rework/w6-chat-recon.md §5/§6. Consumed by `ChatAPI.ts`'s `Chat.viewMode`
 * and the segmented control in `MultiChat.tsx`'s header.
 */
export type ViewMode = "columns" | "focus" | "fused";
export const VIEW_MODES: ViewMode[] = ["columns", "focus", "fused"];

/**
 * One row of the Fused view mode's grading table (design/chat.md's
 * "Grading · influence weights" footer). Produced by a `simpleLLM()` call
 * (not the streaming pipeline) after synthesis completes, persisted as JSON
 * on the synthesis message's `grades_json` column (migration 149) — see
 * `api/MessageAPI.ts`'s fused-grading mutation and
 * docs/rework/w6-chat-recon.md §6. Frozen per 00-ARCHITECTURE.md §5.
 */
export interface IGrade {
    model: string; // model config id, matches Message.model
    score: number; // 0-100
    weightPct: number; // 0-100, how much this model's answer influenced the fused response
    note: string; // short human-readable rationale, e.g. "structure, tables, citations"
}
// `as ViewMode` here only widens the array's element type for the .includes
// check itself; the function's real job (and the only thing callers rely
// on) is the `value is ViewMode` predicate, which IS runtime-checked below —
// same established idiom as this file's own isBlockType, just above.
export const isViewMode = (value: string): value is ViewMode =>
    VIEW_MODES.includes(value as ViewMode);

export type MessageSetDetail = MessageSet & {
    userBlock: UserBlock;
    chatBlock: ChatBlock;
    compareBlock: CompareBlock;
    brainstormBlock: BrainstormBlock;
    toolsBlock: ToolsBlock;
};

export interface Message {
    id: string;
    chatId: string;
    messageSetId: string;
    blockType: BlockType;
    text: string;
    model: string;
    actualModelId?: string;
    selected: boolean;
    attachments: Attachment[] | undefined;
    isReview: boolean;
    state: "streaming" | "idle";
    streamingToken: string | undefined; // says which stream is updating this message
    errorMessage: string | undefined;
    reviewState: "pending" | "applied" | undefined;
    level: number | undefined;
    parts: MessagePart[];
    replyChatId: string | undefined;
    branchedFromId: string | undefined;
    // Token usage and cost
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    costUsd?: number;
    // Fused view mode (P4): per-model grades, present only on the synthesis
    // message ("chorus::synthesize") once grading has run. See IGrade above.
    grades?: IGrade[];
}

export interface MessagePart {
    chatId: string;
    messageId: string;
    level: number;
    content: string;
    toolCalls?: UserToolCall[];
    toolResults?: UserToolResult[];
}

export function createAIMessage({
    chatId,
    messageSetId,
    blockType,
    model,
    selected = false,
    isReview = false,
    level,
}: {
    chatId: string;
    messageSetId: string;
    blockType: BlockType;
    model: string;
    selected?: boolean;
    isReview?: boolean;
    level?: number;
}): Omit<Message, "id" | "streamingToken" | "parts"> {
    return {
        chatId,
        blockType,
        text: "",
        model,
        messageSetId,
        selected,
        attachments: undefined,
        state: "streaming",
        errorMessage: undefined,
        isReview,
        reviewState: undefined,
        level,
        replyChatId: undefined,
        branchedFromId: undefined,
    };
}

export function createUserMessage({
    chatId,
    messageSetId,
    text,
}: {
    messageSetId: string;
    chatId: string;
    text: string;
}): Omit<Message, "id" | "streamingToken" | "parts" | "attachments"> {
    return {
        chatId,
        blockType: "user",
        text,
        model: "user",
        messageSetId,
        selected: true,
        state: "idle",
        errorMessage: undefined,
        isReview: false,
        reviewState: undefined,
        level: undefined,
        replyChatId: undefined,
        branchedFromId: undefined,
    };
}

// a message will have a state of "streaming" or "idle"
// if streaming, it will have a streamingToken
// idle = it finished, user stopped it, or it timed out
// this lets us stop it, retry it, and time it out
// also should there be an "error" state?

export type BlockType = "user" | "chat" | "compare" | "tools" | "brainstorm";
export const SELECTABLE_BLOCK_TYPES: BlockType[] = ["tools", "chat", "compare"];
export const isBlockType = (blockType: string): blockType is BlockType =>
    SELECTABLE_BLOCK_TYPES.includes(blockType as BlockType);
export const getBlockTypeDisplayName = (blockType: BlockType): string =>
    blockType === "tools"
        ? "Default"
        : blockType === "chat"
          ? "Reviews"
          : blockType === "compare"
            ? "Compare"
            : blockType === "brainstorm"
              ? "Brainstorm"
              : blockType;

export type UserBlock = {
    type: "user";
    message: Message | undefined;
};
export type ChatBlock = {
    type: "chat";
    message: Message | undefined;
    reviews: Message[];
};
export type CompareBlock = {
    type: "compare";
    messages: Message[];
    synthesis: Message | undefined;
};
export type ToolsBlock = {
    type: "tools";
    chatMessages: Message[];
};
export type BrainstormBlock = {
    type: "brainstorm";
    ideaMessages: Message[];
};
export type Block =
    | UserBlock
    | ChatBlock
    | BrainstormBlock
    | CompareBlock
    | ToolsBlock;

function encodeToolsBlock(block: ToolsBlock): LLMMessage[] {
    // Build LLMMessages from the sorted chat messages
    const result: LLMMessage[] = [];

    const selectedMessage = block.chatMessages.find((m) => m.selected);
    if (!selectedMessage || !selectedMessage.parts.length) {
        return [];
    }

    for (const part of selectedMessage.parts) {
        if (part.toolResults) {
            // Tool response message
            if (part.toolResults.length === 0) {
                console.warn("Tool response message without toolResults", part);
                continue;
            }
            result.push({
                role: "tool_results",
                toolResults: part.toolResults,
            });
        } else {
            // Assistant message
            result.push({
                role: "assistant",
                content: part.content,
                model: selectedMessage.model,
                toolCalls: part.toolCalls || [],
            });
        }
    }

    const lastPart = selectedMessage.parts[selectedMessage.parts.length - 1];
    if (lastPart.toolCalls) {
        // this is an interrupted tool call
        result.push({
            role: "tool_results",
            toolResults: lastPart.toolCalls.map((toolCall) => ({
                id: toolCall.id,
                namespacedToolName: toolCall.namespacedToolName,
                content: Toolsets.TOOL_CALL_INTERRUPTED_MESSAGE,
            })),
        });
    }

    return result;
}

function encodeChatBlock(block: ChatBlock): LLMMessage[] {
    const appliedReview = block.reviews.find(
        (r) => r.reviewState === "applied",
    );
    const revision = appliedReview
        ? Reviews.parseReview(appliedReview.text, true).revision
        : undefined;
    if (revision) {
        return [
            {
                role: "assistant",
                content: revision,
                toolCalls: [],
            },
        ];
    }

    if (!block.message) {
        return [];
    }

    return [
        {
            role: "assistant",
            content: block.message.text,
            model: block.message.model,
            toolCalls: [],
        },
    ];
}

function encodeUserBlock(block: UserBlock): LLMMessage[] {
    return [
        {
            role: "user",
            content: block.message?.text ?? "",
            attachments: block.message?.attachments || [],
        },
    ];
}

function encodeCompareBlock(block: CompareBlock): LLMMessage[] {
    if (block.synthesis?.selected) {
        return [
            {
                role: "assistant",
                content: block.synthesis.text,
                toolCalls: [],
            },
        ];
    } else {
        const selectedMessages = block.messages.filter((m) => m.selected);
        if (selectedMessages.length === 1) {
            return [
                {
                    role: "assistant",
                    content: selectedMessages[0].text,
                    toolCalls: [],
                },
            ];
        } else {
            return [
                {
                    role: "assistant",
                    content: `${selectedMessages.map((m) => m.text).join("\n\n")}`,
                    toolCalls: [],
                },
            ];
        }
    }
}

function encodeBrainstormBlock(block: BrainstormBlock): LLMMessage[] {
    return [
        {
            role: "assistant",
            content: `${block.ideaMessages
                .map((m) => `<idea>${m.text}</idea>`)
                .join("\n")}`,
            toolCalls: [],
        },
    ];
}

/**
 * Shared by both the legacy "compare" block's manual Synthesize button and
 * the "tools" block's Fused view mode (P4) — takes the plain message list
 * rather than a specific block shape so it works for either. See
 * docs/rework/w6-chat-recon.md §6: the prompt itself (SYNTHESIS_INTERJECTION)
 * must not change, only which messages feed it.
 */
function encodeMessagesForSynthesis(messages: Message[]): LLMMessage[] {
    // include all responses, regardless of whether they're selected
    return [
        {
            role: "user",
            content: `${Prompts.SYNTHESIS_INTERJECTION}

        ${messages
            .map(
                (message) =>
                    `<perspective sender="${message.model}">
${message.text}
</perspective>`,
            )
            .join("\n\n")}`,
            attachments: [],
        },
    ];
}

function blockIsEmptyTools(block: ToolsBlock): boolean {
    return block.chatMessages.length === 0;
}

function blockIsEmptyChat(block: ChatBlock): boolean {
    return !block.message && block.reviews.length === 0;
}

function blockIsEmptyCompare(block: CompareBlock): boolean {
    return block.messages.length === 0;
}

function blockIsEmptyBrainstorm(block: BrainstormBlock): boolean {
    return block.ideaMessages.length === 0;
}

export function blockIsEmpty(
    messageSet: MessageSetDetail,
    blockType: BlockType,
): boolean {
    switch (blockType) {
        case "chat":
            return blockIsEmptyChat(messageSet.chatBlock);
        case "brainstorm":
            return blockIsEmptyBrainstorm(messageSet.brainstormBlock);
        case "compare":
            return blockIsEmptyCompare(messageSet.compareBlock);
        case "tools":
            return blockIsEmptyTools(messageSet.toolsBlock);
        default:
            throw new Error(
                `Unexpected block type for blockIsEmpty: ${blockType}`,
            );
    }
}

/**
 * Returns the index of the last user message set, or -1 if there are no user message sets.
 * This is used to determine whether to include ephemeral attachments in the LLM conversation.
 * The last message set in the list is not always a user message set, since tools messages
 * can be multi-part (meaning an AI message can be created before reaching llmConversation).
 */
function getLastUserMessageSetIndex(messageSets: MessageSetDetail[]): number {
    for (let i = messageSets.length - 1; i >= 0; i--) {
        if (messageSets[i].selectedBlockType === "user") {
            return i;
        }
    }
    return -1;
}

/**
 * This is the conversation that will be sent to the LLM.
 */
export function llmConversation(messageSets: MessageSetDetail[]): LLMMessage[] {
    const conversation: LLMMessage[] = [];

    const lastUserMessageSetIndex = getLastUserMessageSetIndex(messageSets);

    messageSets.forEach((messageSet, index) => {
        function removeEphemeralAttachments(llmMessages: LLMMessage[]) {
            if (index === lastUserMessageSetIndex) {
                return llmMessages;
            }
            return llmMessages.map((llmMessage) => {
                if (llmMessage.role !== "user") {
                    return llmMessage;
                }
                return {
                    ...llmMessage,
                    attachments: llmMessage.attachments.filter(
                        (a) => !a.ephemeral,
                    ),
                };
            });
        }

        switch (messageSet.selectedBlockType) {
            case "user": {
                if (messageSet.userBlock) {
                    conversation.push(
                        ...removeEphemeralAttachments(
                            encodeUserBlock(messageSet.userBlock),
                        ),
                    );
                }
                break;
            }
            case "chat": {
                if (messageSet.chatBlock) {
                    conversation.push(
                        ...removeEphemeralAttachments(
                            encodeChatBlock(messageSet.chatBlock),
                        ),
                    );
                }
                break;
            }
            case "brainstorm": {
                conversation.push(
                    ...removeEphemeralAttachments(
                        encodeBrainstormBlock(messageSet.brainstormBlock),
                    ),
                );
                break;
            }
            case "compare": {
                if (messageSet.compareBlock) {
                    conversation.push(
                        ...removeEphemeralAttachments(
                            encodeCompareBlock(messageSet.compareBlock),
                        ),
                    );
                }
                break;
            }
            case "tools": {
                if (messageSet.toolsBlock) {
                    conversation.push(
                        ...removeEphemeralAttachments(
                            encodeToolsBlock(messageSet.toolsBlock),
                        ),
                    );
                }
                break;
            }
            default: {
                console.warn(
                    "unknown block type",
                    messageSet.selectedBlockType,
                );
                break;
            }
        }
    });

    return conversation;
}

export function llmConversationForSynthesis(
    messageSets: MessageSetDetail[],
): LLMMessage[] {
    const finalSet = messageSets[messageSets.length - 1];

    // "tools" is today's live multi-model block type; "compare" is the
    // legacy one the manual Synthesize button still operates on for old
    // chats. Anything else has no meaningful "perspectives" to synthesize.
    // See docs/rework/w6-chat-recon.md §6.
    const perspectiveMessages =
        finalSet.selectedBlockType === "tools"
            ? finalSet.toolsBlock.chatMessages.filter(
                  (m) => m.model !== "chorus::synthesize",
              )
            : finalSet.selectedBlockType === "compare"
              ? finalSet.compareBlock.messages
              : [];

    const synthesisMessages = encodeMessagesForSynthesis(perspectiveMessages);

    return [...llmConversation(messageSets.slice(0, -1)), ...synthesisMessages];
}
