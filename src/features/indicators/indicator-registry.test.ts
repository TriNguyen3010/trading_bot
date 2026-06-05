import { describe, expect, it } from 'vitest';
import {
  INDICATOR_REGISTRY,
  makeIndicator,
  indicatorOutputId,
} from './indicator-registry';

describe('INDICATOR_REGISTRY (from whitelist)', () => {
  it('contains the 14 whitelist names and none of the removed ones', () => {
    expect(Object.keys(INDICATOR_REGISTRY)).toContain('BBANDS');
    expect(Object.keys(INDICATOR_REGISTRY)).toContain('SMA');
    expect(Object.keys(INDICATOR_REGISTRY)).toContain('EMA');
    expect(Object.keys(INDICATOR_REGISTRY)).toContain('STOCH');
    expect(INDICATOR_REGISTRY).not.toHaveProperty('BB');
    expect(INDICATOR_REGISTRY).not.toHaveProperty('MA');
    expect(INDICATOR_REGISTRY).not.toHaveProperty('ATR');
    expect(INDICATOR_REGISTRY).not.toHaveProperty('Stochastic');
  });

  it('SMA has a single timeperiod param defaulting to 20', () => {
    const def = INDICATOR_REGISTRY.SMA;
    expect(def.parameters.map((p) => p.key)).toEqual(['timeperiod']);
    expect(def.parameters[0].default).toBe(20);
  });

  it('carries outputs + pandas_ta metadata for later phases', () => {
    expect(INDICATOR_REGISTRY.BBANDS.outputs).toEqual([
      'upperband',
      'middleband',
      'lowerband',
    ]);
    expect(INDICATOR_REGISTRY.VWAP.type).toBe('pandas_ta');
    expect(INDICATOR_REGISTRY.VWAP.pandasTaFunc).toBe('vwap');
    expect(INDICATOR_REGISTRY.VWAP.requiresDatetimeIndex).toBe(true);
  });

  it('buildId preserves the legacy single-period id format', () => {
    expect(indicatorOutputId(makeIndicator('RSI'))).toBe('RSI-14');
    expect(indicatorOutputId(makeIndicator('SMA'))).toBe('SMA-20');
    expect(indicatorOutputId(makeIndicator('OBV'))).toBe('OBV');
  });
});
