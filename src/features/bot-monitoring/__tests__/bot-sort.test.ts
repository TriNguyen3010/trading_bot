import { describe, it, expect } from 'vitest';
import { sortCards } from '../bot-sort';
import type { BotCardData } from '../BotCard';

function card(
  p: Partial<BotCardData> & Pick<BotCardData, 'id' | 'state'>,
): BotCardData {
  return {
    id: p.id,
    name: p.name ?? `Bot ${p.id}`,
    pair: 'BTC/USDC',
    timeframe: '1h',
    createdAt: p.createdAt ?? '2026-01-01',
    stakeAmount: 100,
    maxOpenTrades: 5,
    balance: p.balance ?? null,
    openTrades: 0,
    mode: p.mode ?? 'PAUSED',
    state: p.state,
    errorMsg: null,
    lastBacktest: null,
  };
}

describe('sortCards', () => {
  it('orders buckets: needs-attention, working, running, new, idle', () => {
    const input = [
      card({ id: 1, state: 'NEW' }),
      card({ id: 2, state: 'PAUSED' }),
      card({ id: 3, state: 'LIVE', mode: 'LIVE', balance: 100 }),
      card({ id: 4, state: 'BACKTESTING', mode: 'PAUSED', balance: 50 }),
      card({ id: 5, state: 'ERROR', mode: 'ERROR' }),
    ];
    // NEW (1) now sorts before PAUSED (2).
    expect(sortCards(input).map((c) => c.id)).toEqual([5, 4, 3, 1, 2]);
  });

  it('within running: LIVE before DRY-RUN, then balance desc', () => {
    const input = [
      card({ id: 1, state: 'DRY-RUN', mode: 'DRY-RUN', balance: 999 }),
      card({ id: 2, state: 'LIVE', mode: 'LIVE', balance: 10 }),
      card({ id: 3, state: 'LIVE', mode: 'LIVE', balance: 80 }),
    ];
    expect(sortCards(input).map((c) => c.id)).toEqual([3, 2, 1]);
  });

  it('within needs-attention: ERROR before BACKTEST_FAILED', () => {
    const input = [
      card({ id: 1, state: 'BACKTEST_FAILED' }),
      card({ id: 2, state: 'ERROR', mode: 'ERROR' }),
    ];
    expect(sortCards(input).map((c) => c.id)).toEqual([2, 1]);
  });

  it('is stable: equal-bucket equal-key bots keep id-ascending order', () => {
    const input = [
      card({ id: 9, state: 'LIVE', mode: 'LIVE', balance: 100 }),
      card({ id: 4, state: 'LIVE', mode: 'LIVE', balance: 100 }),
    ];
    expect(sortCards(input).map((c) => c.id)).toEqual([4, 9]);
  });

  it('does not mutate the input array', () => {
    const input = [
      card({ id: 1, state: 'LIVE', mode: 'LIVE' }),
      card({ id: 2, state: 'ERROR', mode: 'ERROR' }),
    ];
    const before = input.map((c) => c.id);
    sortCards(input);
    expect(input.map((c) => c.id)).toEqual(before);
  });
});
