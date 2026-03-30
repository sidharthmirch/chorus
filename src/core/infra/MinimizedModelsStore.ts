import { create } from "zustand";

interface MinimizedModelsStore {
    minimizedModelsByChatId: Map<string, Set<string>>;
    minimizeModel: (chatId: string, modelId: string) => void;
    expandModel: (chatId: string, modelId: string) => void;
    clearChat: (chatId: string) => void;
}

const useMinimizedModelsStore = create<MinimizedModelsStore>((set) => ({
    minimizedModelsByChatId: new Map(),

    minimizeModel: (chatId, modelId) =>
        set((state) => {
            const current =
                state.minimizedModelsByChatId.get(chatId) ?? new Set<string>();
            if (current.has(modelId)) return state;
            const next = new Map(state.minimizedModelsByChatId);
            next.set(chatId, new Set([...current, modelId]));
            return { minimizedModelsByChatId: next };
        }),

    expandModel: (chatId, modelId) =>
        set((state) => {
            const current = state.minimizedModelsByChatId.get(chatId);
            if (!current?.has(modelId)) return state;
            const nextSet = new Set(current);
            nextSet.delete(modelId);
            const next = new Map(state.minimizedModelsByChatId);
            next.set(chatId, nextSet);
            return { minimizedModelsByChatId: next };
        }),

    clearChat: (chatId) =>
        set((state) => {
            if (!state.minimizedModelsByChatId.has(chatId)) return state;
            const next = new Map(state.minimizedModelsByChatId);
            next.delete(chatId);
            return { minimizedModelsByChatId: next };
        }),
}));

export const minimizedModelsActions = {
    minimizeModel: (chatId: string, modelId: string) =>
        useMinimizedModelsStore.getState().minimizeModel(chatId, modelId),
    expandModel: (chatId: string, modelId: string) =>
        useMinimizedModelsStore.getState().expandModel(chatId, modelId),
    clearChat: (chatId: string) =>
        useMinimizedModelsStore.getState().clearChat(chatId),
};

export { useMinimizedModelsStore };
