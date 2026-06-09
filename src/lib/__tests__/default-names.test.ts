import { describe, it, expect } from 'vitest';
import {
  defaultNameSuffix,
  makeDefaultNames,
  withUniqueSuffix,
} from '../default-names';

describe('default-names', () => {
  const now = new Date(2026, 5, 9, 15, 30, 45); // minute=30, second=45

  it('builds the suffix from the wallet last-3 (lowercased) + mmss', () => {
    expect(defaultNameSuffix('0x12abcDEF', now)).toBe('def_3045');
  });

  it('zero-pads minutes and seconds', () => {
    const t = new Date(2026, 0, 1, 9, 3, 5); // minute=03, second=05
    expect(defaultNameSuffix('0xAAB', t)).toBe('aab_0305');
  });

  it('falls back to 3 random chars (same shape) when no wallet', () => {
    const s = defaultNameSuffix(null, now);
    expect(s).toMatch(/^[a-z0-9]{3}_3045$/);
  });

  it('withUniqueSuffix appends the suffix to any base name', () => {
    expect(withUniqueSuffix('RSI Oversold ETH', 'b3f_3045')).toBe(
      'RSI Oversold ETH_b3f_3045',
    );
  });

  it('makeDefaultNames keeps the base and appends the shared suffix', () => {
    const { botName, strategyName } = makeDefaultNames('0xWALLETb3f', now);
    expect(botName).toBe('Bot Basic_b3f_3045');
    expect(strategyName).toBe('Entry Strategy_b3f_3045');
  });
});
