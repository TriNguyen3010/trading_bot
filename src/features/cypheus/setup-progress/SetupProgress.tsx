import { useMemo } from 'react';
import { ArrowRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { useExportDialogStore } from '@/features/export-import/export-dialog.store';
import { validateBuilder, type BuilderIssue } from '@/lib/validator';
import {
  PHASE_IDS,
  STRATEGY_SUB_STEPS,
  configuredPhaseCount,
  derivePhaseStatus,
  stepIdToPhase,
  type PhaseId,
} from '@/lib/phase-helpers';
import { strings } from '@/i18n/en';
import { cn } from '@/lib/utils';
import type { StepId } from '@/types/builder.types';
import { ProgressDots } from './ProgressDots';
import { StepProgressPill } from './StepProgressPill';
import {
  PROGRESS_PHASES,
  type ProgressMode,
  type ProgressStepStatus,
} from './progress.types';

/** Map a phase id back to the stepId we should setOpenStep() with so the
 * drawer routes correctly. For the Strategy composite phase, we open
 * 'entry-strategy' which the StepDrawer dispatches into composite mode
 * (see BotBuilderCanvas wiring in PR-2). */
function openStepIdFor(phase: PhaseId): StepId {
  return phase === 'bot-basics' ? 'bot-config' : 'entry-strategy';
}

function deriveMode(
  configuredCount: number,
  issueCount: number,
): ProgressMode {
  // Pristine: nothing configured yet — keep tone gentle, don't surface
  // validator issues that the user expects to fill in next.
  if (configuredCount === 0) return 'empty';
  // configuredCount can only be 0/1/2 in the 2-phase model.
  if (configuredCount < 2) return 'in_progress';
  return issueCount === 0 ? 'ready' : 'error';
}

export function SetupProgress() {
  const setOpenStep = useBuilderStore((s) => s.setOpenStep);
  const setExportOpen = useExportDialogStore((s) => s.setOpen);
  const cypheusState = useCypheusStore((s) => s.state);
  const isBuilding = cypheusState === 'building';

  // Read the full state so the validator memo invalidates on any patch.
  const builderState = useBuilderStore();
  const issues = useMemo<BuilderIssue[]>(
    () => validateBuilder(builderState),
    [builderState],
  );

  // Per-phase visual status. derivePhaseStatus already handles the
  // pending/editing/configured/error priority; we then layer a
  // "configured + validator-issue → error" override per phase, mirroring
  // StepCard / StrategyCard.
  const visualStatusByPhase = useMemo<
    Record<PhaseId, ProgressStepStatus>
  >(() => {
    const out = {} as Record<PhaseId, ProgressStepStatus>;
    for (const phase of PHASE_IDS) {
      const base = derivePhaseStatus(builderState, phase);
      const subSteps: readonly StepId[] =
        phase === 'bot-basics' ? ['bot-config'] : STRATEGY_SUB_STEPS;
      const hasConfiguredIssue = issues.some(
        (i) =>
          subSteps.includes(i.stepId) &&
          builderState.stepStatus[i.stepId] === 'configured',
      );
      out[phase] = hasConfiguredIssue ? 'error' : base;
    }
    return out;
  }, [builderState, issues]);

  const configuredCount = configuredPhaseCount(builderState);
  const mode = deriveMode(configuredCount, issues.length);
  const showStepPills = mode === 'in_progress' || mode === 'error';
  const firstIssue = issues[0] ?? null;
  const firstIssuePhase: PhaseId | null = firstIssue
    ? stepIdToPhase(firstIssue.stepId)
    : null;

  const labelText = (() => {
    switch (mode) {
      case 'empty':
        return strings.cypheus.progress.empty;
      case 'ready':
        return strings.cypheus.progress.ready;
      case 'error':
        return strings.cypheus.progress.issuesBlock(issues.length);
      case 'in_progress': {
        const base = strings.cypheus.progress.configured(configuredCount);
        return issues.length > 0
          ? `${base} · ${strings.cypheus.progress.issues(issues.length)}`
          : base;
      }
    }
  })();

  // Brand-only palette per Spec/Phase 1/card_yellow_stages_plan.md — ready
  // and error both speak in brand; tone difference comes from the CTA shape
  // and dot-row state, not from green/red label hue.
  const labelClass = cn(
    'flex-1 truncate text-xs',
    (mode === 'ready' || mode === 'error') && 'text-brand font-medium',
    (mode === 'empty' || mode === 'in_progress') && 'text-fg-secondary',
  );

  const handlePillClick = (phase: PhaseId) => {
    setOpenStep(openStepIdFor(phase));
  };

  const cta = (() => {
    if (mode === 'ready') {
      return (
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={() => setExportOpen(true)}
          aria-label={strings.cypheus.progress.export}
        >
          <Download className="h-3.5 w-3.5" />
          {strings.cypheus.progress.export}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      );
    }
    if (mode === 'error' && firstIssuePhase) {
      return (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpenStep(openStepIdFor(firstIssuePhase))}
          className="text-brand hover:bg-brand-subtle"
        >
          {strings.cypheus.progress.fix}
        </Button>
      );
    }
    return null;
  })();

  return (
    <div
      className={cn(
        'border-t border-border-subtle bg-canvas px-4 py-2.5',
        mode === 'ready' && 'bg-brand-subtle',
        isBuilding && 'pointer-events-none opacity-60',
      )}
    >
      <div className="flex items-center gap-3">
        <ProgressDots statusByPhase={visualStatusByPhase} />
        <span
          className={labelClass}
          title={
            mode === 'error' && firstIssue ? firstIssue.message : undefined
          }
        >
          {labelText}
        </span>
        {cta}
      </div>

      {showStepPills && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PROGRESS_PHASES.map((phase) => (
            <StepProgressPill
              key={phase.id}
              phaseId={phase.id}
              shortLabel={phase.shortLabel}
              status={visualStatusByPhase[phase.id]}
              onClick={handlePillClick}
            />
          ))}
        </div>
      )}

      {mode === 'error' && firstIssue && firstIssuePhase && (
        <button
          type="button"
          onClick={() => setOpenStep(openStepIdFor(firstIssuePhase))}
          className="mt-1.5 block w-full truncate text-left text-2xs text-brand/80 hover:text-brand focus-visible:outline-none focus-visible:underline"
          title={firstIssue.message}
        >
          → {firstIssue.message}
        </button>
      )}
    </div>
  );
}
