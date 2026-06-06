import { describe, it, expect } from 'vitest';
import { computePortfolioStats } from '../portfolio-stats';

const bots = [
  { id: 1, mode: 'DRY-RUN' as const },
  { id: 2, mode: 'LIVE' as const },
  { id: 3, mode: 'PAUSED' as const },
  { id: 4, mode: 'ERROR' as const },
  { id: 5, mode: 'STARTING' as const },
];
const perf = new Map([
  [1, { balance: 967.94, openTrades: 1 }],
  [2, { balance: 4820.11, openTrades: 2 }],
]);

describe('computePortfolioStats', () => {
  it('sums balance + open trades of running bots only', () => {
    const s = computePortfolioStats(bots, perf);
    expect(s.capitalDeployed).toBeCloseTo(5788.05, 2);
    expect(s.openTrades).toBe(3);
  });
  it('counts modes', () => {
    const s = computePortfolioStats(bots, perf);
    expect(s.total).toBe(5);
    expect(s.active).toBe(2);
    expect(s.transitioning).toBe(1);
    expect(s.idle).toBe(1);
    expect(s.error).toBe(1);
  });
  it('handles empty', () => {
    const s = computePortfolioStats([], new Map());
    expect(s.total).toBe(0);
    expect(s.capitalDeployed).toBe(0);
  });
});
