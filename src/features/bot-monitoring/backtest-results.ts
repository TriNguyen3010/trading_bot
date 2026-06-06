import type { components } from '@/types/api';

export type BacktestHistoryItem = components['schemas']['BacktestHistoryItem'];

export interface BacktestTrade {
  profit_abs: number;
  profit_ratio?: number;
  open_rate?: number;
  close_rate?: number;
  leverage?: number;
  is_short?: boolean;
  exit_reason?: string;
  funding_fees?: number;
  trade_duration?: number;
  close_timestamp: number;
  pair?: string;
}

export interface StrategyBlock {
  trades: BacktestTrade[];
  total_trades?: number;
  profit_total_abs?: number;
  profit_total?: number;
  trade_count_long?: number;
  trade_count_short?: number;
  sharpe?: number;
  sortino?: number;
  profit_factor?: number;
  expectancy?: number;
  trades_per_day?: number;
  avg_stake_amount?: number;
  total_volume?: number;
  market_change?: number;
  best_pair?: {
    winrate?: number;
    wins?: number;
    losses?: number;
    max_drawdown_abs?: number;
    max_drawdown_account?: number;
  };
  exit_reason_summary?: Array<{
    key: string;
    trades: number;
    profit_total_abs: number;
  }>;
}

export interface BacktestMetrics {
  netAbs: number | null;
  netPct: number | null;
  trades: number | null;
  winRatePct: number | null;
  wins: number | null;
  losses: number | null;
  profitFactor: number | null;
  sharpe: number | null;
  sortino: number | null;
  expectancy: number | null;
  maxDrawdownAbs: number | null;
  maxDrawdownPct: number | null;
  tradesPerDay: number | null;
  longCount: number | null;
  shortCount: number | null;
  avgStake: number | null;
  volume: number | null;
  marketChangePct: number | null;
}

export interface ExitReason {
  key: string;
  trades: number;
  profitAbs: number;
}

export function extractStrategyBlock(
  item: BacktestHistoryItem,
): StrategyBlock | null {
  const results = item.results as
    | { strategy?: Record<string, StrategyBlock> }
    | null
    | undefined;
  const block = results?.strategy?.[item.strategy_name];
  return block ?? null;
}

export function buildEquityCurve(block: StrategyBlock): number[] {
  const sorted = [...block.trades].sort(
    (a, b) => a.close_timestamp - b.close_timestamp,
  );
  let cum = 0;
  return sorted.map((t) => {
    cum += t.profit_abs;
    return Math.round(cum * 1000) / 1000;
  });
}

const pct = (frac: number | undefined): number | null =>
  typeof frac === 'number' ? Math.round(frac * 10000) / 100 : null;
const n = (v: number | undefined): number | null =>
  typeof v === 'number' ? v : null;

export function extractBacktestMetrics(block: StrategyBlock): BacktestMetrics {
  const bp = block.best_pair ?? {};
  return {
    netAbs: n(block.profit_total_abs),
    netPct: pct(block.profit_total),
    trades: n(block.total_trades),
    winRatePct: pct(bp.winrate),
    wins: n(bp.wins),
    losses: n(bp.losses),
    profitFactor: n(block.profit_factor),
    sharpe: n(block.sharpe),
    sortino: n(block.sortino),
    expectancy: n(block.expectancy),
    maxDrawdownAbs: n(bp.max_drawdown_abs),
    maxDrawdownPct: pct(bp.max_drawdown_account),
    tradesPerDay: n(block.trades_per_day),
    longCount: n(block.trade_count_long),
    shortCount: n(block.trade_count_short),
    avgStake: n(block.avg_stake_amount),
    volume: n(block.total_volume),
    marketChangePct: pct(block.market_change),
  };
}

export function extractExitReasons(block: StrategyBlock): ExitReason[] {
  return (block.exit_reason_summary ?? [])
    .filter((r) => r.key !== 'TOTAL')
    .map((r) => ({
      key: r.key,
      trades: r.trades,
      profitAbs: r.profit_total_abs,
    }));
}
