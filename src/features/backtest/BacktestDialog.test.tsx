import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BacktestDialog, type BacktestBot } from './BacktestDialog';
import { backtestApi } from './backtest.api';
import { useBacktestPoll } from './useBacktestPoll';

vi.mock('./backtest.api', () => ({
  backtestApi: { start: vi.fn(), cancel: vi.fn() },
}));
vi.mock('./useBacktestPoll', () => ({ useBacktestPoll: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockStart = vi.mocked(backtestApi.start);
const mockPoll = vi.mocked(useBacktestPoll);

const bot: BacktestBot = {
  id: 42,
  name: 'Bollinger breakout',
  strategyName: 'BollingerBreakout',
  pair: 'BTC/USDT',
  timeframe: '5m',
};

beforeEach(() => {
  mockStart.mockReset();
  mockPoll.mockReset();
  mockPoll.mockReturnValue({ item: null, done: false, error: null });
});

describe('BacktestDialog', () => {
  it('renders the setup step with the bot name', () => {
    render(<BacktestDialog open bot={bot} onOpenChange={() => {}} />);
    expect(screen.getByText(/Backtest/i)).toBeInTheDocument();
    expect(screen.getByText('Bollinger breakout')).toBeInTheDocument();
  });

  it('starts a backtest with bot_id + strategy + timerange on Run', async () => {
    mockStart.mockResolvedValue({
      job_id: 1,
      backtest_id: 99,
      status: 'queued',
      message: 'Backtest submitted successfully',
      poll_url: '/backtest/99',
    });
    render(<BacktestDialog open bot={bot} onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }));
    await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(1));
    const payload = mockStart.mock.calls[0][0];
    expect(payload.bot_id).toBe(42);
    expect(payload.strategy).toBe('BollingerBreakout');
    expect(payload.timerange).toMatch(/^\d{8}-\d{8}$/);
  });

  it('shows result metrics when poll completes', () => {
    mockPoll.mockReturnValue({
      item: {
        id: 99,
        bot_id: 42,
        user_id: 7,
        strategy_name: 'BollingerBreakout',
        timeframe: '5m',
        timerange: '20260514-20260521',
        status: 'completed',
        trade_count: 47,
        total_profit: 12.4,
        win_rate: 61.7,
        started_at: '2026-05-21T00:00:00Z',
        completed_at: '2026-05-21T00:01:00Z',
        results: { sharpe: 1.42 },
      },
      done: true,
      error: null,
    });
    render(
      <BacktestDialog
        open
        bot={bot}
        onOpenChange={() => {}}
        initialBacktestId={99}
      />,
    );
    expect(screen.getByText('47')).toBeInTheDocument();
    expect(screen.getByText('61.7%')).toBeInTheDocument();
  });

  it('cancel during running calls backtestApi.cancel + closes dialog', async () => {
    mockStart.mockResolvedValue({
      job_id: 1,
      backtest_id: 99,
      status: 'queued',
      message: 'Backtest submitted successfully',
      poll_url: '/backtest/99',
    });
    vi.mocked(backtestApi.cancel).mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <BacktestDialog
        open
        bot={bot}
        onOpenChange={onOpenChange}
        initialBacktestId={99}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /cancel and go back/i }),
    );
    await waitFor(() => expect(backtestApi.cancel).toHaveBeenCalledWith(99));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders the no-strategy warning when bot.strategyName is null', () => {
    render(
      <BacktestDialog
        open
        bot={{ ...bot, strategyName: null }}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByText(/chưa có strategy name/i)).toBeInTheDocument();
  });

  it('reverts to setup with error banner when poll reports error', async () => {
    mockPoll.mockReturnValue({
      item: null,
      done: true,
      error: 'Backtest failed: insufficient candles',
    });
    render(
      <BacktestDialog
        open
        bot={bot}
        onOpenChange={() => {}}
        initialBacktestId={99}
      />,
    );
    // Effect 1 should detect poll.error and revert to setup; the error
    // text surfaces inside the setup-step error banner.
    await waitFor(() =>
      expect(
        screen.getByText(/Backtest failed: insufficient candles/i),
      ).toBeInTheDocument(),
    );
    // Setup-step controls are visible again.
    expect(
      screen.getByRole('button', { name: /run backtest/i }),
    ).toBeInTheDocument();
  });

  it('shows "No metrics returned" fallback when poll completes with no item', () => {
    mockPoll.mockReturnValue({ item: null, done: true, error: null });
    render(
      <BacktestDialog
        open
        bot={bot}
        onOpenChange={() => {}}
        initialBacktestId={99}
      />,
    );
    // Without an item, extractMetrics returns null and the result step
    // falls back to the "No metrics returned" view.
    expect(screen.getByText(/No metrics returned/i)).toBeInTheDocument();
  });

  it('"Run again" resets the dialog to setup from the result step', () => {
    mockPoll.mockReturnValue({
      item: {
        id: 99,
        bot_id: 42,
        user_id: 7,
        strategy_name: 'BollingerBreakout',
        timeframe: '5m',
        timerange: '20260514-20260521',
        status: 'completed',
        trade_count: 47,
        total_profit: 12.4,
        win_rate: 61.7,
        started_at: '2026-05-21T00:00:00Z',
        completed_at: '2026-05-21T00:01:00Z',
        results: { sharpe: 1.42 },
      },
      done: true,
      error: null,
    });
    render(
      <BacktestDialog
        open
        bot={bot}
        onOpenChange={() => {}}
        initialBacktestId={99}
      />,
    );
    // First we're in the result step.
    expect(screen.getByText('47')).toBeInTheDocument();
    // Click Run again.
    fireEvent.click(screen.getByRole('button', { name: /run again/i }));
    // Setup-step controls reappear (Run button is visible again).
    expect(
      screen.getByRole('button', { name: /run backtest/i }),
    ).toBeInTheDocument();
  });
});
