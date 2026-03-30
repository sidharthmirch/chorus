import { create } from "zustand";

interface ToolsDisabledStore {
    toolsDisabledByChatId: Map<string, Set<string>>;
    disableToolsForModel: (chatId: string, modelId: string) => void;
    enableToolsForModel: (chatId: string, modelId: string) => void;
    clearChat: (chatId: string) => void;
}

const useToolsDisabledStore = create<ToolsDisabledStore>((set) => ({
    toolsDisabledByChatId: new Map(),

    disableToolsForModel: (chatId, modelId) =>
        set((state) => {
            const current =
                state.toolsDisabledByChatId.get(chatId) ?? new Set<string>();
            if (current.has(modelId)) return state;

            const next = new Map(state.toolsDisabledByChatId);
            next.set(chatId, new Set([...current, modelId]));
            return { toolsDisabledByChatId: next };
        }),

    enableToolsForModel: (chatId, modelId) =>
        set((state) => {
            const current = state.toolsDisabledByChatId.get(chatId);
            if (!current?.has(modelId)) return state;

            const nextSet = new Set(current);
            nextSet.delete(modelId);
            const next = new Map(state.toolsDisabledByChatId);
            if (nextSet.size === 0) {
                next.delete(chatId);
            } else {
                next.set(chatId, nextSet);
            }
            return { toolsDisabledByChatId: next };
        }),

    clearChat: (chatId) =>
        set((state) => {
            if (!state.toolsDisabledByChatId.has(chatId)) return state;
            const next = new Map(state.toolsDisabledByChatId);
            next.delete(chatId);
            return { toolsDisabledByChatId: next };
        }),
}));

export const toolsDisabledActions = {
    disableToolsForModel: (chatId: string, modelId: string) =>
        useToolsDisabledStore.getState().disableToolsForModel(chatId, modelId),
    enableToolsForModel: (chatId: string, modelId: string) =>
        useToolsDisabledStore.getState().enableToolsForModel(chatId, modelId),
    clearChat: (chatId: string) =>
        useToolsDisabledStore.getState().clearChat(chatId),
    isToolsDisabledForModel: (chatId: string, modelId: string) =>
        useToolsDisabledStore
            .getState()
            .toolsDisabledByChatId.get(chatId)
            ?.has(modelId) ?? false,
};

export { useToolsDisabledStore };
