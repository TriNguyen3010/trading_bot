import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { indicatorOutputId } from '@/features/indicators/indicator-registry';
import { useConditionMetrics } from './useConditionMetrics';
import { emptyConditionTree } from '@/lib/condition-tree';
import type { ConditionRule, ConditionTree } from '@/types/builder.types';

function tree(rules: ConditionRule[]): ConditionTree {
  if (rules.length === 0) return emptyConditionTree();
  return {
    groupConnector: 'AND',
    groups: [{ id: 'g1', intraConnector: 'AND', rules }],
  };
}

describe('useConditionMetrics', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
  });

  it('exposes all 5 candle channels', () => {
    const { result } = renderHook(() => useConditionMetrics());
    expect(result.current.allCandle).toEqual([
      'open',
      'close',
      'high',
      'low',
      'volume',
    ]);
  });

  it('exposes the whitelist registry indicators with default params', () => {
    const { result } = renderHook(() => useConditionMetrics());
    const ids = result.current.fullIndicators.map(indicatorOutputId).sort();
    expect(ids).toContain('RSI-14');
    expect(ids).toContain('SMA-20');
    expect(ids).toContain('BBANDS-20-2-2');
    expect(ids).toContain('EMA-20');
    expect(ids.some((id) => id.startsWith('STOCH-'))).toBe(true);
    expect(ids.some((id) => id.startsWith('MACD-'))).toBe(true);
  });

  it('merges custom-param indicators from state, preferring state version', () => {
    // Simulate a template that set SMA period 12 instead of default 20
    useBuilderStore.setState((s) => ({
      strategy: {
        ...s.strategy,
        indicators: [
          {
            id: 'ma-template',
            name: 'SMA',
            type: 'talib' as const,
            parameters: { timeperiod: 12 },
          },
        ],
      },
    }));

    const { result } = renderHook(() => useConditionMetrics());
    const ids = result.current.fullIndicators.map(indicatorOutputId);
    expect(ids).toContain('SMA-12'); // from state
    expect(ids).toContain('SMA-20'); // from registry default (coexists)
  });

  it('wrapOnChange auto-adds candle channel when condition references unselected candle', () => {
    const calls: ConditionTree[] = [];
    const { result } = renderHook(() => useConditionMetrics());

    const wrapped = result.current.wrapOnChange((t) => calls.push(t));
    const newTree = tree([
      {
        id: 'c1',
        left: 'candle.close',
        op: '>',
        right_type: 'number',
        right_number: 0,
        right_indicator: null,
        lookback: 0,
      },
    ]);
    wrapped(newTree);

    // onChange forwarded
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(newTree);
    // state patched
    expect(useBuilderStore.getState().strategy.candlestick).toContain('close');
  });

  it('wrapOnChange auto-adds indicator when condition references unselected indicator', () => {
    const { result } = renderHook(() => useConditionMetrics());
    const wrapped = result.current.wrapOnChange(() => {});

    const t = tree([
      {
        id: 'c1',
        left: 'RSI-14',
        op: '<',
        right_type: 'number',
        right_number: 30,
        right_indicator: null,
        lookback: 0,
      },
    ]);
    wrapped(t);

    const indicators = useBuilderStore.getState().strategy.indicators;
    const rsi = indicators.find((i) => indicatorOutputId(i) === 'RSI-14');
    expect(rsi).toBeDefined();
    expect(rsi?.parameters).toMatchObject({ timeperiod: 14 });
  });

  it('wrapOnChange auto-adds right-side indicator when right_type is indicator', () => {
    const { result } = renderHook(() => useConditionMetrics());
    const wrapped = result.current.wrapOnChange(() => {});

    const t = tree([
      {
        id: 'c1',
        left: 'candle.close',
        op: 'crosses_above',
        right_type: 'indicator',
        right_number: null,
        right_indicator: 'SMA-20',
        lookback: 0,
      },
    ]);
    wrapped(t);

    const indicators = useBuilderStore.getState().strategy.indicators;
    expect(indicators.some((i) => indicatorOutputId(i) === 'SMA-20')).toBe(
      true,
    );
    expect(useBuilderStore.getState().strategy.candlestick).toContain('close');
  });

  it('wrapOnChange does NOT re-add metric already in state (idempotent)', () => {
    useBuilderStore.setState((s) => ({
      strategy: {
        ...s.strategy,
        candlestick: ['close'],
        indicators: [
          {
            id: 'rsi-1',
            name: 'RSI',
            type: 'talib' as const,
            parameters: { timeperiod: 14 },
          },
        ],
      },
    }));

    const { result } = renderHook(() => useConditionMetrics());
    const wrapped = result.current.wrapOnChange(() => {});
    const t = tree([
      {
        id: 'c1',
        left: 'candle.close',
        op: '<',
        right_type: 'indicator',
        right_number: null,
        right_indicator: 'RSI-14',
        lookback: 0,
      },
    ]);
    wrapped(t);

    expect(useBuilderStore.getState().strategy.candlestick).toEqual(['close']);
    expect(useBuilderStore.getState().strategy.indicators).toHaveLength(1);
  });

  it('wrapOnChange does NOT remove un-referenced metrics (additive only)', () => {
    useBuilderStore.setState((s) => ({
      strategy: {
        ...s.strategy,
        candlestick: ['open', 'close'],
        indicators: [
          {
            id: 'rsi-1',
            name: 'RSI',
            type: 'talib' as const,
            parameters: { timeperiod: 14 },
          },
        ],
      },
    }));

    const { result } = renderHook(() => useConditionMetrics());
    const wrapped = result.current.wrapOnChange(() => {});
    // Empty tree → no references
    wrapped(emptyConditionTree());

    expect(useBuilderStore.getState().strategy.candlestick).toEqual([
      'open',
      'close',
    ]);
    expect(useBuilderStore.getState().strategy.indicators).toHaveLength(1);
  });
});
