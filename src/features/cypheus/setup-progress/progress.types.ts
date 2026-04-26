import type { StepId, StepStatus } from '@/types/builder.types';

export type ProgressMode = 'empty' | 'in_progress' | 'error' | 'ready';

/** Visual status used inside the progress widget — same enum as builder
 * StepStatus, kept here so we can refer to it without importing the global
 * type in every consumer. */
export type ProgressStepStatus = StepStatus;

export interface ProgressStepDef {
  id: StepId;
  /** Short label shown inside compact pills. */
  shortLabel: string;
}

/** Source of truth for the 4 builder steps in the order they appear in the
 * dots row + pills row. Mirrors STEP_DEFS in StepList.tsx but is intentionally
 * decoupled — this widget only needs an id + short label. */
export const PROGRESS_STEPS: ProgressStepDef[] = [
  { id: 'bot-config', shortLabel: 'Bot' },
  { id: 'entry-strategy', shortLabel: 'Entry' },
  { id: 'direction', shortLabel: 'Direction' },
  { id: 'close-method', shortLabel: 'Close' },
];
