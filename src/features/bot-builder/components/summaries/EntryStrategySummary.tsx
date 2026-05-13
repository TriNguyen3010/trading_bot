import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { indicatorOutputId } from '@/features/indicators/indicator-registry';
import { ReadOnlyChip } from './shared/ReadOnlyChip';
import { ConditionPreview } from './shared/ConditionPreview';
import { cn } from '@/lib/utils';
import type { Candlestick } from '@/types/builder.types';

const CANDLE_CHANNELS: { key: Candlestick; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'close', label: 'Close' },
  { key: 'high', label: 'High' },
  { key: 'low', label: 'Low' },
  { key: 'volume', label: 'Volume' },
];

const MAX_INLINE_CONDITIONS = 2;

export function EntryStrategySummary() {
  const strategy = useBuilderStore((s) => s.strategy);
  const { candlestick, indicators, entryConditions } = strategy;
  const conditions = entryConditions.conditions;

  const isEmpty =
    candlestick.length === 0 && indicators.length === 0 && conditions.length === 0;
  if (isEmpty) {
    return <span className="text-xs italic text-fg-muted">No entry rules yet</span>;
  }

  const inlineConditions = conditions.slice(0, MAX_INLINE_CONDITIONS);
  const moreCount = conditions.length - inlineConditions.length;

  return (
    <div className="flex flex-col gap-2">
      {/* Rule code block — hero of the strategy card (mockup B) */}
      {conditions.length > 0 ? (
        <div className="rounded-md border border-border-subtle border-l-2 border-l-brand bg-black/30 px-3 py-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-2xs uppercase tracking-wide text-fg-muted">
              Entry rule
            </span>
            <span className="text-2xs text-fg-muted">
              {conditions.length} condition{conditions.length === 1 ? '' : 's'}
              {entryConditions.logic.type === 'OR' ? ' · OR' : ''}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 font-mono text-sm text-fg">
            {inlineConditions.map((row, idx) => (
              <ConditionPreview key={row.id} row={row} showOperator={idx > 0} />
            ))}
            {moreCount > 0 ? (
              <span className="text-2xs text-fg-muted">+ {moreCount} more</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Candle channel chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-2xs uppercase tracking-wide text-fg-muted">Candle</span>
        {CANDLE_CHANNELS.map(({ key, label }) => {
          const on = candlestick.includes(key);
          return (
            <span
              key={key}
              title={`${label} channel ${on ? 'enabled' : 'disabled'}`}
              className={cn(
                'inline-flex h-5 items-center rounded-full border px-1.5 text-2xs font-medium leading-none pointer-events-none select-none',
                on
                  ? 'border-brand/40 bg-brand-subtle text-fg'
                  : 'border-border bg-canvas text-fg-disabled opacity-60',
              )}
            >
              {label}
            </span>
          );
        })}
      </div>

      {/* Indicator pills */}
      {indicators.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-2xs uppercase tracking-wide text-fg-muted">
            Indicators
          </span>
          {indicators.map((ind) => (
            <ReadOnlyChip key={ind.id} tone="brand" title={`${ind.name} • ${indicatorOutputId(ind)}`}>
              {indicatorOutputId(ind)}
            </ReadOnlyChip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
