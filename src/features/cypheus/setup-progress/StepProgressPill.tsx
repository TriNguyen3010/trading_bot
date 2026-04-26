import { AlertTriangle, Check, Circle, CircleDashed } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StepId } from '@/types/builder.types';
import type { ProgressStepStatus } from './progress.types';

export interface StepProgressPillProps {
  stepId: StepId;
  shortLabel: string;
  status: ProgressStepStatus;
  onClick: (stepId: StepId) => void;
}

const iconByStatus: Record<ProgressStepStatus, LucideIcon> = {
  pending: CircleDashed,
  editing: Circle,
  configured: Check,
  error: AlertTriangle,
};

// Brand-only palette per Spec/Phase 1/card_yellow_stages_plan.md.
const pillClassByStatus: Record<ProgressStepStatus, string> = {
  pending: 'bg-surface text-fg-muted border-brand/15 hover:bg-surface-hover',
  editing:
    'bg-brand-subtle text-brand border-brand/40 hover:bg-brand-subtle',
  configured:
    'bg-brand-subtle text-brand border-brand/50 hover:bg-brand-subtle',
  error:
    'bg-brand-subtle text-brand border-brand ring-1 ring-brand/40 hover:bg-brand-subtle',
};

export function StepProgressPill({
  stepId,
  shortLabel,
  status,
  onClick,
}: StepProgressPillProps) {
  const Icon = iconByStatus[status];
  return (
    <button
      type="button"
      onClick={() => onClick(stepId)}
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-2xs font-medium',
        'transition-colors duration-fast ease-out-quick',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-canvas',
        pillClassByStatus[status],
      )}
      aria-label={`Open ${shortLabel} step`}
    >
      <Icon className="h-3 w-3" />
      <span>{shortLabel}</span>
    </button>
  );
}
