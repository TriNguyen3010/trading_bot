import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { BotMonitoringPage } from '../BotMonitoringPage';
import { botApi } from '../bot.api';

/** Stand-in for the dashboard route: surfaces the navigation state so the
 * Start-via-Launchpad guard can assert the launchpadBotId is carried. */
function LaunchTarget() {
  const loc = useLocation();
  const s = loc.state as { launchpadBotId?: number } | null;
  return <div>launchpad:{s?.launchpadBotId ?? 'none'}</div>;
}

vi.mock('../bot.api', () => ({
  botApi: {
    getStatus: vi.fn(),
    getConfig: vi.fn(),
    getPerformance: vi.fn(),
    getBacktestHistory: vi.fn(),
    getBacktest: vi.fn(),
    getAuditLogs: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    sync: vi.fn(),
    restart: vi.fn(),
  },
}));

vi.mock('sonner', async () => {
  const actual = await vi.importActual<typeof import('sonner')>('sonner');
  return {
    ...actual,
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      message: vi.fn(),
      warning: vi.fn(),
    },
  };
});

function wrap(id: number) {
  return render(
    <MemoryRouter initialEntries={[`/bots/${id}`]}>
      <Routes>
        <Route path="/bots/:id" element={<BotMonitoringPage />} />
        <Route path="/dashboard" element={<LaunchTarget />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(botApi.getStatus).mockResolvedValue({
    id: 86,
    status: 'running',
    desired_status: 'running',
    is_process_running: true,
    error_message: null,
    last_heartbeat: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(botApi.getConfig).mockResolvedValue({
    config: {
      dry_run: true,
      timeframe: '5m',
      exchange: { name: 'hyperliquid', pair_whitelist: ['BTC/USDC:USDC'] },
      stake_currency: 'USDC',
      stake_amount: 100,
      max_open_trades: 10,
      trading_mode: 'futures',
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(botApi.getPerformance).mockResolvedValue({
    balance: 967.94,
    openTrades: 1,
  });
  vi.mocked(botApi.getBacktestHistory).mockResolvedValue({
    items: [
      {
        id: 200,
        status: 'completed',
        strategy_name: 'Gamma',
        win_rate: 44.23,
        total_profit: -36.59,
        timerange: '20260427-20260527',
        timeframe: '5m',
      },
    ],
    total: 1,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(botApi.getBacktest).mockResolvedValue({
    id: 200,
    strategy_name: 'Gamma',
    timerange: '20260427-20260527',
    timeframe: '5m',
    results: {
      strategy: {
        Gamma: {
          trades: [{ profit_abs: 1, close_timestamp: 1 }],
          total_trades: 104,
          profit_total_abs: -36.59,
          winrate: 0.4423,
        },
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(botApi.getAuditLogs).mockResolvedValue([]);
});

describe('BotMonitoringPage', () => {
  it('renders detail with balance + backtest performance', async () => {
    wrap(86);
    expect(await screen.findByText(/967\.94/)).toBeInTheDocument();
    expect(await screen.findByText('104')).toBeInTheDocument();
  });

  it('renders the no-backtest empty state for a not-started bot', async () => {
    vi.mocked(botApi.getStatus).mockResolvedValue({
      id: 9,
      status: 'stopped',
      desired_status: 'stopped',
      is_process_running: false,
      error_message: null,
      last_heartbeat: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(botApi.getBacktestHistory).mockResolvedValue({
      items: [],
      total: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    wrap(9);
    expect(await screen.findByText(/No backtest yet/i)).toBeInTheDocument();
    // Core invariant: a non-running bot must NOT show a (stale) live balance,
    // even though getPerformance still returns 967.94 in the mock.
    expect(screen.queryByText(/967\.94/)).not.toBeInTheDocument();
  });

  it('a stopped bot Start routes to the Launchpad and never calls botApi.start', async () => {
    vi.mocked(botApi.getStatus).mockResolvedValue({
      id: 9,
      status: 'stopped',
      desired_status: 'stopped',
      is_process_running: false,
      error_message: null,
      last_heartbeat: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    vi.mocked(botApi.getBacktestHistory).mockResolvedValue({
      items: [],
      total: 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    wrap(9);
    const startBtn = await screen.findByRole('button', { name: /start/i });
    fireEvent.click(startBtn);
    // Must navigate to the dashboard Launchpad WITH this bot's id in state —
    // that state is the whole reason Start doesn't call botApi.start directly.
    await waitFor(() =>
      expect(screen.getByText('launchpad:9')).toBeInTheDocument(),
    );
    expect(botApi.start).not.toHaveBeenCalled();
  });

  it('does NOT fetch the full backtest when the latest run is not completed', async () => {
    vi.mocked(botApi.getBacktestHistory).mockResolvedValue({
      // failed run → results blob must not be fetched
      items: [{ id: 305, status: 'failed', strategy_name: 'X' }],
      total: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    wrap(86);
    // wait until the page has settled (a panel that always renders)
    expect(await screen.findByText('Configuration')).toBeInTheDocument();
    expect(botApi.getBacktest).not.toHaveBeenCalled();
  });

  it('Stop confirms then calls botApi.stop', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(botApi.stop).mockResolvedValue({
      id: 86,
      status: 'stopping',
      desired_status: 'stopped',
      is_process_running: true,
      error_message: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    wrap(86);
    fireEvent.click(await screen.findByRole('button', { name: /^stop$/i }));
    expect(screen.getByText(/Stop this bot\?/i)).toBeInTheDocument();
    // confirm button inside the dialog is the last "Stop" on screen
    const stops = screen.getAllByRole('button', { name: /^stop$/i });
    fireEvent.click(stops[stops.length - 1]);
    expect(botApi.stop).toHaveBeenCalledWith(86);
  });
});
