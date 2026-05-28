import { http } from '@/lib/http';
import type {
  BacktestRequest,
  BacktestJobResponse,
  BacktestHistoryItem,
  BacktestHistoryList,
} from '@/types/api-helpers';

export const backtestApi = {
  /** Kick off an async backtest. BE returns 202 + backtest_id to poll. */
  start: (payload: BacktestRequest) =>
    http<BacktestJobResponse>('POST', '/backtest/start', payload),

  /** Fetch one backtest record (poll this until `completed_at` is set). */
  get: (id: number) => http<BacktestHistoryItem>('GET', `/backtest/${id}`),

  /** List past backtests, optionally filtered by bot. */
  history: (botId?: number, limit = 20, offset = 0) => {
    const qs = new URLSearchParams();
    if (botId != null) qs.set('bot_id', String(botId));
    qs.set('limit', String(limit));
    qs.set('offset', String(offset));
    return http<BacktestHistoryList>(
      'GET',
      `/backtest/history?${qs.toString()}`,
    );
  },

  /** Cancel / delete a running or finished backtest (best-effort). */
  cancel: (id: number) => http<void>('DELETE', `/backtest/${id}`),
};
