/**
 * Tracking store — records which template (if any) was last applied to
 * the current builder state. Powers the "Based on …" header badge plus
 * its "Diverged after edits" subtext (per Spec/Phase 1/bot_templates_plan.md
 * §5.6 + decision D3).
 *
 * Persisted across page reloads so the badge survives a refresh — without
 * persistence the user would lose the "where did this bot come from" hint
 * the first time they navigate. The cost is one extra localStorage key
 * (`template-tracking`), small and self-contained.
 *
 * Cleared explicitly when the user hits "Create new bot" — see the
 * CreateNewBotButton wiring.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TemplateTrackingStore {
  /** Id of the template last applied via `applyTemplate`. `null` when
   * the user started blank or hit "Create new bot". */
  appliedId: string | null;
  /** Wall-clock ms when the apply happened — useful for sorting if
   * we ever surface "recently applied". */
  appliedAt: number | null;

  setApplied: (id: string) => void;
  clearApplied: () => void;
}

export const useTemplateTrackingStore = create<TemplateTrackingStore>()(
  persist(
    (set) => ({
      appliedId: null,
      appliedAt: null,
      setApplied: (id) => set({ appliedId: id, appliedAt: Date.now() }),
      clearApplied: () => set({ appliedId: null, appliedAt: null }),
    }),
    { name: 'template-tracking', version: 1 },
  ),
);
