import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BacktestHistoryPanel } from '../BacktestHistoryPanel';
import type { BacktestRunSummary } from '../../backtest-history';

const runs: BacktestRunSummary[] = [
  {
    id: 200,
    timerange: '20260427-20260527',
    timeframe: '5m',
    status: 'completed',
    trades: 104,
    winRatePct: 44.23,
    netAbs: -36.59,
    date: '2026-05-27T07:28:05Z',
    strategyName: 'Gamma',
  },
  {
    id: 305,
    timerange: '20260401-20260501',
    timeframe: '5m',
    status: 'failed',
    // non-null metrics here would be WRONG to show — the panel must hide them
    // for non-completed runs.
    trades: 7,
    winRatePct: 99,
    netAbs: 1.23,
    date: '2026-06-01T00:00:00Z',
    strategyName: 'Gamma',
  },
];

describe('BacktestHistoryPanel', () => {
  it('renders a row per run with id, win rate and net', () => {
    render(
      <BacktestHistoryPanel runs={runs} selectedId={200} onSelect={vi.fn()} />,
    );
    expect(screen.getByText(/#200/)).toBeInTheDocument();
    expect(screen.getByText(/44\.2%/)).toBeInTheDocument();
    expect(screen.getByText(/-36\.59/)).toBeInTheDocument();
    // failed run shows a status badge
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
    // …but NOT its metrics (only completed runs show win/trades/net)
    expect(screen.queryByText('99.0%')).not.toBeInTheDocument();
    expect(screen.queryByText(/\+1\.23/)).not.toBeInTheDocument();
  });

  it('fires onSelect with the run id when a row is clicked', () => {
    const onSelect = vi.fn();
    render(
      <BacktestHistoryPanel runs={runs} selectedId={200} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByText(/#305/));
    expect(onSelect).toHaveBeenCalledWith(305);
  });

  it('marks the selected run with aria-current', () => {
    render(
      <BacktestHistoryPanel runs={runs} selectedId={200} onSelect={vi.fn()} />,
    );
    const selected = screen.getByText(/#200/).closest('button');
    expect(selected).toHaveAttribute('aria-current', 'true');
  });

  it('renders an empty hint when there are no runs', () => {
    render(
      <BacktestHistoryPanel runs={[]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText(/No backtests yet/i)).toBeInTheDocument();
  });
});
