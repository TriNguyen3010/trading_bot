import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import type { StepId } from '@/types/builder.types';
import { cn } from '@/lib/utils';

export interface StepConnectorProps {
  fromStep: StepId;
  toStep: StepId;
}

/**
 * Vertical connector with marching-ants animation when both steps are
 * configured (per Spec/Phase 1/connection-lines/spec.md). When the upstream
 * step is configured but downstream isn't, the line is brand-colored and
 * dashed but not animated, hinting "continue here".
 */
export function StepConnector({ fromStep, toStep }: StepConnectorProps) {
  const fromStatus = useBuilderStore((s) => s.stepStatus[fromStep]);
  const toStatus = useBuilderStore((s) => s.stepStatus[toStep]);

  const tone =
    fromStatus === 'configured' && toStatus === 'configured'
      ? 'success'
      : fromStatus === 'configured'
        ? 'brand'
        : 'muted';

  const stroke =
    tone === 'success'
      ? 'var(--color-bullish)'
      : tone === 'brand'
        ? 'var(--brand-primary)'
        : 'var(--color-edge-default)';

  return (
    <TooltipProvider delayDuration={400}>
      <div className="relative flex h-12 w-full items-center justify-center">
        <svg
          aria-hidden
          className="absolute inset-0 h-full w-full"
          width="100%"
          height="100%"
        >
          <line
            x1="50%"
            y1="0"
            x2="50%"
            y2="100%"
            stroke={stroke}
            strokeWidth={2}
            strokeDasharray="8 4"
            strokeLinecap="round"
            className={cn(
              tone === 'success' && 'animate-march',
              tone === 'brand' && 'opacity-80',
              tone === 'muted' && 'opacity-50',
            )}
            style={{ vectorEffect: 'non-scaling-stroke' }}
          />
        </svg>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => toast('Inserting step coming in Phase 2.')}
              aria-label="Insert step (coming soon)"
              className={cn(
                'relative z-10 flex h-7 w-7 items-center justify-center rounded-full border bg-canvas text-fg-secondary opacity-0 transition-opacity duration-fast hover:opacity-100 group-hover:opacity-100',
                'border-border-strong hover:border-brand hover:text-brand',
                'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              )}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Insert step — Phase 2</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
