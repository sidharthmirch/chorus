import { create } from "zustand";

interface MinimizedModelsStore {
    minimizedModelsByChatId: Map<string, Set<string>>;
    recentlyExpandedModelsByChatId: Map<string, Set<string>>;
    minimizeModel: (chatId: string, modelId: string) => void;
    expandModel: (chatId: string, modelId: string) => void;
    clearRecentExpanded: (chatId: string) => void;
    clearChat: (chatId: string) => void;
}

const useMinimizedModelsStore = create<MinimizedModelsStore>((set) => ({
    minimizedModelsByChatId: new Map(),
    recentlyExpandedModelsByChatId: new Map(),

    minimizeModel: (chatId, modelId) =>
        set((state) => {
            const current =
                state.minimizedModelsByChatId.get(chatId) ?? new Set<string>();
            if (current.has(modelId)) return state;
            const next = new Map(state.minimizedModelsByChatId);
            next.set(chatId, new Set([...current, modelId]));
            const expanded = new Map(state.recentlyExpandedModelsByChatId);
            const expandedSet = expanded.get(chatId);
            if (expandedSet?.has(modelId)) {
                const nextExpandedSet = new Set(expandedSet);
                nextExpandedSet.delete(modelId);
                if (nextExpandedSet.size === 0) {
                    expanded.delete(chatId);
                } else {
                    expanded.set(chatId, nextExpandedSet);
                }
            }
            return {
                minimizedModelsByChatId: next,
                recentlyExpandedModelsByChatId: expanded,
            };
        }),

    expandModel: (chatId, modelId) =>
        set((state) => {
            const current = state.minimizedModelsByChatId.get(chatId);
            if (!current?.has(modelId)) return state;
            const nextSet = new Set(current);
            nextSet.delete(modelId);
            const next = new Map(state.minimizedModelsByChatId);
            next.set(chatId, nextSet);
            const expanded = new Map(state.recentlyExpandedModelsByChatId);
            const expandedSet = expanded.get(chatId) ?? new Set<string>();
            expandedSet.add(modelId);
            expanded.set(chatId, expandedSet);
            return {
                minimizedModelsByChatId: next,
                recentlyExpandedModelsByChatId: expanded,
            };
        }),

    clearRecentExpanded: (chatId) =>
        set((state) => {
            if (!state.recentlyExpandedModelsByChatId.has(chatId)) return state;
            const next = new Map(state.recentlyExpandedModelsByChatId);
            next.delete(chatId);
            return { recentlyExpandedModelsByChatId: next };
        }),

    clearChat: (chatId) =>
        set((state) => {
            if (
                !state.minimizedModelsByChatId.has(chatId) &&
                !state.recentlyExpandedModelsByChatId.has(chatId)
            ) {
                return state;
            }
            const next = new Map(state.minimizedModelsByChatId);
            const nextExpanded = new Map(state.recentlyExpandedModelsByChatId);
            next.delete(chatId);
            nextExpanded.delete(chatId);
            return {
                minimizedModelsByChatId: next,
                recentlyExpandedModelsByChatId: nextExpanded,
            };
        }),
}));

export const minimizedModelsActions = {
    minimizeModel: (chatId: string, modelId: string) =>
        useMinimizedModelsStore.getState().minimizeModel(chatId, modelId),
    expandModel: (chatId: string, modelId: string) =>
        useMinimizedModelsStore.getState().expandModel(chatId, modelId),
    clearRecentExpanded: (chatId: string) =>
        useMinimizedModelsStore.getState().clearRecentExpanded(chatId),
    clearChat: (chatId: string) =>
        useMinimizedModelsStore.getState().clearChat(chatId),
};

export { useMinimizedModelsStore };
