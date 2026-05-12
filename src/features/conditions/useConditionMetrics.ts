import { useMemo } from 'react';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import {
  INDICATOR_REGISTRY,
  indicatorOutputId,
  makeIndicator,
} from '@/features/indicators/indicator-registry';
import type {
  Candlestick,
  ConditionGroup,
  IndicatorItem,
} from '@/types/builder.types';

const ALL_CANDLE: readonly Candlestick[] = [
  'open',
  'close',
  'high',
  'low',
  'volume',
];

/**
 * Catalog hook for condition rows: returns the full pickable metrics
 * (5 candle channels + all registry indicators with default params,
 * merged with template/import-provided custom-param indicators from
 * state) plus a `wrapOnChange` helper that additively patches newly
 * referenced metrics into `strategy.candlestick` / `strategy.indicators`.
 *
 * Used by both `EntryStrategySetup` (entry conditions) and
 * `IndicatorExitForm` (close-method exit conditions).
 */
export function useConditionMetrics() {
  const strategy = useBuilderStore((s) => s.strategy);
  const patchStrategy = useBuilderStore((s) => s.patchStrategy);

  const fullIndicators = useMemo<IndicatorItem[]>(() => {
    // Defaults from registry (one per name).
    const fromRegistry = Object.keys(INDICATOR_REGISTRY).map((name) =>
      makeIndicator(name),
    );
    // State indicators may have custom params (templates / imports).
    // Merge so both default and custom-param versions appear, dedupe by output id.
    const byId = new Map<string, IndicatorItem>();
    for (const i of fromRegistry) byId.set(indicatorOutputId(i), i);
    for (const i of strategy.indicators) byId.set(indicatorOutputId(i), i);
    return [...byId.values()];
  }, [strategy.indicators]);

  function wrapOnChange(
    onChange: (g: ConditionGroup) => void,
  ): (g: ConditionGroup) => void {
    return (g) => {
      const newCandle = new Set<Candlestick>();
      const newIndicators = new Map<string, IndicatorItem>();

      const considerRef = (ref: string | null) => {
        if (!ref) return;
        if (ref.startsWith('candle.')) {
          const ch = ref.slice('candle.'.length) as Candlestick;
          if (
            (ALL_CANDLE as readonly string[]).includes(ch) &&
            !strategy.candlestick.includes(ch)
          ) {
            newCandle.add(ch);
          }
        } else {
          const already = strategy.indicators.some(
            (i) => indicatorOutputId(i) === ref,
          );
          if (already) return;
          const match = fullIndicators.find(
            (i) => indicatorOutputId(i) === ref,
          );
          if (match) newIndicators.set(ref, match);
        }
      };

      for (const c of g.conditions) {
        considerRef(c.left);
        if (c.right_type === 'indicator') considerRef(c.right_indicator);
      }

      if (newCandle.size > 0 || newIndicators.size > 0) {
        patchStrategy({
          ...(newCandle.size > 0 && {
            candlestick: [...strategy.candlestick, ...newCandle],
          }),
          ...(newIndicators.size > 0 && {
            indicators: [...strategy.indicators, ...newIndicators.values()],
          }),
        });
      }

      onChange(g);
    };
  }

  return {
    allCandle: ALL_CANDLE,
    fullIndicators,
    wrapOnChange,
  };
}
