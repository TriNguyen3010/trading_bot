import { cn } from '@/lib/utils';
import { PROGRESS_STEPS, type ProgressStepStatus } from './progress.types';
import type { StepId } from '@/types/builder.types';

export interface ProgressDotsProps {
  statusByStep: Record<StepId, ProgressStepStatus>;
}

const dotClassByStatus: Record<ProgressStepStatus, string> = {
  pending: 'bg-surface-active',
  editing: 'bg-brand-subtle motion-safe:animate-pulse',
  configured: 'bg-bullish',
  error: 'bg-bearish',
};

export function ProgressDots({ statusByStep }: ProgressDotsProps) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {PROGRESS_STEPS.map((step) => (
        <span
          key={step.id}
          className={cn(
            'h-2 w-2 rounded-full transition-colors duration-fast ease-out-quick',
            dotClassByStatus[statusByStep[step.id]],
          )}
        />
      ))}
    </div>
  );
}
