import { describe, it, expect } from 'vitest';
import {
  matchesCategory,
  filterByCategory,
  countByCategory,
  type FilterCategory,
} from '../bot-filter';
import type { BotCardData } from '../BotCard';

const mk = (id: number, state: BotCardData['state']): BotCardData => ({
  id,
  name: `Bot ${id}`,
  pair: 'BTC/USDC',
  timeframe: '1h',
  createdAt: '2026-01-01',
  stakeAmount: 100,
  maxOpenTrades: 5,
  balance: null,
  openTrades: 0,
  mode: 'PAUSED',
  state,
  errorMsg: null,
  lastBacktest: null,
});

const cards: BotCardData[] = [
  mk(1, 'LIVE'),
  mk(2, 'DRY-RUN'),
  mk(3, 'PAUSED'),
  mk(4, 'STARTING'),
  mk(5, 'BACKTESTING'),
  mk(6, 'ERROR'),
  mk(7, 'NEW'),
  mk(8, 'BACKTEST_FAILED'),
];

describe('bot-filter', () => {
  it('matchesCategory maps states to chips', () => {
    expect(matchesCategory('LIVE', 'live')).toBe(true);
    expect(matchesCategory('DRY-RUN', 'dry-run')).toBe(true);
    expect(matchesCategory('STARTING', 'working')).toBe(true);
    expect(matchesCategory('BACKTESTING', 'working')).toBe(true);
    expect(matchesCategory('ERROR', 'attention')).toBe(true);
    expect(matchesCategory('NEW', 'attention')).toBe(true);
    expect(matchesCategory('BACKTEST_FAILED', 'attention')).toBe(true);
    expect(matchesCategory('LIVE', 'all')).toBe(true);
    expect(matchesCategory('LIVE', 'attention')).toBe(false);
  });

  it('filterByCategory returns matching cards', () => {
    expect(filterByCategory(cards, 'all')).toHaveLength(8);
    expect(filterByCategory(cards, 'working').map((c) => c.id)).toEqual([4, 5]);
    expect(filterByCategory(cards, 'attention').map((c) => c.id)).toEqual([
      6, 7, 8,
    ]);
  });

  it('countByCategory tallies every chip', () => {
    const counts = countByCategory(cards);
    expect(counts).toEqual<Record<FilterCategory, number>>({
      all: 8,
      live: 1,
      'dry-run': 1,
      paused: 1,
      working: 2,
      attention: 3,
    });
  });
});
