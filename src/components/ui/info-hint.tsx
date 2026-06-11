import { type ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';

export interface InfoHintProps {
  /** The explanatory copy shown in the tooltip. */
  text: ReactNode;
  /** Tooltip placement relative to the icon. */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Accessible name for the trigger button. */
  label?: string;
}

/**
 * A small `?` icon that reveals explanatory copy on hover/focus. Shared by
 * `FormField` (builder forms) and the bot-detail panels so help affordances
 * look and behave identically everywhere.
 */
export function InfoHint({
  text,
  side = 'top',
  label = 'More info',
}: InfoHintProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-xs leading-snug">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
