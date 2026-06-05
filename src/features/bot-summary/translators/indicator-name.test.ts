import { describe, expect, it } from 'vitest';
import type { SummaryBlockId } from '../types';
import { translateIndicatorRef } from './indicator-name';

const opts = () => ({
  section: 'entry' as SummaryBlockId,
  field: 'x',
  gaps: [],
});

describe('translateIndicatorRef', () => {
  it('renders new single-output ids', () => {
    expect(translateIndicatorRef('RSI-14', opts())[0].text).toBe('RSI(14)');
    expect(translateIndicatorRef('SMA-50', opts())[0].text).toBe(
      'the 50-period simple moving average',
    );
    expect(translateIndicatorRef('EMA-20', opts())[0].text).toBe(
      'the 20-period exponential moving average',
    );
    expect(translateIndicatorRef('ADX-14', opts())[0].text).toBe('ADX(14)');
  });

  it('renders multi-segment ids by prefix', () => {
    expect(translateIndicatorRef('BBANDS-20-2-2', opts())[0].text).toBe(
      'Bollinger Bands',
    );
    expect(translateIndicatorRef('MACD-12-26-9', opts())[0].text).toBe(
      'MACD line',
    );
    expect(translateIndicatorRef('STOCH-5-3-3', opts())[0].text).toBe(
      'Stochastic %K',
    );
  });
});
