import { create } from "zustand";

interface ModelOrderStore {
    modelOrderByChatId: Map<string, string[]>;
    setModelOrder: (chatId: string, modelIds: string[]) => void;
    getModelOrder: (chatId: string) => string[] | undefined;
    clearChat: (chatId: string) => void;
    // The resolved visual order (after applying finish-time sorting, custom order, etc.)
    // Written by ToolsBlockView so keybinding handlers can use the correct visual index.
    currentVisualOrderByChatId: Map<string, string[]>;
    setCurrentVisualOrder: (chatId: string, modelIds: string[]) => void;
}

const useModelOrderStore = create<ModelOrderStore>((set, get) => ({
    modelOrderByChatId: new Map(),

    setModelOrder: (chatId, modelIds) =>
        set((state) => {
            const next = new Map(state.modelOrderByChatId);
            next.set(chatId, modelIds);
            return { modelOrderByChatId: next };
        }),

    getModelOrder: (chatId) => get().modelOrderByChatId.get(chatId),

    clearChat: (chatId) =>
        set((state) => {
            if (!state.modelOrderByChatId.has(chatId)) return state;
            const next = new Map(state.modelOrderByChatId);
            next.delete(chatId);
            return { modelOrderByChatId: next };
        }),

    currentVisualOrderByChatId: new Map(),

    setCurrentVisualOrder: (chatId, modelIds) =>
        set((state) => {
            const next = new Map(state.currentVisualOrderByChatId);
            next.set(chatId, modelIds);
            return { currentVisualOrderByChatId: next };
        }),
}));

export const modelOrderActions = {
    setModelOrder: (chatId: string, modelIds: string[]) =>
        useModelOrderStore.getState().setModelOrder(chatId, modelIds),
    getModelOrder: (chatId: string) =>
        useModelOrderStore.getState().getModelOrder(chatId),
    clearChat: (chatId: string) =>
        useModelOrderStore.getState().clearChat(chatId),
};

export { useModelOrderStore };
