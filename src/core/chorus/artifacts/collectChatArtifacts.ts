import type { Message, MessageSetDetail } from "../ChatState";
import { extractArtifacts } from "./extract";
import type { IArtifact } from "./types";

/**
 * Every AI message across every block kind in a message set. Deliberately
 * NOT restricted to the set's currently `selectedBlockType` — once a model
 * has written an artifact it stays available in the panel's version
 * history regardless of which view (chat/compare/brainstorm) happens to be
 * focused right now, matching the "immutable log, regeneration appends"
 * versioning language in docs/rework/design/artifacts.md.
 */
function messagesFromSet(set: MessageSetDetail): Message[] {
    const messages: Message[] = [];
    if (set.chatBlock.message) messages.push(set.chatBlock.message);
    messages.push(...set.chatBlock.reviews);
    messages.push(...set.toolsBlock.chatMessages);
    messages.push(...set.compareBlock.messages);
    if (set.compareBlock.synthesis) messages.push(set.compareBlock.synthesis);
    messages.push(...set.brainstormBlock.ideaMessages);
    return messages;
}

/**
 * The full text of a message for extraction purposes. Mirrors how
 * MultiChat.tsx's `ToolsMessageFullScreenDialogView` builds "the whole
 * message text" elsewhere (`message.parts.map((p) => p.content).join("\n")`)
 * rather than relying on `message.text`, which isn't necessarily kept in
 * sync with `.parts` during streaming.
 */
function fullMessageText(message: Message): string {
    return message.parts.map((part) => part.content).join("\n");
}

/**
 * Flattens every AI message across every message set in a chat and extracts
 * artifacts from each, in message-set order (oldest first). Pure function
 * over data MultiChat already has loaded (`MessageAPI.useMessageSets`'s
 * result) — callers should wrap this in `useMemo` keyed on
 * `messageSetsQuery.data`/the model-name resolver's inputs, since
 * `extractArtifacts` itself must be memoized per message (see
 * `IArtifact.createdAt`'s doc comment in types.ts) for ids/timestamps to
 * stay referentially stable across re-renders.
 */
export function collectChatArtifacts(
    messageSets: MessageSetDetail[],
    resolveModelName: (modelId: string) => string,
): IArtifact[] {
    const artifacts: IArtifact[] = [];
    for (const set of messageSets) {
        for (const message of messagesFromSet(set)) {
            const text = fullMessageText(message);
            if (!text.trim()) continue;
            artifacts.push(
                ...extractArtifacts(text, {
                    messageId: message.id,
                    chatId: message.chatId,
                    modelName: resolveModelName(message.model),
                }),
            );
        }
    }
    return artifacts;
}
