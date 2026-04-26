import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useBuilderStore } from '../store/builder.store';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { NumberInput } from '@/components/ui/number-input';
import { FormField } from '@/components/ui/form-field';
import type { Direction, OrderType } from '@/types/builder.types';

export function DirectionSetup() {
  const form = useBuilderStore((s) => s.directionForm);
  const patch = useBuilderStore((s) => s.patchDirection);

  return (
    <>
      <FormField
        label="Direction"
        required
        hint="Long profits when price rises. Short profits when it falls."
      >
        <ToggleGroup<Direction>
          value={form.direction}
          onChange={(v) => patch({ direction: v })}
          fullWidth
          ariaLabel="Trade direction"
          options={[
            {
              value: 'long',
              label: (
                <span className="inline-flex items-center justify-center gap-1.5">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Long
                </span>
              ),
              tone: 'bullish',
            },
            {
              value: 'short',
              label: (
                <span className="inline-flex items-center justify-center gap-1.5">
                  <ArrowDownRight className="h-3.5 w-3.5" />
                  Short
                </span>
              ),
              tone: 'bearish',
            },
          ]}
        />
      </FormField>

      <FormField
        label="Order type"
        required
        hint="Market fills immediately. Limit waits for a target price."
      >
        <ToggleGroup<OrderType>
          value={form.orderType}
          onChange={(v) => patch({ orderType: v })}
          fullWidth
          ariaLabel="Order type"
          options={[
            { value: 'market', label: 'Market' },
            { value: 'limit', label: 'Limit' },
          ]}
        />
      </FormField>
    </>
  );
}

export function DirectionConfigure() {
  const form = useBuilderStore((s) => s.directionForm);
  const patch = useBuilderStore((s) => s.patchDirection);

  return (
    <>
      {form.orderType === 'limit' ? (
        <FormField
          label="Limit offset"
          hint="Offset (%) from market price when placing the limit order. Negative = below market."
        >
          <NumberInput
            value={form.limitOffsetPct}
            onValueChange={(v) => patch({ limitOffsetPct: v })}
            step={0.1}
            suffix="%"
          />
        </FormField>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-canvas/40 p-4 text-xs text-fg-muted">
          Switch order type to <span className="text-fg">Limit</span> to set
          offset.
        </div>
      )}

      <FormField
        label="Slippage tolerance"
        hint="Max acceptable slippage on market orders."
      >
        <NumberInput
          value={form.slippageTolerance}
          onValueChange={(v) =>
            patch({ slippageTolerance: Math.max(0, v ?? 0) })
          }
          min={0}
          max={5}
          step={0.05}
          suffix="%"
        />
      </FormField>
    </>
  );
}
