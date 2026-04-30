import { AlertTriangle, Check, Circle, CircleDashed } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PhaseId } from '@/lib/phase-helpers';
import type { ProgressStepStatus } from './progress.types';

export interface PhaseProgressPillProps {
  phaseId: PhaseId;
  shortLabel: string;
  status: ProgressStepStatus;
  onClick: (phaseId: PhaseId) => void;
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

/**
 * Compact pill button for each phase in the SetupProgress widget. Click
 * routes the user into the matching drawer (Bot Basics → legacy tabs
 * drawer, Strategy → composite drawer).
 */
export function PhaseProgressPill({
  phaseId,
  shortLabel,
  status,
  onClick,
}: PhaseProgressPillProps) {
  const Icon = iconByStatus[status];
  return (
    <button
      type="button"
      onClick={() => onClick(phaseId)}
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-2xs font-medium',
        'transition-colors duration-fast ease-out-quick',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-canvas',
        pillClassByStatus[status],
      )}
      aria-label={`Open ${shortLabel} phase`}
    >
      <Icon className="h-3 w-3" />
      <span>{shortLabel}</span>
    </button>
  );
}
