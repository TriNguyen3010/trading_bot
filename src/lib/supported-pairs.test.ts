import { describe, it, expect } from 'vitest';
import {
  HYPERLIQUID_TOKENS,
  SUPPORTED_PAIRS,
  normalizePairInput,
} from './supported-pairs';

describe('supported-pairs', () => {
  it('lists the 100 Hyperliquid tokens from the BE CSV', () => {
    expect(HYPERLIQUID_TOKENS).toHaveLength(100);
    expect(HYPERLIQUID_TOKENS[0]).toBe('BTC');
    expect(HYPERLIQUID_TOKENS).toContain('kPEPE');
    expect(HYPERLIQUID_TOKENS).toContain('ICP'); // last
  });

  it('exposes USDC-quoted UI pairs (Hyperliquid settles USDC)', () => {
    expect(SUPPORTED_PAIRS).toHaveLength(100);
    expect(SUPPORTED_PAIRS).toContain('BTC-USDC');
    expect(SUPPORTED_PAIRS).toContain('ETH-USDC');
    expect(SUPPORTED_PAIRS).toContain('kPEPE-USDC');
    expect(SUPPORTED_PAIRS.every((p) => p.endsWith('-USDC'))).toBe(true);
  });

  it('normalizePairInput uppercases standard tokens + quote', () => {
    expect(normalizePairInput('btc-usdc')).toBe('BTC-USDC');
    expect(normalizePairInput('eth-USDC')).toBe('ETH-USDC');
  });

  it('normalizePairInput preserves canonical case of special tokens (kPEPE)', () => {
    expect(normalizePairInput('kpepe-usdc')).toBe('kPEPE-USDC');
    expect(normalizePairInput('KPEPE-USDC')).toBe('kPEPE-USDC');
  });

  it('normalizePairInput uppercases unknown tokens (still usable)', () => {
    expect(normalizePairInput('foo-usdc')).toBe('FOO-USDC');
  });
});
