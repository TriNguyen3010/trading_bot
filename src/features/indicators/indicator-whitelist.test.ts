import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INDICATOR_WHITELIST } from './indicator-whitelist';

describe('indicator whitelist', () => {
  it('matches the BE source-of-truth file (no drift)', () => {
    const be = JSON.parse(
      readFileSync('BE/source-of-truth/indicator_whitelist.json', 'utf-8'),
    );
    expect(INDICATOR_WHITELIST).toEqual(be.indicators);
  });

  it('exposes the 14 expected indicator ids', () => {
    expect(INDICATOR_WHITELIST.map((i) => i.id)).toEqual([
      'RSI',
      'SMA',
      'EMA',
      'MACD',
      'ADX',
      'BBANDS',
      'STOCH',
      'OBV',
      'STOCHRSI',
      'SAR',
      'SUPERTREND',
      'VWAP',
      'CHANDELIER_EXIT',
      'NATR',
    ]);
  });
});
