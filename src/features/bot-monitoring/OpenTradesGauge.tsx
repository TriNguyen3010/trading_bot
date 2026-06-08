import { cn } from '@/lib/utils';

const MAX_PIPS = 8;

export function OpenTradesGauge({
  open,
  max,
}: {
  open: number | null;
  max: number | null;
}) {
  const total = max ?? 0;
  const filled = open ?? 0;
  const pipCount = Math.min(total, MAX_PIPS);
  const filledPips =
    total <= MAX_PIPS ? filled : Math.round((filled / total) * MAX_PIPS);

  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs uppercase tracking-wide text-fg-muted">
        Open
      </span>
      {pipCount > 0 && (
        <div className="flex gap-0.5" aria-hidden>
          {Array.from({ length: pipCount }).map((_, i) => (
            <span
              key={i}
              data-pip={i < filledPips ? 'on' : 'off'}
              className={cn(
                'h-1.5 w-2 rounded-sm',
                i < filledPips ? 'bg-brand' : 'bg-fg-muted/20',
              )}
            />
          ))}
        </div>
      )}
      <span className="font-mono text-2xs font-semibold tabular-nums text-fg">
        {max == null ? '—/—' : `${filled}/${total}`}
      </span>
    </div>
  );
}
