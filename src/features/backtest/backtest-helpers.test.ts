import { describe, it, expect } from 'vitest';
import {
  presetToTimerange,
  isBacktestTerminal,
  extractMetrics,
  formatWinRate,
  formatTotalProfit,
  quoteCurrencyFromPair,
} from './backtest-helpers';
import type { BacktestHistoryItem } from '@/types/api-helpers';

describe('presetToTimerange', () => {
  it('formats N-day window as YYYYMMDD-YYYYMMDD (UTC)', () => {
    const now = new Date('2026-05-21T00:00:00Z');
    expect(presetToTimerange(7, now)).toBe('20260514-20260521');
  });
  it('handles 1-day window', () => {
    const now = new Date('2026-05-21T00:00:00Z');
    expect(presetToTimerange(1, now)).toBe('20260520-20260521');
  });
});

describe('isBacktestTerminal', () => {
  it('terminal when completed_at is set', () => {
    expect(
      isBacktestTerminal({
        status: 'running',
        completed_at: '2026-05-21T01:00:00Z',
      }),
    ).toBe(true);
  });
  it('terminal when status reads as failure', () => {
    expect(isBacktestTerminal({ status: 'failed', completed_at: null })).toBe(
      true,
    );
    expect(isBacktestTerminal({ status: 'ERROR', completed_at: null })).toBe(
      true,
    );
  });
  it('not terminal while running', () => {
    expect(isBacktestTerminal({ status: 'running', completed_at: null })).toBe(
      false,
    );
    expect(
      isBacktestTerminal({ status: 'pending', completed_at: undefined }),
    ).toBe(false);
  });
});

describe('formatWinRate', () => {
  it('treats <=1 as a fraction', () => {
    expect(formatWinRate(0.617)).toBe('61.7%');
  });
  it('treats >1 as already a percentage', () => {
    expect(formatWinRate(61.7)).toBe('61.7%');
  });
  it('renders dash for null', () => {
    expect(formatWinRate(null)).toBe('—');
  });
});

describe('formatTotalProfit', () => {
  it('renders absolute amount with sign + stake currency', () => {
    expect(formatTotalProfit(12.4)).toBe('+12.40 USDT');
    expect(formatTotalProfit(-36.5898)).toBe('-36.59 USDT');
  });
  it('uses provided stake currency', () => {
    expect(formatTotalProfit(100, 'USDC')).toBe('+100.00 USDC');
  });
  it('renders dash for null', () => {
    expect(formatTotalProfit(null)).toBe('—');
  });
});

describe('quoteCurrencyFromPair', () => {
  it('reads the settle currency of a Freqtrade futures pair (BASE/QUOTE:SETTLE)', () => {
    expect(quoteCurrencyFromPair('ETH/USDC:USDC')).toBe('USDC');
  });
  it('reads the quote of a dash pair (BASE-QUOTE)', () => {
    expect(quoteCurrencyFromPair('ETH-USDC')).toBe('USDC');
  });
  it('reads the quote of a slash pair (BASE/QUOTE)', () => {
    expect(quoteCurrencyFromPair('BTC/USDT')).toBe('USDT');
  });
  it('falls back to USDT when the pair is empty or unparseable', () => {
    expect(quoteCurrencyFromPair('')).toBe('USDT');
    expect(quoteCurrencyFromPair(null)).toBe('USDT');
    expect(quoteCurrencyFromPair('BTC')).toBe('USDT');
  });
});

describe('extractMetrics', () => {
  // Fixture mirrors real sample BE/backtest_200.json (top-level absolute USDT
  // + win_rate percentage 0-100, results.strategy_comparison[0] with the rich
  // metrics from Freqtrade).
  const base: BacktestHistoryItem = {
    id: 1,
    bot_id: 42,
    user_id: 7,
    strategy_name: 'Gamma',
    timeframe: '5m',
    timerange: '20260514-20260521',
    status: 'completed',
    trade_count: 104,
    total_profit: -36.5898, // absolute USDT (= profit_total_abs rounded)
    win_rate: 44.23, // percentage 0-100
    started_at: '2026-05-21T00:00:00Z',
    completed_at: '2026-05-21T00:01:00Z',
    results: {
      strategy: { Gamma: {} },
      strategy_comparison: [
        {
          key: 'Gamma',
          trades: 104,
          profit_total_abs: -36.58987438,
          profit_total_pct: -3.66,
          duration_avg: '5:58:00',
          winrate: 0.4423,
          sharpe: -3.4213,
          sortino: -5.0828,
          calmar: -24.4582,
          profit_factor: 0.8697,
          max_drawdown_account: 0.0953,
          max_drawdown_abs: '96.933',
        },
      ],
    },
  };

  it('reads typed top-level fields', () => {
    const m = extractMetrics(base);
    expect(m.trades).toBe(104);
    expect(m.totalProfit).toBe(-36.5898);
    expect(m.winRate).toBe(44.23);
  });
  it('reads rich metrics from results.strategy_comparison[0]', () => {
    const m = extractMetrics(base);
    expect(m.sharpe).toBeCloseTo(-3.4213);
    expect(m.maxDrawdownPct).toBeCloseTo(9.53); // 0.0953 ratio × 100
    expect(m.avgTrade).toBe('5:58:00');
  });
  it('returns nulls when results is missing', () => {
    const m = extractMetrics({ ...base, results: null });
    expect(m.sharpe).toBeNull();
    expect(m.maxDrawdownPct).toBeNull();
    expect(m.avgTrade).toBeNull();
  });
  it('returns nulls when strategy_comparison is empty array', () => {
    const m = extractMetrics({
      ...base,
      results: { strategy: {}, strategy_comparison: [] },
    });
    expect(m.sharpe).toBeNull();
  });
});
