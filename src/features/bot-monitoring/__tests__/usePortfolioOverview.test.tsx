import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePortfolioOverview } from '../usePortfolioOverview';
import { botApi } from '../bot.api';

vi.mock('../bot.api', () => ({
  botApi: {
    list: vi.fn(),
    getConfig: vi.fn(),
    getPerformance: vi.fn(),
    getBacktestHistory: vi.fn(),
  },
}));

const mockApi = botApi as unknown as {
  list: ReturnType<typeof vi.fn>;
  getConfig: ReturnType<typeof vi.fn>;
  getPerformance: ReturnType<typeof vi.fn>;
  getBacktestHistory: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePortfolioOverview', () => {
  it('does not fetch when disabled', async () => {
    const { result } = renderHook(() =>
      usePortfolioOverview({ enabled: false }),
    );
    expect(mockApi.list).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.bots).toBeNull();
  });

  it('loads bots + computes capitalDeployed from running balances', async () => {
    mockApi.list.mockResolvedValue([
      {
        id: 1,
        bot_name: 'A',
        status: 'running',
        error_message: null,
        strategy_name: null,
        created_at: null,
      },
      {
        id: 2,
        bot_name: 'B',
        status: 'stopped',
        error_message: null,
        strategy_name: null,
        created_at: null,
      },
    ]);
    mockApi.getConfig.mockImplementation(() =>
      Promise.resolve({
        config: {
          dry_run: true,
          timeframe: '5m',
          exchange: { pair_whitelist: ['ETH/USDC:USDC'] },
        },
      }),
    );
    mockApi.getPerformance.mockResolvedValue({ balance: 250, openTrades: 1 });
    mockApi.getBacktestHistory.mockResolvedValue({ items: [], total: 0 });

    const { result } = renderHook(() => usePortfolioOverview());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bots).toHaveLength(2);
    expect(result.current.stats.capitalDeployed).toBe(250); // only the running (DRY-RUN) bot #1
    expect(result.current.stats.total).toBe(2);
    expect(result.current.stats.active).toBe(1);
  });

  it('sets error when list fails', async () => {
    mockApi.list.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => usePortfolioOverview());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });

  it('empty list → bots [] and zero stats', async () => {
    mockApi.list.mockResolvedValue([]);
    const { result } = renderHook(() => usePortfolioOverview());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bots).toEqual([]);
    expect(result.current.stats.capitalDeployed).toBe(0);
  });
});
