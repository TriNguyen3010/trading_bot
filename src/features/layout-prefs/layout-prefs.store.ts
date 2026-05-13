/**
 * Persisted UI preferences that don't belong in the builder data model
 * but the user expects to survive a reload — current set:
 *   - leftPanelCollapsed: hide the Cypheus chat panel for more canvas room.
 *   - botSummaryHidden:   dismiss the "What this bot does" widget.
 *   - summaryMode:        toggle between hero-stack (visual) and prose
 *                         (narrative) rendering of the phase-card summaries.
 *                         Default 'visual'. See PLAN_SUMMARY_MODES.md.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SummaryMode = 'visual' | 'narrative';

interface LayoutPrefsStore {
  leftPanelCollapsed: boolean;
  botSummaryHidden: boolean;
  summaryMode: SummaryMode;
  toggleLeftPanel: () => void;
  setLeftPanelCollapsed: (v: boolean) => void;
  toggleBotSummary: () => void;
  setBotSummaryHidden: (v: boolean) => void;
  toggleSummaryMode: () => void;
  setSummaryMode: (m: SummaryMode) => void;
}

export const useLayoutPrefsStore = create<LayoutPrefsStore>()(
  persist(
    (set) => ({
      leftPanelCollapsed: false,
      botSummaryHidden: false,
      summaryMode: 'visual',
      toggleLeftPanel: () =>
        set((s) => ({ leftPanelCollapsed: !s.leftPanelCollapsed })),
      setLeftPanelCollapsed: (v) => set({ leftPanelCollapsed: v }),
      toggleBotSummary: () =>
        set((s) => ({ botSummaryHidden: !s.botSummaryHidden })),
      setBotSummaryHidden: (v) => set({ botSummaryHidden: v }),
      toggleSummaryMode: () =>
        set((s) => ({
          summaryMode: s.summaryMode === 'visual' ? 'narrative' : 'visual',
        })),
      setSummaryMode: (m) => set({ summaryMode: m }),
    }),
    {
      name: 'layout-prefs',
      version: 2,
      // v1 → v2: introduce summaryMode (default 'visual').
      migrate: (persisted: unknown, _version) => {
        const state = (persisted as Partial<LayoutPrefsStore>) ?? {};
        return { ...state, summaryMode: state.summaryMode ?? 'visual' };
      },
    },
  ),
);
