/**
 * Tiny zustand store tracking which template (if any) was last applied
 * to the current builder state. Powers the future "Based on …" header
 * badge + "Diverged" indicator.
 *
 * NOT persisted: this is purely current-session metadata. Reload =
 * applied id forgotten (acceptable since the actual BuilderState is
 * persisted independently).
 */
import { create } from 'zustand';

interface TemplateTrackingStore {
  /** Id of the template last applied via runTemplateAnimation /
   * applyTemplate. `null` when the user started blank or hit
   * "Create new bot". */
  appliedId: string | null;
  /** Wall-clock ms when the apply happened — used to decide when to
   * arm a "Diverged" comparison. */
  appliedAt: number | null;

  setApplied: (id: string) => void;
  clearApplied: () => void;
}

export const useTemplateTrackingStore = create<TemplateTrackingStore>(
  (set) => ({
    appliedId: null,
    appliedAt: null,
    setApplied: (id) => set({ appliedId: id, appliedAt: Date.now() }),
    clearApplied: () => set({ appliedId: null, appliedAt: null }),
  }),
);
