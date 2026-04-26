import { useMemo } from 'react';
import { ArrowRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { useExportDialogStore } from '@/features/export-import/export-dialog.store';
import { validateBuilder, type BuilderIssue } from '@/lib/validator';
import { strings } from '@/i18n/en';
import { cn } from '@/lib/utils';
import type { StepId } from '@/types/builder.types';
import { ProgressDots } from './ProgressDots';
import { StepProgressPill } from './StepProgressPill';
import {
  PROGRESS_STEPS,
  type ProgressMode,
  type ProgressStepStatus,
} from './progress.types';

const STEP_IDS: StepId[] = PROGRESS_STEPS.map((s) => s.id);

function deriveVisualStatus(
  id: StepId,
  rawStatus: ProgressStepStatus,
  openStep: StepId | null,
  hasIssue: boolean,
): ProgressStepStatus {
  if (rawStatus === 'configured' && hasIssue) return 'error';
  if (openStep === id && rawStatus === 'pending') return 'editing';
  return rawStatus;
}

function deriveMode(
  configuredCount: number,
  issueCount: number,
): ProgressMode {
  // Pristine: nothing configured yet — keep tone gentle, don't show
  // validator issues that the user expects to fill in next.
  if (configuredCount === 0) return 'empty';
  if (configuredCount < 4) return 'in_progress';
  // All 4 configured.
  return issueCount === 0 ? 'ready' : 'error';
}

export function SetupProgress() {
  const stepStatus = useBuilderStore((s) => s.stepStatus);
  const openStep = useBuilderStore((s) => s.openStep);
  const setOpenStep = useBuilderStore((s) => s.setOpenStep);
  const setExportOpen = useExportDialogStore((s) => s.setOpen);
  const cypheusState = useCypheusStore((s) => s.state);
  const isBuilding = cypheusState === 'building';

  // Re-derive issues whenever any builder field changes. We deliberately read
  // the full state below so this memo invalidates on patches (zustand returns
  // a new state object on each set).
  const builderState = useBuilderStore();
  const issues = useMemo<BuilderIssue[]>(
    () => validateBuilder(builderState),
    [builderState],
  );

  const issuesByStep = useMemo(() => {
    const map: Partial<Record<StepId, BuilderIssue[]>> = {};
    for (const issue of issues) {
      const list = map[issue.stepId] ?? [];
      list.push(issue);
      map[issue.stepId] = list;
    }
    return map;
  }, [issues]);

  const configuredCount = STEP_IDS.filter(
    (id) => stepStatus[id] === 'configured',
  ).length;

  const visualStatusByStep = useMemo(() => {
    const out = {} as Record<StepId, ProgressStepStatus>;
    for (const id of STEP_IDS) {
      out[id] = deriveVisualStatus(
        id,
        stepStatus[id],
        openStep,
        Boolean(issuesByStep[id]?.length),
      );
    }
    return out;
  }, [stepStatus, openStep, issuesByStep]);

  const mode = deriveMode(configuredCount, issues.length);
  const showStepPills = mode === 'in_progress' || mode === 'error';
  const firstErrorStep = issues[0]?.stepId ?? null;
  const firstIssueMessage = issues[0]?.message ?? null;

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
    if (mode === 'error' && firstErrorStep) {
      return (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpenStep(firstErrorStep)}
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
        <ProgressDots statusByStep={visualStatusByStep} />
        <span
          className={labelClass}
          title={
            mode === 'error' && firstIssueMessage ? firstIssueMessage : undefined
          }
        >
          {labelText}
        </span>
        {cta}
      </div>

      {showStepPills && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PROGRESS_STEPS.map((step) => (
            <StepProgressPill
              key={step.id}
              stepId={step.id}
              shortLabel={step.shortLabel}
              status={visualStatusByStep[step.id]}
              onClick={setOpenStep}
            />
          ))}
        </div>
      )}

      {mode === 'error' && firstIssueMessage && (
        <button
          type="button"
          onClick={() =>
            firstErrorStep ? setOpenStep(firstErrorStep) : undefined
          }
          className="mt-1.5 block w-full truncate text-left text-2xs text-brand/80 hover:text-brand focus-visible:outline-none focus-visible:underline"
          title={firstIssueMessage}
        >
          → {firstIssueMessage}
        </button>
      )}
    </div>
  );
}
