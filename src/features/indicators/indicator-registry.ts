import type { IndicatorItem } from '@/types/builder.types';

export interface IndicatorParam {
  key: string;
  label: string;
  type: 'number' | 'select';
  default: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  hint?: string;
}

export interface IndicatorDefinition {
  name: string; // canonical name used in JSON, e.g. "RSI"
  type: 'talib' | 'pandas_ta' | 'custom';
  description: string;
  /**
   * Output channel suffix used when computing condition `left` ids.
   * For RSI we output `RSI-{timeperiod}` (e.g. `RSI-14`).
   */
  buildId: (parameters: Record<string, number | string>) => string;
  parameters: IndicatorParam[];
}

export const INDICATOR_REGISTRY: Record<string, IndicatorDefinition> = {
  RSI: {
    name: 'RSI',
    type: 'talib',
    description: 'Relative Strength Index — momentum oscillator (0–100).',
    buildId: (p) => `RSI-${p.timeperiod ?? 14}`,
    parameters: [
      {
        key: 'timeperiod',
        label: 'Time period',
        type: 'number',
        default: 14,
        min: 2,
        max: 200,
        step: 1,
      },
    ],
  },
  MA: {
    name: 'MA',
    type: 'talib',
    description: 'Simple Moving Average — trend following.',
    buildId: (p) => `MA-${p.timeperiod ?? 50}`,
    parameters: [
      {
        key: 'timeperiod',
        label: 'Time period',
        type: 'number',
        default: 50,
        min: 2,
        max: 500,
        step: 1,
      },
      {
        key: 'price',
        label: 'Source',
        type: 'select',
        default: 'close',
        options: [
          { value: 'open', label: 'Open' },
          { value: 'close', label: 'Close' },
          { value: 'high', label: 'High' },
          { value: 'low', label: 'Low' },
        ],
      },
    ],
  },
  MACD: {
    name: 'MACD',
    type: 'talib',
    description: 'Moving Average Convergence Divergence — trend + momentum.',
    buildId: (p) =>
      `MACD-${p.fastperiod ?? 12}-${p.slowperiod ?? 26}-${p.signalperiod ?? 9}`,
    parameters: [
      {
        key: 'fastperiod',
        label: 'Fast period',
        type: 'number',
        default: 12,
        min: 2,
        max: 200,
        step: 1,
      },
      {
        key: 'slowperiod',
        label: 'Slow period',
        type: 'number',
        default: 26,
        min: 2,
        max: 200,
        step: 1,
      },
      {
        key: 'signalperiod',
        label: 'Signal period',
        type: 'number',
        default: 9,
        min: 2,
        max: 200,
        step: 1,
      },
    ],
  },
  BB: {
    name: 'BB',
    type: 'talib',
    description: 'Bollinger Bands — volatility envelope around an SMA.',
    buildId: (p) => `BB-${p.timeperiod ?? 20}`,
    parameters: [
      {
        key: 'timeperiod',
        label: 'Time period',
        type: 'number',
        default: 20,
        min: 2,
        max: 200,
        step: 1,
      },
      {
        key: 'nbdevup',
        label: 'Std dev (upper)',
        type: 'number',
        default: 2,
        min: 0.1,
        max: 10,
        step: 0.1,
      },
      {
        key: 'nbdevdn',
        label: 'Std dev (lower)',
        type: 'number',
        default: 2,
        min: 0.1,
        max: 10,
        step: 0.1,
      },
    ],
  },
  ATR: {
    name: 'ATR',
    type: 'talib',
    description: 'Average True Range — measures volatility.',
    buildId: (p) => `ATR-${p.timeperiod ?? 14}`,
    parameters: [
      {
        key: 'timeperiod',
        label: 'Time period',
        type: 'number',
        default: 14,
        min: 2,
        max: 200,
        step: 1,
      },
    ],
  },
  Stochastic: {
    name: 'Stochastic',
    type: 'talib',
    description: 'Stochastic oscillator — overbought / oversold (%K / %D).',
    buildId: (p) =>
      `Stoch-${p.fastk_period ?? 14}-${p.slowk_period ?? 3}-${p.slowd_period ?? 3}`,
    parameters: [
      {
        key: 'fastk_period',
        label: '%K period',
        type: 'number',
        default: 14,
        min: 2,
        max: 200,
        step: 1,
      },
      {
        key: 'slowk_period',
        label: 'Slow %K',
        type: 'number',
        default: 3,
        min: 1,
        max: 50,
        step: 1,
      },
      {
        key: 'slowd_period',
        label: 'Slow %D',
        type: 'number',
        default: 3,
        min: 1,
        max: 50,
        step: 1,
      },
    ],
  },
};

export function indicatorDefaultParams(name: string): Record<string, number | string> {
  const def = INDICATOR_REGISTRY[name];
  if (!def) return {};
  return Object.fromEntries(def.parameters.map((p) => [p.key, p.default]));
}

export function makeIndicator(name: string): IndicatorItem {
  const def = INDICATOR_REGISTRY[name];
  if (!def) throw new Error(`Unknown indicator: ${name}`);
  const parameters = indicatorDefaultParams(name);
  return {
    id: crypto.randomUUID(),
    name: def.name,
    type: def.type,
    parameters,
  };
}

export function indicatorOutputId(item: IndicatorItem): string {
  const def = INDICATOR_REGISTRY[item.name];
  if (!def) return item.name;
  return def.buildId(item.parameters);
}
