import { useMemo } from 'react';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import {
  INDICATOR_REGISTRY,
  indicatorOutputId,
  makeIndicator,
} from '@/features/indicators/indicator-registry';
import type {
  Candlestick,
  ConditionTree,
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
    // Defaults from registry. Multi-output indicators expand to one item per
    // output so each output is independently pickable. Indicators whose output
    // strings are TEMPLATED (e.g. SUPERTREND `SUPERT_{length}_{multiplier}`)
    // are skipped — their resolved wire format isn't confirmed yet (Phase 2C).
    const fromRegistry: IndicatorItem[] = [];
    for (const name of Object.keys(INDICATOR_REGISTRY)) {
      const def = INDICATOR_REGISTRY[name];
      const base = makeIndicator(name);
      if (def.outputs.length <= 1) {
        fromRegistry.push(base);
      } else if (def.outputs.some((o) => o.includes('{'))) {
        continue; // templated multi-output (SUPERTREND, CHANDELIER_EXIT) — hide
      } else {
        for (const output of def.outputs) {
          fromRegistry.push({ ...base, id: `${base.id}-${output}`, output });
        }
      }
    }
    // State indicators may have custom params (templates / imports).
    // Merge so both default and custom-param versions appear, dedupe by output id.
    const byId = new Map<string, IndicatorItem>();
    for (const i of fromRegistry) byId.set(indicatorOutputId(i), i);
    for (const i of strategy.indicators) byId.set(indicatorOutputId(i), i);
    return [...byId.values()];
  }, [strategy.indicators]);

  function wrapOnChange(
    onChange: (tree: ConditionTree) => void,
  ): (tree: ConditionTree) => void {
    return (tree) => {
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

      for (const group of tree.groups) {
        for (const rule of group.rules) {
          considerRef(rule.left);
          if (rule.right_type === 'indicator') {
            considerRef(rule.right_indicator);
          }
        }
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

      onChange(tree);
    };
  }

  return {
    allCandle: ALL_CANDLE,
    fullIndicators,
    wrapOnChange,
  };
}
