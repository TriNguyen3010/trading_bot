/**
 * Phase-helpers — derives the "2-phase" presentation view from the
 * existing 4-stepStatus data layer.
 *
 * Background: the data layer continues to track 4 steps
 * (`bot-config`, `entry-strategy`, `direction`, `close-method`) per
 * Spec/Phase 1/two_phase_ui_plan.md. The UI presents them as 2 phases:
 *   - "Bot Basics"  ← bot-config
 *   - "Strategy"    ← entry-strategy + direction + close-method
 *
 * This module is the pure-function bridge: given a BuilderState, produce
 * an aggregated phase status / setup-gate / count for the new UI to
 * consume — without touching the store or types.
 */
import type { BuilderState, StepId, StepStatus } from '@/types/builder.types';
import { isStepSetupComplete } from './validator';

export type PhaseId = 'bot-basics' | 'strategy';

/** Sub-steps that fold into the visual "Strategy" phase. The data layer
 * still tracks 4 separate stepStatus IDs; this constant just reflects the
 * presentation grouping. */
export const STRATEGY_SUB_STEPS: readonly StepId[] = [
  'entry-strategy',
  'direction',
  'close-method',
];

export const PHASE_IDS: readonly PhaseId[] = ['bot-basics', 'strategy'];

/** Map a legacy stepId to the phase it visually belongs to. Used when
 * Cypheus pins a sub-step and we need to highlight the parent phase card
 * (per `two_phase_ui_plan.md` §6.6 + D3). */
export function stepIdToPhase(stepId: StepId): PhaseId {
  return stepId === 'bot-config' ? 'bot-basics' : 'strategy';
}

/** Aggregate status for a phase, derived from underlying stepStatus.
 *
 * Bot-basics: 1:1 passthrough from `bot-config`.
 *
 * Strategy: composite rules (priority high → low):
 *   1. ANY sub-step has 'error'    → 'error'
 *   2. ANY sub-step is 'editing'   → 'editing'
 *   3. ALL sub-steps 'configured'  → 'configured'
 *   4. else                        → 'pending'
 *
 * Priority matters: a strategy with one configured sub-step + one editing +
 * one with an error must surface as 'error' (the most actionable state),
 * not 'editing'.
 */
export function derivePhaseStatus(
  state: BuilderState,
  phase: PhaseId,
): StepStatus {
  if (phase === 'bot-basics') {
    return state.stepStatus['bot-config'];
  }
  const sub = STRATEGY_SUB_STEPS.map((id) => state.stepStatus[id]);
  if (sub.some((s) => s === 'error')) return 'error';
  if (sub.some((s) => s === 'editing')) return 'editing';
  if (sub.every((s) => s === 'configured')) return 'configured';
  return 'pending';
}

/** Phase-level setup gate — true when all sub-step setup gates pass.
 * Used to enable/disable the StrategyDrawer Save button. */
export function isPhaseSetupComplete(
  state: BuilderState,
  phase: PhaseId,
): boolean {
  if (phase === 'bot-basics') {
    return isStepSetupComplete('bot-config', state);
  }
  return STRATEGY_SUB_STEPS.every((id) => isStepSetupComplete(id, state));
}

/** Count of phases currently in 'configured' status (0–2).
 * Used by the SetupProgress widget to decide between empty / in_progress /
 * ready / error modes. */
export function configuredPhaseCount(state: BuilderState): number {
  let n = 0;
  if (derivePhaseStatus(state, 'bot-basics') === 'configured') n++;
  if (derivePhaseStatus(state, 'strategy') === 'configured') n++;
  return n;
}
