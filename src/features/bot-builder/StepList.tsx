import {
  Sliders,
  LineChart,
  ArrowUpRight,
  Target,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { StepCard } from './components/StepCard';
import { StepConnector } from './components/StepConnector';
import { StepDrawer, type StepContentMap } from './components/StepDrawer';
import { AddStrategyButton } from './components/AddStrategyButton';
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

  const handleSave = () => {
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
              {next ? (
                <StepConnector fromStep={step.id} toStep={next.id} />
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="mt-6">
        <AddStrategyButton />
      </div>

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
