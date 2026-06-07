import { describe, it, expect, vi, beforeEach } from 'vitest';
import { botApi } from '../bot.api';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  const ok = (data: unknown) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    } as Response);
  fetchMock.mockImplementation(() => ok({}));
});

describe('botApi dashboard methods', () => {
  it('getPerformance parses defensively', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ balance: 10, open_trades: 2 }),
      } as Response),
    );
    const p = await botApi.getPerformance(86);
    expect(p.balance).toBe(10);
    expect(p.openTrades).toBe(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/bot/86/performance');
  });

  it('getBacktestHistory hits /backtest/history with bot_id', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], total: 0 }),
      } as Response),
    );
    await botApi.getBacktestHistory(86);
    expect(fetchMock.mock.calls[0][0]).toContain('/backtest/history?bot_id=86');
  });

  it('getBacktest hits /backtest/{id}', async () => {
    await botApi.getBacktest(200);
    expect(fetchMock.mock.calls[0][0]).toContain('/backtest/200');
  });

  it('getBacktestCandles hits /backtest/{id}/candles', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            backtest_id: 200,
            pair: 'BTC/USDC:USDC',
            timeframe: '5m',
            range_start: 0,
            range_end: 0,
            candles: [],
          }),
      } as Response),
    );
    await botApi.getBacktestCandles(200);
    expect(fetchMock.mock.calls[0][0]).toContain('/backtest/200/candles');
  });
});
