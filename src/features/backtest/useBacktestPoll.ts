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

const IDLE: BacktestPollState = { item: null, done: false, error: null };

/** Poll GET /backtest/{id} every `intervalMs` until terminal. Pass `null` for
 * idle (state clears). Self-cancels on unmount and when the id changes.
 * State always belongs to the CURRENT id: it resets during render on id
 * change, so consumer effects in that same commit never observe the previous
 * run's `done`/`item` (BacktestDialog's advance effect acts on `done`). */
export function useBacktestPoll(
  backtestId: number | null,
  intervalMs = 2000,
): BacktestPollState {
  const [state, setState] = useState<BacktestPollState>(IDLE);
  const [prevId, setPrevId] = useState(backtestId);
  if (backtestId !== prevId) {
    setPrevId(backtestId);
    setState(IDLE);
  }

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

    // No reset needed here: the render-phase reset above already cleared
    // state to IDLE on the id change that triggered this effect run.
    void tick();

    return () => {
      cancelled = true;
      if (handle) clearTimeout(handle);
    };
  }, [backtestId, intervalMs]);

  return state;
}
