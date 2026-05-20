import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useBuilderStore } from '../store/builder.store';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { NumberInput } from '@/components/ui/number-input';
import { FormField } from '@/components/ui/form-field';
import { strings } from '@/i18n/en';
import type { Direction, OrderType } from '@/types/builder.types';

const HELP = strings.helpText.strategy;

export function DirectionSetup() {
  const form = useBuilderStore((s) => s.directionForm);
  const patch = useBuilderStore((s) => s.patchDirection);

  return (
    <>
      <FormField label="Direction" required help={HELP.direction}>
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

      <FormField label="Order type" required help={HELP.orderType}>
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

      {form.orderType === 'limit' && (
        <FormField label="Limit offset" help={HELP.limitOffset}>
          <NumberInput
            value={form.limitOffsetPct}
            onValueChange={(v) => patch({ limitOffsetPct: v })}
            step={0.1}
            suffix="%"
          />
        </FormField>
      )}
    </>
  );
}
