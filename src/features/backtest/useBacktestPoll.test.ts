import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBacktestPoll } from './useBacktestPoll';
import { backtestApi } from './backtest.api';

vi.mock('./backtest.api', () => ({
  backtestApi: { get: vi.fn() },
}));
const mockGet = vi.mocked(backtestApi.get);

beforeEach(() => {
  vi.useFakeTimers();
  mockGet.mockReset();
});
afterEach(() => vi.useRealTimers());

const item = (over: Record<string, unknown>) => ({
  id: 99,
  bot_id: 42,
  user_id: 7,
  strategy_name: 'S',
  timeframe: '5m',
  timerange: '20260514-20260521',
  status: 'running',
  started_at: '2026-05-21T00:00:00Z',
  completed_at: null,
  ...over,
});

describe('useBacktestPoll', () => {
  it('does nothing when id is null', () => {
    renderHook(() => useBacktestPoll(null, 1000));
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('polls until completed_at is set, then stops', async () => {
    mockGet
      .mockResolvedValueOnce(item({ status: 'running' }))
      .mockResolvedValueOnce(
        item({ status: 'completed', completed_at: '2026-05-21T00:01:00Z' }),
      );

    const { result } = renderHook(() => useBacktestPoll(99, 1000));

    // first fetch on mount
    await vi.advanceTimersByTimeAsync(0);
    expect(result.current.done).toBe(false);

    // second fetch after interval → terminal
    await vi.advanceTimersByTimeAsync(1000);
    await waitFor(() => expect(result.current.done).toBe(true));
    expect(result.current.item?.status).toBe('completed');

    // no more polling after terminal
    const calls = mockGet.mock.calls.length;
    await vi.advanceTimersByTimeAsync(3000);
    expect(mockGet.mock.calls.length).toBe(calls);
  });

  it('captures error and stops polling', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useBacktestPoll(99, 1000));
    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.done).toBe(true);
  });
});
