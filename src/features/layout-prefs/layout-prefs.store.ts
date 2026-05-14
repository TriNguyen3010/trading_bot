/**
 * Persisted UI preferences that don't belong in the builder data model
 * but the user expects to survive a reload — current set:
 *   - leftPanelCollapsed:   hide the Cypheus chat panel for more canvas room.
 *                           Default true so chat starts closed with a notify dot.
 *   - botSummaryHidden:     dismiss the "What this bot does" widget.
 *   - summaryMode:          toggle between hero-stack (visual) and prose
 *                           (narrative) rendering of the phase-card summaries.
 *                           Default 'visual'. See PLAN_SUMMARY_MODES.md.
 *   - showAdvancedClose:    gate the Indicator close-method tab behind an
 *                           Advanced switch. Default false so novice users
 *                           see only Manual / TP-SL / ROI — power users
 *                           toggle this on to access indicator-based exits.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SummaryMode = 'visual' | 'narrative';

interface LayoutPrefsStore {
  leftPanelCollapsed: boolean;
  botSummaryHidden: boolean;
  summaryMode: SummaryMode;
  showAdvancedClose: boolean;
  toggleLeftPanel: () => void;
  setLeftPanelCollapsed: (v: boolean) => void;
  toggleBotSummary: () => void;
  setBotSummaryHidden: (v: boolean) => void;
  toggleSummaryMode: () => void;
  setSummaryMode: (m: SummaryMode) => void;
  toggleAdvancedClose: () => void;
  setShowAdvancedClose: (v: boolean) => void;
}

export const useLayoutPrefsStore = create<LayoutPrefsStore>()(
  persist(
    (set) => ({
      leftPanelCollapsed: true,
      botSummaryHidden: false,
      summaryMode: 'visual',
      showAdvancedClose: false,
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
      toggleAdvancedClose: () =>
        set((s) => ({ showAdvancedClose: !s.showAdvancedClose })),
      setShowAdvancedClose: (v) => set({ showAdvancedClose: v }),
    }),
    {
      name: 'layout-prefs',
      version: 4,
      // v1 → v2: introduce summaryMode (default 'visual').
      // v2 → v3: default Cypheus chat to collapsed.
      // v3 → v4: introduce showAdvancedClose (default false).
      migrate: (persisted: unknown, _version) => {
        const state = (persisted as Partial<LayoutPrefsStore>) ?? {};
        return {
          ...state,
          leftPanelCollapsed: true,
          summaryMode: state.summaryMode ?? 'visual',
          showAdvancedClose: state.showAdvancedClose ?? false,
        };
      },
    },
  ),
);
