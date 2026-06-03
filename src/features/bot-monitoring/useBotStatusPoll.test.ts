import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBotStatusPoll } from './useBotStatusPoll';
import { botApi, type BotStatusOut } from './bot.api';

vi.mock('./bot.api', () => ({
  botApi: { getStatus: vi.fn() },
}));

function mkStatus(over: Partial<BotStatusOut> = {}): BotStatusOut {
  return {
    id: 42,
    bot_name: 'b',
    status: 'stopped',
    desired_status: null,
    is_process_running: false,
    error_message: null,
    ...over,
  } as BotStatusOut;
}

describe('useBotStatusPoll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(botApi.getStatus).mockResolvedValue(mkStatus());
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('fetches once on mount', async () => {
    const { result } = renderHook(() => useBotStatusPoll(42));
    await waitFor(() => expect(result.current.status).not.toBeNull());
    expect(botApi.getStatus).toHaveBeenCalledTimes(1);
    expect(result.current.status?.status).toBe('stopped');
  });

  // I-1: a poll already in flight must NOT overwrite a newer optimistic update.
  it('does not let an in-flight poll overwrite a later optimistic setStatus', async () => {
    let resolvePoll!: (s: BotStatusOut) => void;
    const pending = new Promise<BotStatusOut>((r) => {
      resolvePoll = r;
    });
    vi.mocked(botApi.getStatus)
      .mockResolvedValueOnce(mkStatus({ status: 'running' })) // initial mount fetch
      .mockReturnValueOnce(pending); // the in-flight background poll

    const { result } = renderHook(() =>
      useBotStatusPoll(42, { enabled: false }),
    );
    await waitFor(() => expect(result.current.status?.status).toBe('running'));

    // A poll is now in flight…
    let p!: Promise<void>;
    act(() => {
      p = result.current.refetch();
    });
    // …and an optimistic update lands while it's still awaiting.
    act(() => result.current.setStatus(mkStatus({ status: 'stopping' })));
    // The stale poll finally resolves with the old 'running' state.
    await act(async () => {
      resolvePoll(mkStatus({ status: 'running' }));
      await p;
    });

    expect(result.current.status?.status).toBe('stopping'); // not clobbered
  });

  it('polls fast (1.5s) while in transition state', async () => {
    vi.mocked(botApi.getStatus)
      .mockResolvedValueOnce(mkStatus({ status: 'starting' }))
      .mockResolvedValueOnce(mkStatus({ status: 'starting' }))
      .mockResolvedValueOnce(mkStatus({ status: 'running' }));

    renderHook(() => useBotStatusPoll(42));
    await vi.advanceTimersByTimeAsync(0);
    expect(botApi.getStatus).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(botApi.getStatus).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(botApi.getStatus).toHaveBeenCalledTimes(3);
  });

  it('polls slow (10s) while in terminal state', async () => {
    vi.mocked(botApi.getStatus).mockResolvedValue(
      mkStatus({ status: 'running' }),
    );
    renderHook(() => useBotStatusPoll(42));
    await vi.advanceTimersByTimeAsync(0);
    expect(botApi.getStatus).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(botApi.getStatus).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(8_500);
    expect(botApi.getStatus).toHaveBeenCalledTimes(2);
  });

  it('skips tick when document.hidden=true', async () => {
    Object.defineProperty(document, 'hidden', {
      value: true,
      configurable: true,
    });
    renderHook(() => useBotStatusPoll(42));
    await vi.advanceTimersByTimeAsync(0);
    expect(botApi.getStatus).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(botApi.getStatus).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'hidden', {
      value: false,
      configurable: true,
    });
  });

  it('exposes refetch() that forces an immediate fetch', async () => {
    const { result } = renderHook(() => useBotStatusPoll(42));
    await waitFor(() => expect(botApi.getStatus).toHaveBeenCalledTimes(1));
    await act(async () => {
      await result.current.refetch();
    });
    expect(botApi.getStatus).toHaveBeenCalledTimes(2);
  });

  it('exposes setStatus() for optimistic update from action handlers', async () => {
    const { result } = renderHook(() => useBotStatusPoll(42));
    await waitFor(() => expect(result.current.status).not.toBeNull());
    act(() => {
      result.current.setStatus(mkStatus({ status: 'starting' }));
    });
    expect(result.current.status?.status).toBe('starting');
  });

  it('stops polling on unmount', async () => {
    const { unmount } = renderHook(() => useBotStatusPoll(42));
    await vi.advanceTimersByTimeAsync(0);
    expect(botApi.getStatus).toHaveBeenCalledTimes(1);
    unmount();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(botApi.getStatus).toHaveBeenCalledTimes(1);
  });

  it('honors enabled:false — does initial fetch but no polling', async () => {
    vi.mocked(botApi.getStatus).mockResolvedValue(
      mkStatus({ status: 'starting' }),
    );
    renderHook(() => useBotStatusPoll(42, { enabled: false }));
    await vi.advanceTimersByTimeAsync(0);
    expect(botApi.getStatus).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(botApi.getStatus).toHaveBeenCalledTimes(1);
  });

  it('does nothing when botId is null', async () => {
    const { result } = renderHook(() => useBotStatusPoll(null));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(botApi.getStatus).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.status).toBeNull();
  });
});
