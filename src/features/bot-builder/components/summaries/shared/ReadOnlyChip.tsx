import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ChipTone =
  | 'neutral'
  | 'brand'
  | 'bullish'
  | 'bearish'
  | 'warning'
  | 'info';

export interface ReadOnlyChipProps {
  tone?: ChipTone;
  icon?: ReactNode;
  className?: string;
  title?: string;
  children: ReactNode;
}

const TONE_CLASSES: Record<ChipTone, string> = {
  neutral:
    'border-border bg-surface-hover text-fg-secondary',
  brand:
    'border-brand/40 bg-brand-subtle text-fg',
  bullish:
    'border-bullish/40 bg-bullish-subtle text-bullish',
  bearish:
    'border-bearish/40 bg-bearish-subtle text-bearish',
  warning:
    'border-warning/40 bg-warning/10 text-warning',
  info:
    'border-info/40 bg-info/10 text-info',
};

/**
 * Read-only chip / pill used inside StepCard summaries on the canvas.
 *
 * Visual rules per `card_redesign_plan.md`:
 *   - h-6 px-2 text-xs (smaller than interactive chips)
 *   - cursor: default — clicks fall through to the parent card button so
 *     tapping anywhere on the card opens the drawer.
 *   - pointer-events-none on the chip wrapper so child icons don't capture
 *     focus / hover and break the parent button affordance.
 */
export function ReadOnlyChip({
  tone = 'neutral',
  icon,
  className,
  title,
  children,
}: ReadOnlyChipProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-medium leading-none',
        'pointer-events-none select-none whitespace-nowrap',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {icon ? <span className="flex h-3 w-3 items-center justify-center">{icon}</span> : null}
      <span>{children}</span>
    </span>
  );
}
