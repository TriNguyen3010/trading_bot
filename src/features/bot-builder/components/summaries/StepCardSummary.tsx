import type { StepId } from '@/types/builder.types';
import { BotConfigSummary } from './BotConfigSummary';
import { EntryStrategySummary } from './EntryStrategySummary';
import { DirectionSummary } from './DirectionSummary';
import { CloseMethodSummary } from './CloseMethodSummary';

export interface StepCardSummaryProps {
  stepId: StepId;
}

/**
 * Dispatcher that routes to the correct per-step summary component.
 *
 * Each summary subscribes to its own slice of the builder store, so a change
 * in (e.g.) `botConfig.pair` only re-renders BotConfigSummary, not the whole
 * card list.
 */
export function StepCardSummary({ stepId }: StepCardSummaryProps) {
  switch (stepId) {
    case 'bot-config':
      return <BotConfigSummary />;
    case 'entry-strategy':
      return <EntryStrategySummary />;
    case 'direction':
      return <DirectionSummary />;
    case 'close-method':
      return <CloseMethodSummary />;
    default: {
      const exhaustive: never = stepId;
      void exhaustive;
      return null;
    }
  }
}
