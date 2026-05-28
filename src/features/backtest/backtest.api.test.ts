import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http } from '@/lib/http';
import { backtestApi } from './backtest.api';

vi.mock('@/lib/http', () => ({ http: vi.fn() }));
const mockHttp = vi.mocked(http);

beforeEach(() => mockHttp.mockReset());

describe('backtestApi.start', () => {
  it('POSTs /backtest/start with the request body', async () => {
    mockHttp.mockResolvedValue({
      job_id: 1,
      backtest_id: 99,
      status: 'queued',
      poll_url: '/backtest/99',
    });
    const payload = {
      bot_id: 42,
      strategy: 'BollingerBreakout',
      timerange: '20260514-20260521',
      stake_amount: 100,
      dry_run_wallet: 1000,
      enable_protections: false,
      backtest_cache: 'day',
    };
    const res = await backtestApi.start(payload);
    expect(mockHttp).toHaveBeenCalledWith('POST', '/backtest/start', payload);
    expect(res.backtest_id).toBe(99);
  });
});

describe('backtestApi.get', () => {
  it('GETs /backtest/:id', async () => {
    mockHttp.mockResolvedValue({ id: 99, status: 'running' });
    await backtestApi.get(99);
    expect(mockHttp).toHaveBeenCalledWith('GET', '/backtest/99');
  });
});

describe('backtestApi.history', () => {
  it('GETs /backtest/history with bot_id + paging query', async () => {
    mockHttp.mockResolvedValue({ items: [], total: 0 });
    await backtestApi.history(42, 10, 0);
    expect(mockHttp).toHaveBeenCalledWith(
      'GET',
      '/backtest/history?bot_id=42&limit=10&offset=0',
    );
  });

  it('omits bot_id when not provided', async () => {
    mockHttp.mockResolvedValue({ items: [], total: 0 });
    await backtestApi.history();
    expect(mockHttp).toHaveBeenCalledWith(
      'GET',
      '/backtest/history?limit=20&offset=0',
    );
  });
});

describe('backtestApi.cancel', () => {
  it('DELETEs /backtest/:id', async () => {
    mockHttp.mockResolvedValue(undefined);
    await backtestApi.cancel(99);
    expect(mockHttp).toHaveBeenCalledWith('DELETE', '/backtest/99');
  });
});
