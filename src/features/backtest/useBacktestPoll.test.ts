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

  it('starts fresh for a new id — the previous run never leaks into the same commit', async () => {
    mockGet.mockResolvedValueOnce(
      item({ status: 'completed', completed_at: '2026-05-21T00:01:00Z' }),
    );
    const { result, rerender } = renderHook(
      ({ id }: { id: number }) => useBacktestPoll(id, 1000),
      { initialProps: { id: 99 } },
    );
    await waitFor(() => expect(result.current.done).toBe(true));

    mockGet.mockResolvedValueOnce(item({ id: 150, status: 'running' }));
    rerender({ id: 150 });
    // Reset must be visible synchronously after the rerender — consumer
    // effects in that very commit act on poll.done (BacktestDialog would
    // otherwise jump straight to an empty result for the new run).
    expect(result.current.done).toBe(false);
    expect(result.current.item).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('clears to idle when the id goes null (dialog closed or reset)', async () => {
    mockGet.mockResolvedValueOnce(
      item({ status: 'completed', completed_at: '2026-05-21T00:01:00Z' }),
    );
    const { result, rerender } = renderHook(
      ({ id }: { id: number | null }) => useBacktestPoll(id, 1000),
      { initialProps: { id: 99 as number | null } },
    );
    await waitFor(() => expect(result.current.done).toBe(true));

    rerender({ id: null });
    expect(result.current).toEqual({ item: null, done: false, error: null });
    // …and stays idle: no further fetches.
    const calls = mockGet.mock.calls.length;
    await vi.advanceTimersByTimeAsync(3000);
    expect(mockGet.mock.calls.length).toBe(calls);
  });
});
