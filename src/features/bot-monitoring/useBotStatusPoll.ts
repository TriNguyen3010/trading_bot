import { useCallback, useEffect, useRef, useState } from 'react';
import { botApi, type BotStatusOut } from './bot.api';
import { isTerminal } from './lifecycle-actions';

export interface UseBotStatusPollOptions {
  /** Poll interval when status is transition (starting/stopping/unknown). Default 1500ms. */
  fastInterval?: number;
  /** Poll interval when status is terminal (running/stopped/error). Default 10000ms. */
  slowInterval?: number;
  /** Set to false to disable polling entirely (still does initial fetch). */
  enabled?: boolean;
}

export interface UseBotStatusPollResult {
  status: BotStatusOut | null;
  loading: boolean;
  error: string | null;
  /** Force an immediate fetch (e.g. after a start/stop action). */
  refetch: () => Promise<void>;
  /** Replace status synchronously (e.g. optimistic update). Next tick still polls server. */
  setStatus: (s: BotStatusOut) => void;
}

export function useBotStatusPoll(
  botId: number | null,
  opts: UseBotStatusPollOptions = {},
): UseBotStatusPollResult {
  const { fastInterval = 1_500, slowInterval = 10_000, enabled = true } = opts;
  const [status, setStatusState] = useState<BotStatusOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stash status in ref so the polling loop can read latest without re-binding
  // the interval each render. Re-creating the interval on every state change
  // would make cadence detection (terminal vs transition) impossible.
  const statusRef = useRef<BotStatusOut | null>(null);
  statusRef.current = status;

  const inFlightRef = useRef(false);

  // Guard against stale setState calls after unmount during in-flight fetch.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchOnce = useCallback(async () => {
    if (botId == null) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await botApi.getStatus(botId);
      if (!mountedRef.current) return;
      setStatusState(res);
      statusRef.current = res;
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    if (botId == null) {
      setLoading(false);
      return;
    }
    setLoading(true);

    let handle: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const schedule = () => {
      const current = statusRef.current?.status ?? '';
      const ms = isTerminal(current) ? slowInterval : fastInterval;
      handle = setTimeout(async () => {
        if (!document.hidden) {
          await fetchOnce();
        }
        if (active) schedule();
      }, ms);
    };

    // Do the initial fetch first, then start the polling loop with the correct
    // cadence derived from the known status. Starting schedule() before the
    // initial fetch resolves would read a null status and always pick fastInterval
    // even when the bot is already in a terminal state.
    void fetchOnce().then(() => {
      if (enabled && active) schedule();
    });

    return () => {
      active = false;
      if (handle != null) clearTimeout(handle);
    };
  }, [botId, enabled, fastInterval, slowInterval, fetchOnce]);

  const refetch = useCallback(async () => {
    await fetchOnce();
  }, [fetchOnce]);

  const setStatus = useCallback((s: BotStatusOut) => {
    setStatusState(s);
    statusRef.current = s;
  }, []);

  return { status, loading, error, refetch, setStatus };
}
