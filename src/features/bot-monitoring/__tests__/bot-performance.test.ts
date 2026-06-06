import { describe, it, expect } from 'vitest';
import { parseBotPerformance } from '../bot-performance';

describe('parseBotPerformance', () => {
  it('reads balance + open trades from observed keys', () => {
    const p = parseBotPerformance({ balance: 967.9355, open_trades: 1 });
    expect(p.balance).toBe(967.9355);
    expect(p.openTrades).toBe(1);
  });

  it('accepts alternate key spellings', () => {
    const p = parseBotPerformance({
      wallet_balance: 500,
      open_trades_count: 2,
    });
    expect(p.balance).toBe(500);
    expect(p.openTrades).toBe(2);
  });

  it('returns null for missing fields, never throws', () => {
    const p = parseBotPerformance({ balance: 100 });
    expect(p.balance).toBe(100);
    expect(p.openTrades).toBeNull();
  });

  it('handles non-object input defensively', () => {
    expect(parseBotPerformance(null).balance).toBeNull();
    expect(parseBotPerformance('oops').openTrades).toBeNull();
  });
});
