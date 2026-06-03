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

/** Formats the top-level `BacktestHistoryItem.win_rate`, which is a percentage
 * 0-100 (confirmed via sample). Do NOT apply a 0-1→0-100 heuristic here: a
 * legitimate 1% win-rate (v=1.0) would otherwise be inflated to 100%. The
 * comparison-item `winrate` (0-1 ratio) is never routed through this. */
export function formatWinRate(v: number | null): string {
  if (v == null) return '—';
  return `${v.toFixed(1)}%`;
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

/** Shape of one trade entry inside
 * `results.strategy.<StrategyName>.trades[]` in BE/backtest_200.json.
 * Field names match Freqtrade's backtest output exactly. */
export interface BacktestTrade {
  pair: string;
  open_timestamp: number; // epoch ms
  close_timestamp: number; // epoch ms
  open_rate: number;
  close_rate: number;
  profit_abs: number; // absolute P/L in stake currency
  profit_ratio: number; // fraction (0.01 = 1%)
  exit_reason: string;
  enter_tag: string;
  trade_duration: number; // minutes
  is_short: boolean;
  leverage: number;
}

/** Extracts the per-trade list from `results.strategy.<StrategyName>.trades`.
 * Uses `item.strategy_name` as the primary key; falls back to the first key
 * of `results.strategy` if the name doesn't match. Returns `[]` when the
 * path is absent, the array is missing, or it is not an array. */
export function extractTrades(item: BacktestHistoryItem): BacktestTrade[] {
  const results = item.results as
    | { strategy?: Record<string, { trades?: unknown }> }
    | null
    | undefined;
  const strategy = results?.strategy;
  if (!strategy || typeof strategy !== 'object') return [];

  const strategyKey =
    item.strategy_name && strategy[item.strategy_name] !== undefined
      ? item.strategy_name
      : Object.keys(strategy)[0];

  if (!strategyKey) return [];
  const trades = strategy[strategyKey]?.trades;
  if (!Array.isArray(trades)) return [];
  // Normalize each row: the table calls `.toFixed()` on profit fields and
  // formats the timestamps, so coerce numbers (a missing/null/string field
  // from a BE drift would otherwise white-screen the whole table).
  return trades.map((raw) => {
    const tr = (raw ?? {}) as Partial<BacktestTrade>;
    return {
      pair: String(tr.pair ?? ''),
      open_timestamp: num(tr.open_timestamp),
      close_timestamp: num(tr.close_timestamp),
      open_rate: num(tr.open_rate),
      close_rate: num(tr.close_rate),
      profit_abs: num(tr.profit_abs),
      profit_ratio: num(tr.profit_ratio),
      exit_reason: String(tr.exit_reason ?? ''),
      enter_tag: String(tr.enter_tag ?? ''),
      trade_duration: num(tr.trade_duration),
      is_short: Boolean(tr.is_short),
      leverage: num(tr.leverage),
    };
  });
}

/** Coerce an unknown to a finite number, defaulting to 0. */
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Converts `trade_duration` (minutes) to a human-readable duration string.
 * < 60 min → "Xm", < 1440 min → "Xh Ym", >= 1440 min → "Xd Yh". */
export function formatTradeDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const days = Math.floor(minutes / 1440);
  if (days >= 1) {
    const hours = Math.floor((minutes % 1440) / 60);
    return `${days}d ${hours}h`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

/** Converts an epoch-ms timestamp to "MMM DD HH:MM" (UTC) for table display.
 * Example: 1777251300000 → "Apr 27 00:55". */
export function formatTradeTime(epochMs: number): string {
  const d = new Date(epochMs);
  const mon = MONTHS[d.getUTCMonth()];
  const day = d.getUTCDate();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${mon} ${day} ${hh}:${mm}`;
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
