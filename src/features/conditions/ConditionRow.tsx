import { X } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { NumberInput } from '@/components/ui/number-input';
import { cn } from '@/lib/utils';
import { formatConditionRefLabel } from '@/lib/condition-labels';
import {
  INDICATOR_REGISTRY,
  indicatorOutputId,
} from '../indicators/indicator-registry';
import { MetricCombobox, type MetricOption } from './MetricCombobox';
import type {
  ConditionOp,
  ConditionRow as ConditionRowType,
  IndicatorItem,
} from '@/types/builder.types';

export interface ConditionRowProps {
  row: ConditionRowType;
  indicators: IndicatorItem[];
  candlestickChannels: ('open' | 'close' | 'high' | 'low' | 'volume')[];
  onChange: (patch: Partial<ConditionRowType>) => void;
  onRemove: () => void;
}

const ALL_OPS: {
  value: ConditionOp;
  label: string;
  rightType: 'value' | 'none';
}[] = [
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
  indicators,
  candlestickChannels,
  onChange,
  onRemove,
}: ConditionRowProps) {
  const opMeta = ALL_OPS.find((o) => o.value === row.op) ?? ALL_OPS[0];
  const needsRightValue = opMeta.rightType === 'value';

  const leftOptions: MetricOption[] = [
    ...candlestickChannels.map((c) => ({
      value: `candle.${c}`,
      label: formatConditionRefLabel(`candle.${c}`),
      category: 'Candle',
    })),
    ...indicators.map((i) => {
      const id = indicatorOutputId(i);
      return {
        value: id,
        label: id,
        category: INDICATOR_REGISTRY[i.name]?.category ?? 'Custom',
        description: INDICATOR_REGISTRY[i.name]?.description,
      };
    }),
  ];

  // Ensure the row's left is at least visible in the dropdown — covers
  // imported / templated refs whose definition isn't in the catalog.
  if (row.left && !leftOptions.find((o) => o.value === row.left)) {
    leftOptions.push({
      value: row.left,
      label: formatConditionRefLabel(row.left),
      category: 'Custom',
    });
  }

  const indicatorOptions: MetricOption[] = indicators.map((i) => ({
    value: indicatorOutputId(i),
    label: indicatorOutputId(i),
    category: INDICATOR_REGISTRY[i.name]?.category ?? 'Custom',
    description: INDICATOR_REGISTRY[i.name]?.description,
  }));
  if (
    row.right_indicator &&
    !indicatorOptions.find((o) => o.value === row.right_indicator)
  ) {
    indicatorOptions.push({
      value: row.right_indicator,
      label: formatConditionRefLabel(row.right_indicator),
      category: 'Custom',
    });
  }
  const hasIndicators = indicatorOptions.length > 0;

  const isInvalid =
    needsRightValue &&
    ((row.right_type === 'number' && row.right_number === null) ||
      (row.right_type === 'indicator' && !row.right_indicator));

  return (
    <div
      className={cn(
        'relative rounded-lg border bg-surface p-3',
        isInvalid ? 'border-danger/60' : 'border-border',
      )}
    >
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove condition"
        className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-fg-muted/40 transition-colors hover:bg-bearish/10 hover:text-bearish focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {/* Row 1: left side · operator. Grid (not flex) so each cell is
       * forced to 50% of the row regardless of the child's intrinsic
       * width — without this, `<select>` and `<input>` size to their
       * longest option / size attribute and the two rows misalign. */}
      <div className="grid grid-cols-2 gap-2 pr-7">
        <MetricCombobox
          ariaLabel="Left side"
          value={row.left}
          onChange={(value) => onChange({ left: value })}
          options={leftOptions}
          className="min-w-0 flex-1"
        />
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
          className="min-w-0 flex-1"
        >
          {ALL_OPS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Row 2: right type · right value — same grid as row 1 for
       * column alignment. */}
      <div className="mt-2 grid grid-cols-2 gap-2 pr-7">
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
                      ? (row.right_indicator ??
                        indicatorOptions[0]?.value ??
                        null)
                      : null,
                });
              }}
              className="min-w-0 flex-1"
            >
              <option value="number">Number</option>
              <option value="indicator" disabled={!hasIndicators}>
                Indicator
              </option>
            </Select>
            {row.right_type === 'indicator' ? (
              <MetricCombobox
                ariaLabel="Right indicator"
                value={row.right_indicator ?? ''}
                onChange={(value) => onChange({ right_indicator: value })}
                options={indicatorOptions}
                placeholder={hasIndicators ? 'Select indicator…' : '—'}
                className="min-w-0 flex-1"
              />
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
          <span className="col-span-2 text-xs italic text-fg-muted">
            (no right value)
          </span>
        )}
      </div>
    </div>
  );
}
