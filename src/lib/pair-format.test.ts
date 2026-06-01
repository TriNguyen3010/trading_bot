import { describe, expect, it } from 'vitest';
import { deriveStakeCurrency, uiPairToJson, parseUiPair } from './pair-format';

describe('deriveStakeCurrency', () => {
  it('returns the pair quote when it is a supported stake currency', () => {
    expect(deriveStakeCurrency('BTC-USDC', 'USDT')).toBe('USDC');
    expect(deriveStakeCurrency('ETH-USDT', 'USDC')).toBe('USDT');
  });

  it('is case-insensitive on the pair input', () => {
    expect(deriveStakeCurrency('btc-usdc', 'USDT')).toBe('USDC');
  });

  it('keeps the current stake currency when the quote is unsupported', () => {
    expect(deriveStakeCurrency('BTC-DOGE', 'USDT')).toBe('USDT');
  });

  it('keeps the current stake currency for a malformed pair', () => {
    expect(deriveStakeCurrency('BTC', 'USDT')).toBe('USDT');
    expect(deriveStakeCurrency('', 'USDC')).toBe('USDC');
  });
});

// Sanity that the existing converters still behave (no regression).
describe('uiPairToJson (existing behaviour)', () => {
  it('builds the BASE/QUOTE:SETTLE form for futures', () => {
    expect(uiPairToJson('BTC-USDC', 'futures')).toBe('BTC/USDC:USDC');
    expect(parseUiPair('BTC-USDC')).toEqual({ base: 'BTC', quote: 'USDC' });
  });
});
