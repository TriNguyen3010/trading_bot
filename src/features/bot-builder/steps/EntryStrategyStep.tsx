import { useBuilderStore } from '../store/builder.store';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { CANDLESTICK_OPTIONS } from '@/lib/constants';
import { IndicatorPicker } from '@/features/indicators/IndicatorPicker';
import { IndicatorChip } from '@/features/indicators/IndicatorChip';
import { ConditionBuilder } from '@/features/conditions/ConditionBuilder';
import { makeIndicator } from '@/features/indicators/indicator-registry';
import type { Candlestick } from '@/types/builder.types';

export function EntryStrategySetup() {
  const strategy = useBuilderStore((s) => s.strategy);
  const patch = useBuilderStore((s) => s.patchStrategy);

  const toggleCandle = (c: Candlestick) => {
    const has = strategy.candlestick.includes(c);
    patch({
      candlestick: has
        ? strategy.candlestick.filter((x) => x !== c)
        : [...strategy.candlestick, c],
    });
  };

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

      <FormField
        label="Candlestick price data"
        hint="Channels exposed to your conditions and indicators."
      >
        <div className="flex flex-wrap gap-2">
          {CANDLESTICK_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              selected={strategy.candlestick.includes(opt.value)}
              onClick={() => toggleCandle(opt.value)}
            >
              {opt.label}
            </Chip>
          ))}
        </div>
      </FormField>

      <FormField label="Indicators">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {strategy.indicators.length === 0 ? (
              <p className="text-xs text-fg-muted">
                No indicators yet. Add RSI, MA, MACD, Bollinger Bands, ATR or
                Stochastic to use them in entry conditions.
              </p>
            ) : (
              strategy.indicators.map((ind) => (
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
                      indicators: strategy.indicators.filter((i) => i.id !== ind.id),
                    })
                  }
                />
              ))
            )}
          </div>
          <div>
            <IndicatorPicker
              onPick={(name) =>
                patch({
                  indicators: [...strategy.indicators, makeIndicator(name)],
                })
              }
            />
          </div>
        </div>
      </FormField>

      <ConditionBuilder
        group={strategy.entryConditions}
        indicators={strategy.indicators}
        candlestickChannels={strategy.candlestick}
        onChange={(g) => patch({ entryConditions: g })}
      />
    </>
  );
}
