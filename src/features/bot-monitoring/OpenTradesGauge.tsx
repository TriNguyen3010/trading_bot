import { cn } from '@/lib/utils';

const MAX_PIPS = 8;

export function OpenTradesGauge({
  open,
  max,
  tone = 'live',
  placeholder,
}: {
  open: number | null;
  max: number | null;
  /** Lit-pip color: green for Live, blue for Dry-run. */
  tone?: 'live' | 'dryrun';
  /** When set, show empty pips + this muted text instead of the numeric. */
  placeholder?: string;
}) {
  const total = max ?? 0;
  const filled = open ?? 0;
  const pipCount = Math.min(total, MAX_PIPS);
  // When capped (max > MAX_PIPS), keep ≥1 pip lit if any trade is open so the
  // gauge never reads "empty" while the numeric says otherwise.
  const filledPips = placeholder
    ? 0
    : total <= MAX_PIPS
      ? filled
      : filled > 0
        ? Math.max(1, Math.round((filled / total) * MAX_PIPS))
        : 0;
  const onColor = tone === 'dryrun' ? 'bg-info' : 'bg-bullish';

  return (
    <div className="flex items-center gap-2">
      {pipCount > 0 && (
        <div className="flex gap-[3px]" aria-hidden>
          {Array.from({ length: pipCount }).map((_, i) => {
            const on = !placeholder && i < filledPips;
            return (
              <span
                key={i}
                data-pip={on ? 'on' : 'off'}
                className={cn(
                  'h-[7px] w-[14px] rounded-[2px]',
                  on ? onColor : 'bg-border',
                )}
              />
            );
          })}
        </div>
      )}
      <span
        className={cn(
          'font-mono text-[13px] font-semibold tabular-nums',
          placeholder ? 'text-fg-disabled' : 'text-fg-secondary',
        )}
      >
        {placeholder ? placeholder : max == null ? '—/—' : `${filled}/${total}`}
      </span>
    </div>
  );
}
