import type { PhaseId } from '@/lib/phase-helpers';
import type { StepStatus } from '@/types/builder.types';

export type ProgressMode = 'empty' | 'in_progress' | 'error' | 'ready';

/** Visual status used inside the progress widget — same enum as builder
 * StepStatus, kept here so we can refer to it without importing the global
 * type in every consumer. */
export type ProgressStepStatus = StepStatus;

export interface ProgressPhaseDef {
  id: PhaseId;
  /** Short label shown inside compact pills. */
  shortLabel: string;
}

/** Source of truth for the 2 builder phases in the order they appear in the
 * dots row + pills row. Per Spec/Phase 1/two_phase_ui_plan.md the widget
 * presents the 4 stepStatus IDs as 2 phases (Bot Basics + Strategy). The
 * underlying data layer still tracks 4 IDs — this constant is purely for
 * the widget's rendering. */
export const PROGRESS_PHASES: ProgressPhaseDef[] = [
  { id: 'bot-basics', shortLabel: 'Bot' },
  { id: 'strategy', shortLabel: 'Strategy' },
];
