import type { BacktestHistoryItem } from '@/types/api-helpers';

/** N-day window ending `now`, as Freqtrade timerange "YYYYMMDD-YYYYMMDD" (UTC). */
export function presetToTimerange(
  days: number,
  now: Date = new Date(),
): string {
  const end = now;
  const start = new Date(now.getTime() - days * 86_400_000);
  const ymd = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(
      d.getUTCDate(),
    ).padStart(2, '0')}`;
  return `${ymd(start)}-${ymd(end)}`;
}

/** BE doesn't enum-ise status. Treat a set `completed_at` (or a failure-ish
 * status word) as terminal; everything else means "keep polling". */
export function isBacktestTerminal(
  item: Pick<BacktestHistoryItem, 'status' | 'completed_at'>,
): boolean {
  if (item.completed_at) return true;
  return /fail|error|cancel/i.test(item.status ?? '');
}

/** Win-rate units are undocumented at the openapi level; accept fraction
 * (0–1) or percent (0–100). Top-level `BacktestHistoryItem.win_rate` is
 * confirmed percentage 0-100 via sample, but the dual-unit guard stays in
 * case the comparison-item `winrate` (0-1 ratio) is fed through. */
export function formatWinRate(v: number | null): string {
  if (v == null) return '—';
  const pct = v <= 1 ? v * 100 : v;
  return `${pct.toFixed(1)}%`;
}

/** `BacktestHistoryItem.total_profit` is absolute amount in stake currency
 * (Gap 2 resolved 2026-05-28: matches `results.strategy_comparison[0].profit_total_abs`).
 * Default stake currency USDT; pass another when known from bot config. */
export function formatTotalProfit(
  v: number | null,
  stakeCurrency = 'USDT',
): string {
  if (v == null) return '—';
  const sign = v >= 0 ? '+' : '-';
  return `${sign}${Math.abs(v).toFixed(2)} ${stakeCurrency}`;
}

/** Derive the stake/quote currency from a pair so the UI doesn't hardcode
 * "USDT". Handles Freqtrade futures `BASE/QUOTE:SETTLE` (→ SETTLE), plus
 * `BASE/QUOTE` and `BASE-QUOTE` (→ QUOTE). Falls back to "USDT" when the pair
 * is empty or has no separator. */
export function quoteCurrencyFromPair(pair: string | null | undefined): string {
  if (!pair) return 'USDT';
  // Futures pairs settle in the currency after ':' (e.g. ETH/USDC:USDC).
  if (pair.includes(':')) {
    const settle = pair.split(':').pop()?.trim();
    return settle || 'USDT';
  }
  const parts = pair.split(/[/-]/);
  const quote = parts.length > 1 ? parts[parts.length - 1].trim() : '';
  return quote || 'USDT';
}

/** Shape of one entry in `results.strategy_comparison[]`. BE openapi marks
 * `results` as `additionalProperties:true` (no schema), but sample
 * `BE/backtest_200.json` confirms this shape. FE owns the type locally
 * until BE documents it formally. */
export interface BacktestComparisonItem {
  key: string;
  trades: number;
  profit_total_abs: number;
  profit_total_pct: number;
  duration_avg: string;
  winrate: number; // 0-1 ratio (NOT 0-100)
  sharpe: number;
  sortino: number;
  calmar: number;
  profit_factor: number;
  max_drawdown_account: number; // 0-1 ratio
  max_drawdown_abs: string; // string in sample, NOT number
}

export interface BacktestMetrics {
  trades: number | null;
  totalProfit: number | null; // absolute USDT/USDC (Gap 2 resolved)
  winRate: number | null; // percentage 0-100 (top-level convention)
  maxDrawdownPct: number | null; // percentage 0-100 (converted from ratio)
  sharpe: number | null;
  avgTrade: string | null;
}

/** Top-level fields are typed by openapi (Gap 2 resolved: total_profit is
 * absolute USDT, win_rate is percentage 0-100). Rich metrics come from
 * `results.strategy_comparison[0]` — shape known from sample, typed locally
 * as BacktestComparisonItem. */
export function extractMetrics(item: BacktestHistoryItem): BacktestMetrics {
  const results = item.results as
    | { strategy_comparison?: BacktestComparisonItem[] }
    | null
    | undefined;
  const comp = results?.strategy_comparison?.[0] ?? null;
  return {
    trades: item.trade_count ?? null,
    totalProfit: item.total_profit ?? null,
    winRate: item.win_rate ?? null,
    maxDrawdownPct:
      comp && typeof comp.max_drawdown_account === 'number'
        ? comp.max_drawdown_account * 100
        : null,
    sharpe: comp?.sharpe ?? null,
    avgTrade: comp?.duration_avg ?? null,
  };
}
