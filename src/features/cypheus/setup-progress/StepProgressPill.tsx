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

const pillClassByStatus: Record<ProgressStepStatus, string> = {
  pending: 'bg-surface text-fg-muted border-border-subtle hover:bg-surface-hover',
  editing:
    'bg-brand-subtle text-brand border-brand-subtle hover:bg-brand-subtle',
  configured:
    'bg-bullish-subtle text-bullish border-bullish-subtle hover:bg-bullish-subtle',
  error:
    'bg-bearish-subtle text-bearish border-bearish-subtle hover:bg-bearish-subtle',
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
