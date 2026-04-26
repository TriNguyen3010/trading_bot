import {
  Sliders,
  LineChart,
  ArrowUpRight,
  Target,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ReactNode } from 'react';
import { StepCard } from './components/StepCard';
import { StepConnector } from './components/StepConnector';
import { StepDrawer, type StepContentMap } from './components/StepDrawer';
import {
  BotConfigSetup,
  BotConfigConfigure,
} from './steps/BotConfigStep';
import {
  EntryStrategySetup,
  EntryStrategyConfigure,
} from './steps/EntryStrategyStep';
import { DirectionSetup, DirectionConfigure } from './steps/DirectionStep';
import {
  CloseMethodSetup,
  CloseMethodConfigure,
} from './steps/CloseMethodStep';
import { useBuilderStore } from './store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { strings } from '@/i18n/en';
import type { StepId } from '@/types/builder.types';

interface StepDef {
  id: StepId;
  index: number;
  icon: LucideIcon;
  title: string;
  description: string;
  setup: ReactNode;
  configure: ReactNode;
}

const STEP_DEFS: StepDef[] = [
  {
    id: 'bot-config',
    index: 1,
    icon: Sliders,
    title: strings.steps.botConfig.title,
    description: strings.steps.botConfig.description,
    setup: <BotConfigSetup />,
    configure: <BotConfigConfigure />,
  },
  {
    id: 'entry-strategy',
    index: 2,
    icon: LineChart,
    title: strings.steps.entryStrategy.title,
    description: strings.steps.entryStrategy.description,
    setup: <EntryStrategySetup />,
    configure: <EntryStrategyConfigure />,
  },
  {
    id: 'direction',
    index: 3,
    icon: ArrowUpRight,
    title: strings.steps.direction.title,
    description: strings.steps.direction.description,
    setup: <DirectionSetup />,
    configure: <DirectionConfigure />,
  },
  {
    id: 'close-method',
    index: 4,
    icon: Target,
    title: strings.steps.closeMethod.title,
    description: strings.steps.closeMethod.description,
    setup: <CloseMethodSetup />,
    configure: <CloseMethodConfigure />,
  },
];

const CONTENT_BY_STEP: Record<StepId, StepContentMap> = STEP_DEFS.reduce(
  (acc, s) => {
    acc[s.id] = {
      setup: s.setup,
      configure: s.configure,
      title: s.title,
      description: s.description,
      index: s.index,
    };
    return acc;
  },
  {} as Record<StepId, StepContentMap>,
);

export function StepList() {
  const openStep = useBuilderStore((s) => s.openStep);
  const setOpenStep = useBuilderStore((s) => s.setOpenStep);
  const setStepStatus = useBuilderStore((s) => s.setStepStatus);
  const closeCypheusDrawer = useCypheusStore((s) => s.closeCypheusDrawer);
  const setPanelTab = useCypheusStore((s) => s.setPanelTab);

  const closeManualDrawer = () => setOpenStep(null);

  // Single save handler for all "save & close" intents triggered by the
  // wizard footer: regular Save, Skip & Save (from Setup tab when setup
  // passes), and Save & Finish (final step). All three currently share the
  // same effect — mark step configured and close drawer — but kept as
  // separate modes for future divergence (e.g. analytics, post-save toast
  // copy that varies by intent).
  const handleSave = (_mode: 'save' | 'skip-save' | 'save-and-finish') => {
    if (!openStep) return;
    setStepStatus(openStep, 'configured');
    closeManualDrawer();
  };

  const handleSaveAndNext = () => {
    if (!openStep) return;
    setStepStatus(openStep, 'configured');
    const idx = STEP_DEFS.findIndex((s) => s.id === openStep);
    const next = STEP_DEFS[idx + 1];
    if (next) setOpenStep(next.id);
    else closeManualDrawer();
  };

  const hasNext = openStep
    ? STEP_DEFS.findIndex((s) => s.id === openStep) < STEP_DEFS.length - 1
    : false;

  const handleSummaryDismiss = () => closeCypheusDrawer();
  const handleSummaryReviewJson = () => {
    closeCypheusDrawer();
    setPanelTab('json');
  };

  return (
    <div className="mx-auto flex w-full max-w-[var(--layout-step-list)] flex-col">
      <ol className="space-y-0">
        {STEP_DEFS.map((step, idx) => {
          const next = STEP_DEFS[idx + 1];
          return (
            <li key={step.id} className="group flex flex-col">
              <StepCard
                stepId={step.id}
                index={step.index}
                icon={step.icon}
                title={step.title}
              />
              {/* For bot-config: skip StepConnector, use Add Strategy row as the sole connector */}
              {next && step.id !== 'bot-config' ? (
                <StepConnector fromStep={step.id} toStep={next.id} />
              ) : null}
              {/* Add Strategy slot: single centered + with text, replaces connector gap */}
              {step.id === 'bot-config' && (
                <button
                  type="button"
                  onClick={() => toast.info('Add Strategy — coming soon')}
                  aria-label="Add strategy (coming soon)"
                  className="group/add relative flex h-20 w-full items-center text-left appearance-none bg-transparent focus:outline-none active:bg-transparent"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {/* Vertical dashed line */}
                  <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full">
                    <line
                      x1="50%" y1="0" x2="50%" y2="100%"
                      stroke="var(--color-edge-default)"
                      strokeWidth={2}
                      strokeDasharray="8 4"
                      strokeLinecap="round"
                      style={{ vectorEffect: 'non-scaling-stroke' }}
                    />
                  </svg>
                  {/* Left spacer — pushes dot to exact 50% */}
                  <span className="flex-1" />
                  {/* Single big + centered on the axis */}
                  <span className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border-strong bg-canvas text-fg-muted shadow-sm transition-all duration-fast group-hover/add:border-brand group-hover/add:text-brand">
                    <Plus className="h-4 w-4" />
                  </span>
                  {/* Label to the right */}
                  <span className="flex-1 pl-4 text-sm text-fg-muted transition-colors duration-fast group-hover/add:text-brand">
                    Add Strategy
                  </span>
                </button>
              )}
            </li>
          );
        })}
      </ol>

      <StepDrawer
        contentByStep={CONTENT_BY_STEP}
        onManualClose={closeManualDrawer}
        onManualSave={handleSave}
        onManualSaveAndNext={handleSaveAndNext}
        hasNext={hasNext}
        onSummaryDismiss={handleSummaryDismiss}
        onSummaryReviewJson={handleSummaryReviewJson}
      />
    </div>
  );
}
