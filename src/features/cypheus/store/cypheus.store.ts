import { create } from 'zustand';

/**
 * Lifecycle phase used by the floating bottom dock:
 *   idle      – fresh session. Dock hidden.
 *   active    – user has opened at least one step. Dock visible.
 *   completed – all phases configured. Dock auto-dismissed after a delay;
 *               re-opening a step does NOT bring the dock back. Only
 *               `resetAll()` returns the phase to idle.
 */
export type Phase = 'idle' | 'active' | 'completed';

export interface ChatMessage {
  id: string;
  role: 'cypheus' | 'user';
  text: string;
  /** When true the bubble renders with the typewriter animation. */
  typing?: boolean;
  ts: number;
}

interface CypheusStore {
  phase: Phase;
  messages: ChatMessage[];

  setPhase: (phase: Phase) => void;
  pushMessage: (msg: Omit<ChatMessage, 'id' | 'ts'>) => string;
  updateMessage: (id: string, patch: Partial<Omit<ChatMessage, 'id'>>) => void;
  clearMessages: () => void;

  resetAll: () => void;
}

export const useCypheusStore = create<CypheusStore>((set) => ({
  phase: 'idle',
  messages: [],

  setPhase: (phase) => set({ phase }),

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
    set({
      phase: 'idle',
      messages: [],
    }),
}));
