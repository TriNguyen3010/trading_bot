import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PresentationalState } from './presentational-state';

interface BadgeStyle {
  label: string;
  cls: string;
  dot: string;
}

const BADGE: Record<PresentationalState, BadgeStyle> = {
  LIVE: {
    label: 'Live',
    cls: 'border-bullish/30 bg-bullish-subtle text-bullish',
    dot: 'bg-bullish',
  },
  'DRY-RUN': {
    label: 'Dry-run',
    cls: 'border-info/30 bg-info/[0.12] text-[#6ba2f8]',
    dot: 'bg-info',
  },
  PAUSED: {
    label: 'Paused',
    cls: 'border-border bg-fg-muted/[0.12] text-fg-muted',
    dot: 'bg-fg-muted',
  },
  NEW: {
    label: 'New',
    cls: 'border-border-strong bg-transparent text-fg-muted',
    dot: 'bg-fg-disabled',
  },
  STARTING: {
    label: 'Starting',
    cls: 'border-brand/30 bg-brand-subtle text-brand-hover',
    dot: 'bg-brand',
  },
  STOPPING: {
    label: 'Stopping',
    cls: 'border-brand/30 bg-brand-subtle text-brand-hover',
    dot: 'bg-brand',
  },
  BACKTESTING: {
    label: 'Backtesting',
    cls: 'border-brand/30 bg-brand-subtle text-brand-hover',
    dot: 'bg-brand',
  },
  BACKTEST_FAILED: {
    label: 'Paused',
    cls: 'border-border bg-fg-muted/[0.12] text-fg-muted',
    dot: 'bg-fg-muted',
  },
  ERROR: {
    label: 'Error',
    cls: 'border-bearish/35 bg-bearish-subtle text-bearish',
    dot: 'bg-bearish',
  },
};

const PULSE = new Set<PresentationalState>(['STARTING', 'STOPPING']);

export function StatusBadge({ state }: { state: PresentationalState }) {
  const b = BADGE[state];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border py-1 pl-2 pr-[9px] text-xs font-bold uppercase tracking-[0.4px]',
        b.cls,
      )}
    >
      {state === 'BACKTESTING' ? (
        <Loader2 className="h-[11px] w-[11px] animate-spin-fast" />
      ) : (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            b.dot,
            PULSE.has(state) && 'animate-badge-pulse',
          )}
        />
      )}
      {b.label}
    </span>
  );
}
