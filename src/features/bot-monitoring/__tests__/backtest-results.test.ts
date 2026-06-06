import { describe, it, expect } from 'vitest';
import {
  extractStrategyBlock,
  buildEquityCurve,
  extractBacktestMetrics,
  extractExitReasons,
} from '../backtest-results';

const ITEM = {
  strategy_name: 'Gamma',
  results: {
    strategy: {
      Gamma: {
        trades: [
          { profit_abs: 0.979, close_timestamp: 30 },
          { profit_abs: -3.571, close_timestamp: 10 },
          { profit_abs: 2.0, close_timestamp: 20 },
        ],
        total_trades: 104,
        profit_total_abs: -36.59,
        profit_total: -0.0366,
        trade_count_long: 51,
        trade_count_short: 53,
        sharpe: -3.42,
        sortino: -5.08,
        profit_factor: 0.87,
        expectancy: -0.35,
        trades_per_day: 3.47,
        avg_stake_amount: 99.96,
        total_volume: 208020,
        market_change: -0.0367,
        // Whole-strategy aggregates (top-level) — what the UI must read.
        winrate: 0.4423,
        wins: 46,
        losses: 58,
        max_drawdown_abs: 96.93,
        max_drawdown_account: 0.0953,
        // best_pair carries DECOY numbers for one pair only — must NOT be read.
        best_pair: {
          winrate: 0.99,
          wins: 1,
          losses: 0,
          max_drawdown_abs: 5,
          max_drawdown_account: 0.005,
        },
        exit_reason_summary: [
          { key: 'exit_signal', trades: 1, profit_total_abs: 14.99 },
          { key: 'duration_6.0_hours', trades: 103, profit_total_abs: -51.58 },
          { key: 'TOTAL', trades: 104, profit_total_abs: -36.59 },
        ],
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe('backtest-results', () => {
  it('extracts the strategy block by strategy_name', () => {
    expect(extractStrategyBlock(ITEM)?.total_trades).toBe(104);
  });

  it('returns null when results/strategy missing', () => {
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extractStrategyBlock({ strategy_name: 'X', results: null } as any),
    ).toBeNull();
  });

  it('builds a cumulative equity curve sorted by close_timestamp', () => {
    expect(buildEquityCurve(extractStrategyBlock(ITEM)!)).toEqual([
      -3.571, -1.571, -0.592,
    ]);
  });

  it('reads whole-strategy metrics from the block top-level, NOT best_pair', () => {
    const m = extractBacktestMetrics(extractStrategyBlock(ITEM)!);
    expect(m.netAbs).toBe(-36.59);
    expect(m.trades).toBe(104);
    expect(m.sharpe).toBe(-3.42);
    expect(m.profitFactor).toBe(0.87);
    expect(m.longCount).toBe(51);
    expect(m.shortCount).toBe(53);
    // These come from the top-level aggregate (44.23%, 46/58, 96.93 / 9.53%),
    // NOT from best_pair's decoy single-pair values (99%, 1/0, 5 / 0.5%).
    expect(m.winRatePct).toBeCloseTo(44.23, 1);
    expect(m.wins).toBe(46);
    expect(m.losses).toBe(58);
    expect(m.maxDrawdownAbs).toBe(96.93);
    expect(m.maxDrawdownPct).toBeCloseTo(9.53, 1);
  });

  it('extracts exit reasons excluding TOTAL', () => {
    const ex = extractExitReasons(extractStrategyBlock(ITEM)!);
    expect(ex.map((e) => e.key)).toEqual(['exit_signal', 'duration_6.0_hours']);
    expect(ex[0].profitAbs).toBe(14.99);
  });
});
