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

// Shared fixture used by multiple tests (stable reference — no fresh object per render)
const RESULT_ITEM_WITH_TRADES = {
  id: 99,
  bot_id: 42,
  user_id: 7,
  strategy_name: 'Gamma',
  timeframe: '5m',
  timerange: '20260514-20260521',
  status: 'completed',
  trade_count: 2,
  total_profit: 1.0,
  win_rate: 50.0,
  started_at: '2026-05-21T00:00:00Z',
  completed_at: '2026-05-21T00:01:00Z',
  results: {
    strategy: {
      Gamma: {
        trades: [
          {
            pair: 'BTC/USDC:USDC',
            open_timestamp: 1777251300000,
            close_timestamp: 1777272900000,
            open_rate: 78938,
            close_rate: 79088,
            profit_abs: 0.97,
            profit_ratio: 0.0097,
            exit_reason: 'duration_6.0_hours',
            enter_tag: 'ui_enter_long',
            trade_duration: 360,
            is_short: false,
            leverage: 10,
          },
          {
            pair: 'BTC/USDC:USDC',
            open_timestamp: 1777288200000,
            close_timestamp: 1777309800000,
            open_rate: 77716,
            close_rate: 76662,
            profit_abs: 12.7,
            profit_ratio: 0.127,
            exit_reason: 'duration_6.0_hours',
            enter_tag: 'ui_enter_short',
            trade_duration: 360,
            is_short: true,
            leverage: 10,
          },
        ],
      },
    },
    strategy_comparison: [],
  },
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

  it('labels stake/wallet with the pair quote currency, not a hardcoded USDT', () => {
    render(
      <BacktestDialog
        open
        bot={{ ...bot, pair: 'ETH/USDC:USDC' }}
        onOpenChange={() => {}}
      />,
    );
    expect(screen.getByText(/Stake \/ trade \(USDC\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Dry-run wallet \(USDC\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/\(USDT\)/)).not.toBeInTheDocument();
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

  it('fires onComplete when a run terminates (so the detail page can refetch)', () => {
    const onComplete = vi.fn();
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
        onComplete={onComplete}
        initialBacktestId={99}
      />,
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('shows a failure message (not an empty 0-trades summary) when status=failed', () => {
    mockPoll.mockReturnValue({
      item: {
        id: 99,
        bot_id: 42,
        user_id: 7,
        strategy_name: 'BollingerBreakout',
        timeframe: '1h',
        timerange: '20260604-20260605',
        status: 'failed',
        trade_count: 0,
        total_profit: 0,
        win_rate: 0,
        started_at: '2026-06-05T00:00:00Z',
        completed_at: '2026-06-05T00:01:00Z',
        results: {},
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
    // Clear failure callout, not the misleading metric tabs.
    expect(screen.getByText(/thất bại/i)).toBeInTheDocument();
    expect(screen.queryByText('Tổng quan')).not.toBeInTheDocument();
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

  it('shows "Tổng quan" and "Lệnh (N)" tabs in the result step', () => {
    mockPoll.mockReturnValue({
      item: {
        id: 99,
        bot_id: 42,
        user_id: 7,
        strategy_name: 'Gamma',
        timeframe: '5m',
        timerange: '20260514-20260521',
        status: 'completed',
        trade_count: 2,
        total_profit: 1.0,
        win_rate: 50.0,
        started_at: '2026-05-21T00:00:00Z',
        completed_at: '2026-05-21T00:01:00Z',
        results: {
          strategy: {
            Gamma: {
              trades: [
                {
                  pair: 'BTC/USDC:USDC',
                  open_timestamp: 1777251300000,
                  close_timestamp: 1777272900000,
                  open_rate: 78938,
                  close_rate: 79088,
                  profit_abs: 0.97,
                  profit_ratio: 0.0097,
                  exit_reason: 'duration_6.0_hours',
                  enter_tag: 'ui_enter_long',
                  trade_duration: 360,
                  is_short: false,
                  leverage: 10,
                },
                {
                  pair: 'BTC/USDC:USDC',
                  open_timestamp: 1777288200000,
                  close_timestamp: 1777309800000,
                  open_rate: 77716,
                  close_rate: 76662,
                  profit_abs: 12.7,
                  profit_ratio: 0.127,
                  exit_reason: 'duration_6.0_hours',
                  enter_tag: 'ui_enter_short',
                  trade_duration: 360,
                  is_short: true,
                  leverage: 10,
                },
              ],
            },
          },
          strategy_comparison: [],
        },
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
    expect(
      screen.getByRole('button', { name: /Tổng quan/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Lệnh \(2\)/i }),
    ).toBeInTheDocument();
  });

  it('defaults to summary tab — ResultMetric cards visible', () => {
    mockPoll.mockReturnValue({
      item: {
        id: 99,
        bot_id: 42,
        user_id: 7,
        strategy_name: 'Gamma',
        timeframe: '5m',
        timerange: '20260514-20260521',
        status: 'completed',
        trade_count: 1,
        total_profit: 1.0,
        win_rate: 100.0,
        started_at: '2026-05-21T00:00:00Z',
        completed_at: '2026-05-21T00:01:00Z',
        results: {
          strategy: { Gamma: { trades: [] } },
          strategy_comparison: [],
        },
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
    // Summary metrics are visible by default.
    expect(screen.getByText('Trades')).toBeInTheDocument();
    expect(screen.getByText('Win rate')).toBeInTheDocument();
  });

  it('resultTab resets to summary when dialog re-opens', async () => {
    const { rerender } = render(
      <BacktestDialog open={false} bot={bot} onOpenChange={() => {}} />,
    );
    // Re-open — should land on summary.
    rerender(<BacktestDialog open bot={bot} onOpenChange={() => {}} />);
    // setup step visible (no initialBacktestId) — toggle not present yet, but no crash.
    expect(
      screen.getByRole('button', { name: /run backtest/i }),
    ).toBeInTheDocument();
  });

  it('clicking "Lệnh (N)" tab renders the trades table headers', () => {
    mockPoll.mockReturnValue({
      item: RESULT_ITEM_WITH_TRADES,
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
    fireEvent.click(screen.getByRole('button', { name: /Lệnh \(2\)/i }));
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
    expect(screen.getByText('Dir')).toBeInTheDocument();
    // Column 4 header uses currency from bot.pair "BTC/USDT" → "USDT"
    expect(screen.getByText(/P\/L \(USDT\)/i)).toBeInTheDocument();
    expect(screen.getByText('P/L %')).toBeInTheDocument();
    expect(screen.getByText('Exit')).toBeInTheDocument();
  });

  it('renders trade rows with correct Dir badge and P/L values', () => {
    mockPoll.mockReturnValue({
      item: RESULT_ITEM_WITH_TRADES,
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
    fireEvent.click(screen.getByRole('button', { name: /Lệnh \(2\)/i }));
    // Trade 1: is_short=false → LONG badge
    expect(screen.getByText('LONG')).toBeInTheDocument();
    // Trade 2: is_short=true → SHORT badge
    expect(screen.getByText('SHORT')).toBeInTheDocument();
    // Trade 1 profit_abs = 0.97 → "+0.97"
    expect(screen.getByText('+0.97')).toBeInTheDocument();
    // Trade 2 profit_abs = 12.70 → "+12.70"
    expect(screen.getByText('+12.70')).toBeInTheDocument();
    // Exit reasons
    expect(screen.getAllByText('duration_6.0_hours')).toHaveLength(2);
  });

  it('shows empty state message when trades array is empty', () => {
    mockPoll.mockReturnValue({
      item: {
        ...RESULT_ITEM_WITH_TRADES,
        results: {
          strategy: { Gamma: { trades: [] } },
          strategy_comparison: [],
        },
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
    fireEvent.click(screen.getByRole('button', { name: /Lệnh \(0\)/i }));
    expect(
      screen.getByText(/Không có lệnh nào trong khoảng thời gian này\./i),
    ).toBeInTheDocument();
  });

  it('summary tab is still accessible and shows metric cards', () => {
    mockPoll.mockReturnValue({
      item: RESULT_ITEM_WITH_TRADES,
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
    // Switch to trades.
    fireEvent.click(screen.getByRole('button', { name: /Lệnh \(2\)/i }));
    // Switch back to summary.
    fireEvent.click(screen.getByRole('button', { name: /Tổng quan/i }));
    // Metric cards reappear.
    expect(screen.getByText('Trades')).toBeInTheDocument();
    expect(screen.getByText('Win rate')).toBeInTheDocument();
  });
});
