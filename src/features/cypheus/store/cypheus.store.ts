import { create } from 'zustand';
import type { StepId } from '@/types/builder.types';

export type CypheusState =
  | 'idle'
  | 'greeting'
  | 'thinking'
  | 'building'
  | 'done';

/**
 * Lifecycle of the floating Cypheus dock + Step 1 anchor:
 *   idle      – fresh session, nothing started. Step 1 anchor visible.
 *   active    – user has interacted at least once and the build is in
 *               progress (or paused mid-config). Dock visible.
 *   completed – all 4 steps configured. Dock auto-dismissed; clicking a
 *               step to re-edit must NOT bring the dock back. Only
 *               `resetAll()` (Create new bot) returns the phase to idle.
 */
export type Phase = 'idle' | 'active' | 'completed';

export type AvatarState = 'idle' | 'hello' | 'coding';

export type LeftPanelTab = 'cypheus' | 'json';

export type DrawerMode =
  | 'closed'
  | 'manual'
  | 'cypheus-pinned'
  | 'cypheus-summary';

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
  phase: Phase;
  state: CypheusState;
  avatar: AvatarState;
  messages: ChatMessage[];
  drawerMode: DrawerMode;
  cypheusActiveStepId: StepId | null;
  /** Timestamp of the last time the JSON tab was opened. Used by the
   *  Cypheus tab to compare against builder.lastSavedAt and decide whether
   *  to show an "unread updates" red badge. */
  jsonViewedAt: number | null;

  setPanelTab: (tab: LeftPanelTab) => void;
  setPhase: (phase: Phase) => void;
  setState: (state: CypheusState) => void;
  setAvatar: (avatar: AvatarState) => void;
  pushMessage: (msg: Omit<ChatMessage, 'id' | 'ts'>) => string;
  updateMessage: (id: string, patch: Partial<Omit<ChatMessage, 'id'>>) => void;
  clearMessages: () => void;

  startCypheusDrawer: (stepId: StepId) => void;
  switchCypheusStep: (stepId: StepId) => void;
  showCypheusSummary: () => void;
  closeCypheusDrawer: () => void;

  resetAll: () => void;
}

export const useCypheusStore = create<CypheusStore>((set) => ({
  panelTab: 'cypheus',
  phase: 'idle',
  state: 'idle',
  avatar: 'idle',
  messages: [],
  drawerMode: 'closed',
  cypheusActiveStepId: null,
  jsonViewedAt: null,

  setPanelTab: (panelTab) =>
    set(panelTab === 'json' ? { panelTab, jsonViewedAt: Date.now() } : { panelTab }),
  setPhase: (phase) => set({ phase }),
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

  startCypheusDrawer: (stepId) =>
    set({ drawerMode: 'cypheus-pinned', cypheusActiveStepId: stepId }),

  switchCypheusStep: (stepId) =>
    set({ drawerMode: 'cypheus-pinned', cypheusActiveStepId: stepId }),

  showCypheusSummary: () => set({ drawerMode: 'cypheus-summary' }),

  closeCypheusDrawer: () =>
    set({ drawerMode: 'closed', cypheusActiveStepId: null }),

  resetAll: () =>
    set({
      panelTab: 'cypheus',
      phase: 'idle',
      state: 'idle',
      avatar: 'idle',
      messages: [],
      drawerMode: 'closed',
      cypheusActiveStepId: null,
      jsonViewedAt: null,
    }),
}));
