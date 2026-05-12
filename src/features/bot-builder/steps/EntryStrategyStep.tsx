import { useBuilderStore } from '../store/builder.store';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { IndicatorChip } from '@/features/indicators/IndicatorChip';
import { ConditionBuilder } from '@/features/conditions/ConditionBuilder';
import { useConditionMetrics } from '@/features/conditions/useConditionMetrics';

export function EntryStrategySetup() {
  const strategy = useBuilderStore((s) => s.strategy);
  const patch = useBuilderStore((s) => s.patchStrategy);
  const { allCandle, fullIndicators, wrapOnChange } = useConditionMetrics();

  return (
    <>
      <FormField
        label="Strategy name"
        hint="Internal label — used as `name` in strategy.json."
      >
        <Input
          value={strategy.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Entry Strategy 1"
        />
      </FormField>

      {strategy.indicators.length > 0 ? (
        <FormField
          label="Indicators"
          hint="Click the settings icon on any chip to tune its parameters."
        >
          <div className="flex flex-wrap items-center gap-2">
            {strategy.indicators.map((ind) => (
              <IndicatorChip
                key={ind.id}
                item={ind}
                onChange={(next) =>
                  patch({
                    indicators: strategy.indicators.map((i) =>
                      i.id === next.id ? next : i,
                    ),
                  })
                }
                onRemove={() =>
                  patch({
                    indicators: strategy.indicators.filter(
                      (i) => i.id !== ind.id,
                    ),
                  })
                }
              />
            ))}
          </div>
        </FormField>
      ) : null}

      <ConditionBuilder
        group={strategy.entryConditions}
        indicators={fullIndicators}
        candlestickChannels={[...allCandle]}
        onChange={wrapOnChange((g) => patch({ entryConditions: g }))}
      />
    </>
  );
}
