import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CircleDashed, AlertTriangle, ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { CypheusAvatar } from '@/features/cypheus/CypheusAvatar';
import { validateBuilder } from '@/lib/validator';
import type { StepId, StepStatus } from '@/types/builder.types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { StepCardSummary } from './summaries/StepCardSummary';
import styles from './StepCard.module.css';

// All 4 statuses share the brand hue — differentiated by opacity + icon
// shape + glow/ring. See Spec/Phase 1/card_yellow_stages_plan.md.
const statusIcon: Record<StepStatus, { icon: LucideIcon; tone: string; label: string }> = {
  pending: {
    icon: CircleDashed,
    tone: 'text-brand/40',
    label: 'Pending',
  },
  editing: {
    icon: CircleDashed,
    tone: 'text-brand motion-safe:animate-pulse',
    label: 'Editing',
  },
  configured: {
    icon: Check,
    tone: 'text-brand',
    label: 'Configured',
  },
  error: {
    icon: AlertTriangle,
    tone: 'text-brand',
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
  const phase = useCypheusStore((s) => s.phase);
  const setPhase = useCypheusStore((s) => s.setPhase);
  const isPinned = drawerMode === 'cypheus-pinned';
  const isCypheusActive = isPinned && cypheusActiveStepId === stepId;
  const state = useBuilderStore();

  // Step 1 anchor only kicks in for a brand-new session (phase still
  // 'idle') AND while bot-config has not been touched yet. Once the user
  // (or Cypheus) has configured/edited it, defer to the normal status-icon
  // rendering so the green check, summary, and editing pulse all show.
  const isStep1Idle =
    stepId === 'bot-config' && phase === 'idle' && status === 'pending';

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

  const handleClick = () => {
    if (isPinned) return;
    if (phase === 'idle') setPhase('active');
    setOpenStep(stepId);
  };

  const cardButton = (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isOpen}
      aria-disabled={isPinned}
      className={cn(
        'group relative flex w-full flex-col items-stretch overflow-hidden rounded-xl border bg-surface text-left transition-all duration-fast ease-out-quick',
        'hover:bg-surface-hover hover:border-brand/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        isStep1Idle && styles.highlighted,
        !isStep1Idle && visualStatus === 'pending' && 'border-brand/15',
        visualStatus === 'editing' && 'border-brand shadow-glow',
        // Boosted from brand/50 → brand/80 + tinted background so the
        // "done" state reads clearly on dark canvas instead of the
        // washed-out near-white edge it had before.
        visualStatus === 'configured' && 'border-brand/80 bg-brand-subtle/20',
        visualStatus === 'error' && 'border-brand ring-2 ring-brand/40',
        isCypheusActive && 'border-brand shadow-glow',
        isPinned && !isCypheusActive && 'cursor-not-allowed opacity-60',
      )}
    >
      <header className="flex w-full items-center gap-4 px-5 py-3">
        <div
          className={cn(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border',
            visualStatus === 'pending' &&
              'border-brand/15 bg-canvas text-fg-secondary',
            visualStatus === 'editing' &&
              'border-brand/40 bg-brand-subtle text-brand',
            visualStatus === 'configured' &&
              'border-brand/60 bg-brand-subtle text-brand',
            visualStatus === 'error' &&
              'border-brand bg-brand-subtle text-brand',
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
        <AnimatePresence mode="wait" initial={false}>
          {isStep1Idle ? (
            <motion.div
              key="anchor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="flex items-center gap-3"
            >
              <span className="flex items-center gap-1 text-xs text-fg-muted">
                Tap to configure
                <ArrowRight className="h-3 w-3" />
              </span>
              <CypheusAvatar size="xl" />
            </motion.div>
          ) : (
            <motion.div
              key="status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="flex items-center gap-3"
            >
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
            </motion.div>
          )}
        </AnimatePresence>
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
