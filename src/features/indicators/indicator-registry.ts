import type { IndicatorItem } from '@/types/builder.types';
import {
  INDICATOR_WHITELIST,
  type WhitelistIndicator,
  type WhitelistParam,
} from './indicator-whitelist';

export type IndicatorCategory =
  | 'Momentum'
  | 'Trend'
  | 'Volatility'
  | 'Volume'
  | 'Overlay';

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
  name: string; // canonical name used in JSON, e.g. "RSI", "BBANDS"
  type: 'talib' | 'pandas_ta' | 'custom';
  category: IndicatorCategory;
  description: string;
  /** Output channels (e.g. BBANDS → upperband/middleband/lowerband). */
  outputs: string[];
  /** pandas_ta function name (only for type 'pandas_ta'). */
  pandasTaFunc?: string;
  /** VWAP needs a datetime index. */
  requiresDatetimeIndex?: boolean;
  /** Output id used for condition `left`/`right_indicator` (e.g. `RSI-14`). */
  buildId: (parameters: Record<string, number | string>) => string;
  parameters: IndicatorParam[];
}

function toParam(p: WhitelistParam): IndicatorParam {
  return {
    key: p.name,
    label: p.display_name,
    type: 'number',
    default: p.default,
    min: p.min,
    max: p.max,
    step: p.type === 'float' ? 0.1 : 1,
  };
}

function makeBuildId(ind: WhitelistIndicator): IndicatorDefinition['buildId'] {
  return (params) => {
    const nums = ind.parameters
      .map((p) => params[p.name] ?? p.default)
      .filter((v): v is number => typeof v === 'number');
    return nums.length ? `${ind.id}-${nums.join('-')}` : ind.id;
  };
}

function toDefinition(ind: WhitelistIndicator): IndicatorDefinition {
  return {
    name: ind.id,
    type: ind.type,
    category: ind.category as IndicatorCategory,
    description: ind.display_name,
    outputs: ind.outputs,
    pandasTaFunc: ind.pandas_ta_func,
    requiresDatetimeIndex: ind.requires_datetime_index,
    buildId: makeBuildId(ind),
    parameters: ind.parameters.map(toParam),
  };
}

export const INDICATOR_REGISTRY: Record<string, IndicatorDefinition> =
  Object.fromEntries(
    INDICATOR_WHITELIST.map((ind) => [ind.id, toDefinition(ind)]),
  );

export function indicatorDefaultParams(
  name: string,
): Record<string, number | string> {
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

export function isMultiOutput(name: string): boolean {
  return (INDICATOR_REGISTRY[name]?.outputs.length ?? 0) > 1;
}

export function indicatorOutputId(item: IndicatorItem): string {
  const def = INDICATOR_REGISTRY[item.name];
  if (!def) return item.name;
  const base = def.buildId(item.parameters);
  if (def.outputs.length <= 1) return base;
  const output = item.output ?? def.outputs[0];
  return `${base}.${output}`;
}
