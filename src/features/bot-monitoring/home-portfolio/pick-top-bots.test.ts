import { describe, it, expect } from 'vitest';
import { pickTopBots } from './pick-top-bots';
import type { DashboardBot } from '../bot-list.helpers';
import type { BotPerformance } from '../bot-performance';

function bot(id: number, mode: DashboardBot['mode']): DashboardBot {
  return {
    id,
    name: `Bot ${id}`,
    pair: 'ETH-USDC',
    timeframe: '5m',
    strategyName: null,
    uptime: null,
    mode,
    dryRun: mode === 'DRY-RUN',
    createdAt: null,
    leverage: null,
    stakeAmount: null,
    maxOpenTrades: null,
    tradingMode: null,
    errorMsg: null,
    pnl: null,
    pnlPct: null,
    pnlDirection: 'flat',
    trades: null,
    winRate: null,
    sharpe: null,
    sparkline: null,
    isDemo: false,
  };
}

describe('pickTopBots', () => {
  it('puts running bots first, sorted by balance desc', () => {
    const bots = [bot(1, 'PAUSED'), bot(2, 'LIVE'), bot(3, 'DRY-RUN')];
    const perf = new Map<number, BotPerformance>([
      [2, { balance: 100, openTrades: 0 }],
      [3, { balance: 500, openTrades: 0 }],
    ]);
    expect(pickTopBots(bots, perf, 3).map((b) => b.id)).toEqual([3, 2, 1]);
  });

  it('caps the result length', () => {
    const bots = [
      bot(1, 'LIVE'),
      bot(2, 'LIVE'),
      bot(3, 'LIVE'),
      bot(4, 'LIVE'),
    ];
    expect(pickTopBots(bots, new Map(), 3)).toHaveLength(3);
  });

  it('returns [] for no bots', () => {
    expect(pickTopBots([], new Map(), 3)).toEqual([]);
  });
});
