import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  CircleDashed,
  AlertTriangle,
  ArrowRight,
  Layers,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { validateBuilder, type BuilderIssue } from '@/lib/validator';
import {
  STRATEGY_SUB_STEPS,
  derivePhaseStatus,
} from '@/lib/phase-helpers';
import { strings } from '@/i18n/en';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { StepStatus, StepId } from '@/types/builder.types';
import { StepCardSummary } from './summaries/StepCardSummary';

const statusIcon: Record<
  StepStatus,
  { icon: LucideIcon; tone: string; label: string }
> = {
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

/** Friendly label for the sub-step that is the source of an issue, so the
 * tooltip can say "Issue in Action: ..." instead of just dumping the raw
 * stepId. */
const SUB_STEP_LABEL: Record<StepId, string> = {
  'bot-config': 'Bot',
  'entry-strategy': 'Entry',
  direction: 'Action',
  'close-method': 'Action',
};

/**
 * Composite card for the "Strategy" phase — aggregates the 3 underlying
 * stepStatus IDs (entry-strategy / direction / close-method) into a single
 * visual phase per Spec/Phase 1/two_phase_ui_plan.md §6.3.
 *
 * Click → sets `openStep` to 'entry-strategy', which routes the StepDrawer
 * into composite mode (since 'entry-strategy' ∈ STRATEGY_SUB_STEPS and the
 * caller passes `strategyCompositeContent`).
 *
 * Cypheus pinned highlight: when the pinned step belongs to any of the 3
 * sub-steps, this card lights up with brand glow (decision D3).
 */
export function StrategyCard() {
  const setOpenStep = useBuilderStore((s) => s.setOpenStep);
  const openStep = useBuilderStore((s) => s.openStep);
  const drawerMode = useCypheusStore((s) => s.drawerMode);
  const cypheusActiveStepId = useCypheusStore((s) => s.cypheusActiveStepId);
  const isPinned = drawerMode === 'cypheus-pinned';
  const isCypheusActive =
    isPinned &&
    cypheusActiveStepId !== null &&
    STRATEGY_SUB_STEPS.includes(cypheusActiveStepId);
  const state = useBuilderStore();

  // Derive the composite phase status. Note: `derivePhaseStatus` itself
  // already handles the priority rules (error > editing > configured >
  // pending) so we don't repeat them here.
  const phaseStatus = derivePhaseStatus(state, 'strategy');

  // Aggregate validator issues — but only for sub-steps that the user has
  // already marked configured. This mirrors StepCard's own "configured +
  // issue → error" override and avoids spamming the user with red-flag
  // tooltips before they've even started filling anything.
  const aggregatedIssue = useMemo<BuilderIssue | null>(() => {
    const allIssues = validateBuilder(state);
    return (
      allIssues.find(
        (i) =>
          STRATEGY_SUB_STEPS.includes(i.stepId) &&
          state.stepStatus[i.stepId] === 'configured',
      ) ?? null
    );
  }, [state]);

  const isOpen = openStep !== null && STRATEGY_SUB_STEPS.includes(openStep);

  // If aggregated issue exists, force visual to error regardless of the
  // raw phase status (mirrors StepCard's own "configured + issue → error"
  // override).
  const baseStatus: StepStatus = aggregatedIssue ? 'error' : phaseStatus;
  const visualStatus: StepStatus =
    isOpen && baseStatus === 'pending' ? 'editing' : baseStatus;
  const StatusIcon = statusIcon[visualStatus].icon;

  const handleClick = () => {
    if (isPinned) return;
    // Open the drawer; routing to composite mode happens because the parent
    // (BotBuilderCanvas) supplies `strategyCompositeContent` and the
    // StepDrawer detects activeStepId ∈ STRATEGY_SUB_STEPS.
    setOpenStep('entry-strategy');
  };

  const cardButton = (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isOpen}
      aria-disabled={isPinned}
      className={cn(
        'group relative flex w-full flex-col items-stretch overflow-hidden rounded-xl glass-card glass-card-hover text-left',
        'hover:border-brand/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        visualStatus === 'pending' && 'border-brand/15',
        visualStatus === 'editing' && 'border-brand shadow-glow',
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
          <Layers className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-2xs uppercase tracking-wide text-fg-muted">
            <span>Phase 2</span>
          </div>
          <h3 className="truncate text-md font-semibold text-fg">
            {strings.phase.strategy.title}
          </h3>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex items-center gap-3"
          >
            {visualStatus === 'pending' && (
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
        </AnimatePresence>
      </header>

      {/* Composite summary: stack the 3 sub-step summaries when the phase
          is in a "show me what's set" state. Each StepCardSummary
          subscribes to its own slice so this isn't expensive. */}
      {(visualStatus === 'configured' || visualStatus === 'error') && (
        <div
          className="w-full space-y-3 border-t border-border-subtle px-5 py-3 cursor-default"
          onClick={(e) => e.stopPropagation()}
        >
          <StepCardSummary stepId="entry-strategy" />
          <StepCardSummary stepId="direction" />
          <StepCardSummary stepId="close-method" />
        </div>
      )}
    </button>
  );

  if (!aggregatedIssue) return cardButton;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{cardButton}</TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <span className="font-medium text-danger">
            Issue in {SUB_STEP_LABEL[aggregatedIssue.stepId]}:
          </span>{' '}
          {aggregatedIssue.message}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
