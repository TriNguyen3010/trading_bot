import { useEffect, useState } from 'react';
import { backtestApi } from './backtest.api';
import { isBacktestTerminal } from './backtest-helpers';
import type { BacktestHistoryItem } from '@/types/api-helpers';

export interface BacktestPollState {
  item: BacktestHistoryItem | null;
  /** true once the backtest is terminal OR an error occurred. */
  done: boolean;
  error: string | null;
}

/** Poll GET /backtest/{id} every `intervalMs` until terminal. Pass `null` to
 * disable (e.g. before a backtest is started). Self-cancels on unmount and
 * when the id changes. */
export function useBacktestPoll(
  backtestId: number | null,
  intervalMs = 2000,
): BacktestPollState {
  const [state, setState] = useState<BacktestPollState>({
    item: null,
    done: false,
    error: null,
  });

  useEffect(() => {
    if (backtestId == null) return;
    let cancelled = false;
    let handle: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const item = await backtestApi.get(backtestId);
        if (cancelled) return;
        const done = isBacktestTerminal(item);
        setState({ item, done, error: null });
        if (!done) handle = setTimeout(tick, intervalMs);
      } catch (err) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          done: true,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    };

    // reset when (re)starting for a new id
    setState({ item: null, done: false, error: null });
    void tick();

    return () => {
      cancelled = true;
      if (handle) clearTimeout(handle);
    };
  }, [backtestId, intervalMs]);

  return state;
}
