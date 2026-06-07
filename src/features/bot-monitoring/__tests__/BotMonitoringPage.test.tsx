import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { BotMonitoringPage } from '../BotMonitoringPage';
import { botApi } from '../bot.api';

vi.mock('../bot.api', () => ({
  botApi: {
    getStatus: vi.fn(),
    getConfig: vi.fn(),
    getPerformance: vi.fn(),
    getBacktestHistory: vi.fn(),
    getBacktest: vi.fn(),
    getAuditLogs: vi.fn(),
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
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  });
});
