import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PerformancePanel } from '../PerformancePanel';

const ITEM = {
  id: 200,
  strategy_name: 'Gamma',
  timerange: '20260427-20260527',
  timeframe: '5m',
  results: {
    strategy: {
      Gamma: {
        trades: [
          { profit_abs: 1, close_timestamp: 1 },
          { profit_abs: -2, close_timestamp: 2 },
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
        winrate: 0.4423,
        wins: 46,
        losses: 58,
        max_drawdown_abs: 96.93,
        max_drawdown_account: 0.0953,
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

describe('PerformancePanel', () => {
  it('renders metrics from the backtest item', () => {
    render(<PerformancePanel item={ITEM} onRunBacktest={vi.fn()} />);
    expect(screen.getByText('104')).toBeInTheDocument();
    expect(screen.getByText(/-36\.59/)).toBeInTheDocument();
    expect(screen.getByText(/-3\.42/)).toBeInTheDocument();
    // drawdown abs 96.93 + % 9.53 (from max_drawdown_account), never 96.93%
    expect(screen.getByText(/96\.93/)).toBeInTheDocument();
    expect(screen.getByText(/9\.5%/)).toBeInTheDocument();
  });

  it('renders empty state with CTA when item is null', () => {
    const onRun = vi.fn();
    render(<PerformancePanel item={null} onRunBacktest={onRun} />);
    expect(screen.getByText(/No backtest yet/i)).toBeInTheDocument();
  });
});
