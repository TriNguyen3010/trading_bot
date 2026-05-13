import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { ReadOnlyChip } from './shared/ReadOnlyChip';

export function DirectionSummary() {
  const directionForm = useBuilderStore((s) => s.directionForm);
  const { direction, orderType, limitOffsetPct } = directionForm;

  const isLong = direction === 'long';
  const isLimit = orderType === 'limit';

  const orderLabel = isLimit
    ? `Limit${limitOffsetPct !== null && limitOffsetPct !== undefined ? ` ${limitOffsetPct > 0 ? '+' : ''}${limitOffsetPct}%` : ''}`
    : 'Market';

  // Visual mode — bullish/bearish pill + arrow + order-type pill (mockup B action row).
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ReadOnlyChip
        tone={isLong ? 'bullish' : 'bearish'}
        icon={
          isLong ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )
        }
      >
        {isLong ? 'Long' : 'Short'}
      </ReadOnlyChip>
      <ArrowRight className="h-3 w-3 text-fg-muted" aria-hidden="true" />
      <ReadOnlyChip tone="neutral" title={`Order type: ${orderLabel}`}>
        {orderLabel}
      </ReadOnlyChip>
    </div>
  );
}
