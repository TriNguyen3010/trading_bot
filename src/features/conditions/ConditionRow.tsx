import { X } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { NumberInput } from '@/components/ui/number-input';
import { cn } from '@/lib/utils';
import { indicatorOutputId } from '../indicators/indicator-registry';
import type {
  ConditionOp,
  ConditionRow as ConditionRowType,
  IndicatorItem,
} from '@/types/builder.types';

export interface ConditionRowProps {
  row: ConditionRowType;
  isFirst: boolean;
  indicators: IndicatorItem[];
  candlestickChannels: ('open' | 'close' | 'high' | 'low' | 'volume')[];
  onChange: (patch: Partial<ConditionRowType>) => void;
  onRemove: () => void;
}

const ALL_OPS: { value: ConditionOp; label: string; rightType: 'value' | 'none' }[] = [
  { value: '>', label: '>', rightType: 'value' },
  { value: '<', label: '<', rightType: 'value' },
  { value: '>=', label: '≥', rightType: 'value' },
  { value: '<=', label: '≤', rightType: 'value' },
  { value: '==', label: '=', rightType: 'value' },
  { value: 'crosses_above', label: 'crosses above', rightType: 'value' },
  { value: 'crosses_below', label: 'crosses below', rightType: 'value' },
  { value: 'is_going_up', label: 'is going up', rightType: 'none' },
  { value: 'is_going_down', label: 'is going down', rightType: 'none' },
];

export function ConditionRow({
  row,
  isFirst,
  indicators,
  candlestickChannels,
  onChange,
  onRemove,
}: ConditionRowProps) {
  const opMeta = ALL_OPS.find((o) => o.value === row.op) ?? ALL_OPS[0];
  const needsRightValue = opMeta.rightType === 'value';

  const leftOptions: { value: string; label: string }[] = [
    ...candlestickChannels.map((c) => ({
      value: `candle.${c}`,
      label: `candle.${c}`,
    })),
    ...indicators.map((i) => {
      const id = indicatorOutputId(i);
      return { value: id, label: id };
    }),
  ];

  // Ensure the row's left is at least visible in the dropdown.
  if (row.left && !leftOptions.find((o) => o.value === row.left)) {
    leftOptions.push({ value: row.left, label: row.left });
  }

  const indicatorChoices = indicators.map((i) => indicatorOutputId(i));

  const isInvalid =
    needsRightValue &&
    ((row.right_type === 'number' && row.right_number === null) ||
      (row.right_type === 'indicator' && !row.right_indicator));

  return (
    <div
      className={cn(
        'rounded-lg border bg-surface p-3',
        isInvalid ? 'border-danger/60' : 'border-border',
      )}
    >
      {/* Row 1: glue (AND/OR or IF) · left side · operator
       *
       * The drawer is fixed at 480px so trying to fit all 6 controls in
       * a single line overflowed (the `sm:flex-row` from the previous
       * design assumed a wider container). 2-row layout fits cleanly
       * and stays readable even with longer operator labels like
       * "crosses above". */}
      <div className="flex items-center gap-2">
        {isFirst ? (
          <span className="w-12 shrink-0 text-center text-xs font-semibold uppercase tracking-wide text-fg-muted">
            IF
          </span>
        ) : null}
        <Select
          aria-label="Left side"
          value={row.left}
          onChange={(e) => onChange({ left: e.target.value })}
          className="min-w-0 flex-1"
        >
          {leftOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Operator"
          value={row.op}
          onChange={(e) => {
            const newOp = e.target.value as ConditionOp;
            const meta = ALL_OPS.find((o) => o.value === newOp);
            if (meta?.rightType === 'none') {
              onChange({
                op: newOp,
                right_type: 'none',
                right_number: null,
                right_indicator: null,
              });
            } else {
              onChange({ op: newOp });
            }
          }}
          className="w-36 shrink-0"
        >
          {ALL_OPS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Row 2: right type · right value · remove
       *
       * Indented to visually align under the left dropdown above (skip
       * the AND/OR/IF glue width). Helps the eye read "X op Y". */}
      <div className={cn('mt-2 flex items-center gap-2', isFirst && 'pl-12')}>
        {needsRightValue ? (
          <>
            <Select
              aria-label="Right type"
              value={row.right_type === 'none' ? 'number' : row.right_type}
              onChange={(e) => {
                const t = e.target.value as 'number' | 'indicator';
                onChange({
                  right_type: t,
                  right_number: t === 'number' ? (row.right_number ?? 0) : null,
                  right_indicator:
                    t === 'indicator'
                      ? row.right_indicator ?? indicatorChoices[0] ?? null
                      : null,
                });
              }}
              className="w-28 shrink-0"
            >
              <option value="number">Number</option>
              <option value="indicator" disabled={indicatorChoices.length === 0}>
                Indicator
              </option>
            </Select>
            {row.right_type === 'indicator' ? (
              <Select
                aria-label="Right indicator"
                value={row.right_indicator ?? ''}
                onChange={(e) => onChange({ right_indicator: e.target.value })}
                className="min-w-0 flex-1"
              >
                {indicatorChoices.length === 0 ? (
                  <option value="">—</option>
                ) : (
                  indicatorChoices.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))
                )}
              </Select>
            ) : (
              <NumberInput
                aria-label="Right number"
                value={row.right_number}
                onValueChange={(v) => onChange({ right_number: v })}
                step={0.1}
                className="min-w-0 flex-1"
                aria-invalid={row.right_number === null}
              />
            )}
          </>
        ) : (
          <span className="flex-1 text-xs italic text-fg-muted">
            (no right value)
          </span>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove condition"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bearish/10 hover:text-bearish focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
