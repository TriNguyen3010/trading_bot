import { create } from 'zustand';

export type CypheusState =
  | 'idle'
  | 'greeting'
  | 'thinking'
  | 'building'
  | 'done';

export type AvatarState = 'idle' | 'thinking' | 'speaking';

export type LeftPanelTab = 'cypheus' | 'json';

export interface ChatMessage {
  id: string;
  role: 'cypheus' | 'user';
  text: string;
  /** When true the bubble renders with the typewriter animation. */
  typing?: boolean;
  ts: number;
}

interface CypheusStore {
  panelTab: LeftPanelTab;
  state: CypheusState;
  avatar: AvatarState;
  messages: ChatMessage[];

  setPanelTab: (tab: LeftPanelTab) => void;
  setState: (state: CypheusState) => void;
  setAvatar: (avatar: AvatarState) => void;
  pushMessage: (msg: Omit<ChatMessage, 'id' | 'ts'>) => string;
  updateMessage: (id: string, patch: Partial<Omit<ChatMessage, 'id'>>) => void;
  clearMessages: () => void;
  resetAll: () => void;
}

export const useCypheusStore = create<CypheusStore>((set) => ({
  panelTab: 'cypheus',
  state: 'idle',
  avatar: 'idle',
  messages: [],

  setPanelTab: (panelTab) => set({ panelTab }),
  setState: (state) => set({ state }),
  setAvatar: (avatar) => set({ avatar }),

  pushMessage: (msg) => {
    const id = crypto.randomUUID();
    const ts = Date.now();
    set((s) => ({ messages: [...s.messages, { ...msg, id, ts }] }));
    return id;
  },

  updateMessage: (id, patch) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    })),

  clearMessages: () => set({ messages: [] }),

  resetAll: () =>
    set({ panelTab: 'cypheus', state: 'idle', avatar: 'idle', messages: [] }),
}));
