/**
 * Persisted UI preferences that don't belong in the builder data model
 * but the user expects to survive a reload — current set:
 *   - leftPanelCollapsed: hide the Cypheus chat panel for more canvas room.
 *   - botSummaryHidden:   dismiss the "What this bot does" widget.
 *
 * Why a dedicated store: keeping these out of `builder.store` (which
 * is purely the bot's configuration) and `cypheus.store` (which is
 * Cypheus session state) makes the layout knobs reusable and the data
 * stores still serialise cleanly into the export payload.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface LayoutPrefsStore {
  leftPanelCollapsed: boolean;
  botSummaryHidden: boolean;
  toggleLeftPanel: () => void;
  setLeftPanelCollapsed: (v: boolean) => void;
  toggleBotSummary: () => void;
  setBotSummaryHidden: (v: boolean) => void;
}

export const useLayoutPrefsStore = create<LayoutPrefsStore>()(
  persist(
    (set) => ({
      leftPanelCollapsed: false,
      botSummaryHidden: false,
      toggleLeftPanel: () =>
        set((s) => ({ leftPanelCollapsed: !s.leftPanelCollapsed })),
      setLeftPanelCollapsed: (v) => set({ leftPanelCollapsed: v }),
      toggleBotSummary: () =>
        set((s) => ({ botSummaryHidden: !s.botSummaryHidden })),
      setBotSummaryHidden: (v) => set({ botSummaryHidden: v }),
    }),
    { name: 'layout-prefs', version: 1 },
  ),
);
