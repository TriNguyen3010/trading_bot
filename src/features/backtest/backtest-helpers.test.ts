import { describe, it, expect } from 'vitest';
import {
  presetToTimerange,
  isBacktestTerminal,
  isBacktestFailed,
  extractMetrics,
  formatWinRate,
  formatTotalProfit,
  quoteCurrencyFromPair,
  extractTrades,
  formatTradeDuration,
  formatTradeTime,
} from './backtest-helpers';
import type { BacktestHistoryItem } from '@/types/api-helpers';

// Minimal trade fixture matching real backtest_200.json fields
const TRADE_FIXTURE = {
  pair: 'BTC/USDC:USDC',
  open_timestamp: 1777251300000,
  close_timestamp: 1777272900000,
  open_rate: 78938.0,
  close_rate: 79088.0,
  profit_abs: 0.97893036,
  profit_ratio: 0.009791214945164765,
  exit_reason: 'duration_6.0_hours',
  enter_tag: 'ui_enter_long',
  trade_duration: 360,
  is_short: false,
  leverage: 10,
};

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

describe('isBacktestFailed', () => {
  it('true when status reads as failed/error (not cancel)', () => {
    expect(isBacktestFailed({ status: 'failed' })).toBe(true);
    expect(isBacktestFailed({ status: 'ERROR' })).toBe(true);
    expect(isBacktestFailed({ status: 'cancelled' })).toBe(false);
  });
  it('false for a normal completed/running run', () => {
    expect(isBacktestFailed({ status: 'completed' })).toBe(false);
    expect(isBacktestFailed({ status: 'running' })).toBe(false);
    expect(isBacktestFailed({ status: null })).toBe(false);
  });
});

describe('formatWinRate', () => {
  it('renders the 0-100 percentage directly', () => {
    expect(formatWinRate(61.7)).toBe('61.7%');
    expect(formatWinRate(44.23)).toBe('44.2%');
  });
  it('does NOT inflate a legit low win-rate (1.0 = 1%, not 100%)', () => {
    expect(formatWinRate(1)).toBe('1.0%');
    expect(formatWinRate(0.5)).toBe('0.5%');
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

describe('extractTrades', () => {
  const base: BacktestHistoryItem = {
    id: 200,
    bot_id: 86,
    user_id: 10,
    strategy_name: 'Gamma',
    timeframe: '5m',
    timerange: '20260427-20260527',
    status: 'completed',
    trade_count: 104,
    total_profit: -36.5898,
    win_rate: 44.23,
    started_at: '2026-05-27T07:27:25.027324',
    completed_at: '2026-05-27T07:28:05.224419',
    results: {
      strategy: { Gamma: { trades: [TRADE_FIXTURE] } },
      strategy_comparison: [],
    },
  };

  it('returns trades array for the named strategy', () => {
    const trades = extractTrades(base);
    expect(trades).toHaveLength(1);
    expect(trades[0].open_rate).toBe(78938.0);
    expect(trades[0].profit_abs).toBeCloseTo(0.97893036);
  });
  it('falls back to first key when strategy_name does not match', () => {
    const item = { ...base, strategy_name: 'Unknown' };
    expect(extractTrades(item)).toHaveLength(1);
  });
  it('returns [] when results is null', () => {
    expect(extractTrades({ ...base, results: null })).toEqual([]);
  });
  it('returns [] when results.strategy is missing', () => {
    expect(extractTrades({ ...base, results: {} })).toEqual([]);
  });
  it('returns [] when trades array is empty', () => {
    const item = {
      ...base,
      results: { strategy: { Gamma: { trades: [] } } },
    };
    expect(extractTrades(item)).toEqual([]);
  });
  it('returns [] when trades field is not an array', () => {
    const item = {
      ...base,
      results: { strategy: { Gamma: { trades: null } } },
    };
    expect(extractTrades(item)).toEqual([]);
  });
  it('coerces a trade with missing/non-number numeric fields (no render crash)', () => {
    const item = {
      ...base,
      results: {
        strategy: { Gamma: { trades: [{ pair: 'BTC/USDC' }] } },
      },
    } as unknown as BacktestHistoryItem;
    const trades = extractTrades(item);
    expect(trades).toHaveLength(1);
    expect(trades[0].profit_abs).toBe(0);
    expect(trades[0].profit_ratio).toBe(0);
    // The table calls .toFixed on these — must not throw.
    expect(() => trades[0].profit_abs.toFixed(2)).not.toThrow();
  });
});

describe('formatTradeDuration', () => {
  it('formats minutes < 60 as "Xm"', () => {
    expect(formatTradeDuration(45)).toBe('45m');
  });
  it('formats exactly 60 minutes as "1h 0m"', () => {
    expect(formatTradeDuration(60)).toBe('1h 0m');
  });
  it('formats 360 minutes (6h) as "6h 0m"', () => {
    expect(formatTradeDuration(360)).toBe('6h 0m');
  });
  it('formats 125 minutes as "2h 5m"', () => {
    expect(formatTradeDuration(125)).toBe('2h 5m');
  });
  it('formats 1440 minutes (1 day) as "1d 0h"', () => {
    expect(formatTradeDuration(1440)).toBe('1d 0h');
  });
  it('formats 2955 minutes as "2d 1h"', () => {
    // 2955 / 1440 = 2d remainder 75min = 1h 15m → "2d 1h"
    expect(formatTradeDuration(2955)).toBe('2d 1h');
  });
  it('formats 0 minutes as "0m"', () => {
    expect(formatTradeDuration(0)).toBe('0m');
  });
});

describe('formatTradeTime', () => {
  it('formats epoch ms to "MMM DD HH:MM" in UTC', () => {
    // 1777251300000 = 2026-04-27 00:55:00 UTC (confirmed from backtest_200.json open_date)
    expect(formatTradeTime(1777251300000)).toBe('Apr 27 00:55');
  });
  it('formats close_timestamp correctly', () => {
    // 1777272900000 = 2026-04-27 06:55:00 UTC
    expect(formatTradeTime(1777272900000)).toBe('Apr 27 06:55');
  });
});
