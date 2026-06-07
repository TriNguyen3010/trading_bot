import type { BacktestHistoryItem } from './bot.api';

/** Compact, display-ready summary of one backtest run (top-level history
 * fields only — the heavy `results` blob is fetched per-run on demand). */
export interface BacktestRunSummary {
  id: number;
  timerange: string;
  timeframe: string;
  status: string;
  trades: number | null;
  /** win_rate is already a percent in the history item (e.g. 44.23). */
  winRatePct: number | null;
  /** total_profit is the ABSOLUTE net (e.g. -36.59), not a ratio. */
  netAbs: number | null;
  /** completed_at, or started_at while still running/failed. */
  date: string | null;
}

export function summarizeHistory(
  items: BacktestHistoryItem[],
): BacktestRunSummary[] {
  return items.map((it) => ({
    id: it.id,
    timerange: it.timerange,
    timeframe: it.timeframe,
    status: it.status,
    trades: it.trade_count ?? null,
    winRatePct: it.win_rate ?? null,
    netAbs: it.total_profit ?? null,
    date: it.completed_at ?? it.started_at ?? null,
  }));
}

/** Default selection: the most recent COMPLETED run (highest id), so the
 * user lands on real results; falls back to the latest run overall, or null
 * when there's no history. */
export function pickDefaultRunId(rows: BacktestRunSummary[]): number | null {
  if (rows.length === 0) return null;
  const maxIdOf = (rs: BacktestRunSummary[]) =>
    rs.reduce((m, r) => (r.id > m ? r.id : m), rs[0].id);
  const completed = rows.filter((r) => r.status === 'completed');
  return completed.length > 0 ? maxIdOf(completed) : maxIdOf(rows);
}
