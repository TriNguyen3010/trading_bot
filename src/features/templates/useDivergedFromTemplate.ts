/**
 * `useDivergedFromTemplate()` — true when the current builder state has
 * meaningfully drifted from the snapshot of the last-applied template.
 *
 * Comparison surface: exactly the fields that templates ship
 * (`TemplateStateSnapshot`). UI-only fields (openStep, drawerTab,
 * lastSavedAt, …) are ignored — those churn after every interaction and
 * would falsely flag the user as "diverged" the moment they open a drawer.
 *
 * Strategy: JSON.stringify on both sides. Our shape is plain data
 * (numbers, strings, arrays of objects), no functions or cycles, so a
 * stringify-and-compare is correct and faster than writing a recursive
 * deep-equal. Memoised on the snapshot reference + appliedId.
 */
import { useMemo } from 'react';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import {
  getTemplateById,
  useTemplateTrackingStore,
  type TemplateStateSnapshot,
} from '@/templates';

export interface DivergedResult {
  /** True when an `appliedId` is known but the current state differs. */
  diverged: boolean;
  /** True when an `appliedId` is set (regardless of divergence). The badge
   * uses this to decide whether to render at all. */
  hasAppliedTemplate: boolean;
}

export function useDivergedFromTemplate(): DivergedResult {
  const appliedId = useTemplateTrackingStore((s) => s.appliedId);
  const builderState = useBuilderStore();

  return useMemo<DivergedResult>(() => {
    if (!appliedId) {
      return { diverged: false, hasAppliedTemplate: false };
    }
    const template = getTemplateById(appliedId);
    if (!template) {
      // Template was removed from the bundle — nothing to compare.
      return { diverged: false, hasAppliedTemplate: false };
    }
    const current: TemplateStateSnapshot = {
      botName: builderState.botName,
      botConfig: builderState.botConfig,
      strategy: builderState.strategy,
      directionForm: builderState.directionForm,
      closeMethod: builderState.closeMethod,
    };
    const diverged =
      JSON.stringify(current) !== JSON.stringify(template.state);
    return { diverged, hasAppliedTemplate: true };
  }, [appliedId, builderState]);
}
