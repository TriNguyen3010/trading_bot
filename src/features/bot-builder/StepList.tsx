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
import { StepDrawer } from './components/StepDrawer';
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

export function StepList() {
  const openStep = useBuilderStore((s) => s.openStep);
  const setOpenStep = useBuilderStore((s) => s.setOpenStep);
  const setStepStatus = useBuilderStore((s) => s.setStepStatus);

  const closeDrawer = () => setOpenStep(null);

  const handleSave = (id: StepId) => {
    setStepStatus(id, 'configured');
    closeDrawer();
  };

  const handleSaveAndNext = (id: StepId) => {
    setStepStatus(id, 'configured');
    const idx = STEP_DEFS.findIndex((s) => s.id === id);
    const next = STEP_DEFS[idx + 1];
    if (next) setOpenStep(next.id);
    else closeDrawer();
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

      {STEP_DEFS.map((step, idx) => (
        <StepDrawer
          key={step.id}
          stepId={step.id}
          title={step.title}
          description={step.description}
          setupContent={step.setup}
          configureContent={step.configure}
          open={openStep === step.id}
          onClose={closeDrawer}
          onSave={() => handleSave(step.id)}
          onSaveAndNext={() => handleSaveAndNext(step.id)}
          hasNext={idx < STEP_DEFS.length - 1}
        />
      ))}
    </div>
  );
}
