import { useMemo } from 'react';
import { Check, CircleDashed, AlertTriangle, ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { validateBuilder } from '@/lib/validator';
import type { StepId, StepStatus } from '@/types/builder.types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { StepCardSummary } from './summaries/StepCardSummary';

const statusIcon: Record<StepStatus, { icon: LucideIcon; tone: string; label: string }> = {
  pending: {
    icon: CircleDashed,
    tone: 'text-fg-muted',
    label: 'Pending',
  },
  editing: {
    icon: CircleDashed,
    tone: 'text-brand animate-pulse',
    label: 'Editing',
  },
  configured: {
    icon: Check,
    tone: 'text-bullish',
    label: 'Configured',
  },
  error: {
    icon: AlertTriangle,
    tone: 'text-danger',
    label: 'Has errors',
  },
};

export interface StepCardProps {
  stepId: StepId;
  index: number;
  icon: LucideIcon;
  title: string;
}

export function StepCard({
  stepId,
  index,
  icon: Icon,
  title,
}: StepCardProps) {
  const status = useBuilderStore((s) => s.stepStatus[stepId]);
  const openStep = useBuilderStore((s) => s.openStep);
  const setOpenStep = useBuilderStore((s) => s.setOpenStep);
  const drawerMode = useCypheusStore((s) => s.drawerMode);
  const cypheusActiveStepId = useCypheusStore((s) => s.cypheusActiveStepId);
  const isPinned = drawerMode === 'cypheus-pinned';
  const isCypheusActive = isPinned && cypheusActiveStepId === stepId;
  const state = useBuilderStore();

  // Derive visual error state without mutating the store: if this step has
  // a "configured" stamp but the validator finds issues for it, surface the
  // first issue as a tooltip + red border + ! icon.
  const stepIssue = useMemo(() => {
    if (status !== 'configured') return null;
    const issues = validateBuilder(state);
    return issues.find((i) => i.stepId === stepId) ?? null;
  }, [status, state, stepId]);

  const isOpen = openStep === stepId;
  const baseStatus: StepStatus = stepIssue ? 'error' : status;
  const visualStatus: StepStatus =
    isOpen && baseStatus === 'pending' ? 'editing' : baseStatus;
  const StatusIcon = statusIcon[visualStatus].icon;

  const cardButton = (
    <button
      type="button"
      onClick={() => {
        if (isPinned) return;
        setOpenStep(stepId);
      }}
      aria-pressed={isOpen}
      aria-disabled={isPinned}
      className={cn(
        'group relative flex w-full flex-col items-stretch overflow-hidden rounded-xl border bg-surface text-left transition-all duration-fast ease-out-quick',
        'hover:bg-surface-hover hover:border-border-strong',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        visualStatus === 'configured' && 'border-bullish/40',
        visualStatus === 'editing' && 'border-brand shadow-glow',
        visualStatus === 'error' && 'border-danger',
        visualStatus === 'pending' && 'border-border',
        isCypheusActive && 'border-brand shadow-glow',
        isPinned && !isCypheusActive && 'cursor-not-allowed opacity-60',
      )}
    >
      <header className="flex w-full items-center gap-4 px-5 py-3">
        <div
          className={cn(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border',
            visualStatus === 'configured'
              ? 'border-bullish/40 bg-bullish/10 text-bullish'
              : 'border-border bg-canvas text-fg-secondary',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-2xs uppercase tracking-wide text-fg-muted">
            <span>Step {index}</span>
          </div>
          <h3 className="truncate text-md font-semibold text-fg">
            {title}
          </h3>
        </div>
        {status === 'pending' && (
          <span className="flex items-center gap-1 text-xs text-fg-muted">
            Tap to configure
            <ArrowRight className="h-3 w-3" />
          </span>
        )}
        <div
          className={cn(
            'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full',
            statusIcon[visualStatus].tone,
          )}
          aria-label={statusIcon[visualStatus].label}
        >
          <StatusIcon className="h-4 w-4" />
        </div>
      </header>

      {(visualStatus === 'configured' || visualStatus === 'error') && (
        <div className="w-full border-t border-border-subtle px-5 py-3 cursor-default" onClick={(e) => e.stopPropagation()}>
          <StepCardSummary stepId={stepId} />
        </div>
      )}
    </button>
  );

  if (!stepIssue) return cardButton;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{cardButton}</TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <span className="font-medium text-danger">Issue:</span> {stepIssue.message}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
