import { cn } from '@/lib/utils';
import { PROGRESS_PHASES, type ProgressStepStatus } from './progress.types';
import type { PhaseId } from '@/lib/phase-helpers';

export interface ProgressDotsProps {
  statusByPhase: Record<PhaseId, ProgressStepStatus>;
}

// Brand-only palette per Spec/Phase 1/card_yellow_stages_plan.md.
const dotClassByStatus: Record<ProgressStepStatus, string> = {
  pending: 'bg-brand/15',
  editing: 'bg-brand-subtle motion-safe:animate-pulse',
  configured: 'bg-brand',
  error: 'bg-brand ring-1 ring-brand/40',
};

export function ProgressDots({ statusByPhase }: ProgressDotsProps) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {PROGRESS_PHASES.map((phase) => (
        <span
          key={phase.id}
          className={cn(
            'h-2 w-2 rounded-full transition-colors duration-fast ease-out-quick',
            dotClassByStatus[statusByPhase[phase.id]],
          )}
        />
      ))}
    </div>
  );
}
