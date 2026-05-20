export type TimeRange = '1D' | '7D' | '30D' | 'all';
export type BotPhase = 'just-deployed' | 'collecting' | 'mature';
export type FillStatus = 'OPEN' | 'TP1' | 'TP2' | 'SL' | 'BREAKEVEN';
export type FillSide = 'LONG' | 'SHORT';

export interface BotMeta {
  id: string;
  name: string;
  pair: string; // e.g. "BTC-USDC"
  timeframe: string; // e.g. "5m"
  exchange: string; // "hyperliquid"
  mode: 'live' | 'dry-run';
  deployedAt: number; // epoch ms
}

export interface Fill {
  id: string;
  openedAt: number;
  closedAt: number | null; // null = still open
  side: FillSide;
  pair: string;
  entryPrice: number;
  exitPrice: number | null;
  pnl: number; // realized; 0 if open
  status: FillStatus;
  cycleId: number;
}

export interface PerformanceSnapshot {
  totalPnL: number;
  todayPnL: number;
  todayPnLPct: number; // today's PnL as % of account equity
  totalPct: number; // total return % (totalPnL / initial capital)
  winRate: number; // 0..1, closed trades only
  totalTrades: number;
  wins: number;
  losses: number;
  avgRR: number; // avg risk/reward ratio of closed trades
  openPositions: number;
  openExposure: number;
  winStreak: number;
  bestDay: number;
  worstDay: number;
}

export interface EquityPoint {
  t: number;
  equity: number;
}
export interface DailyPnL {
  date: string;
  pnl: number;
  trades: number;
}

export interface CycleStage {
  id: 'scan' | 'detect' | 'validate' | 'size' | 'fill' | 'settle';
  label: string;
  durationMs: number;
  status: 'pending' | 'done' | 'active';
}
export interface ExecutionCycle {
  cycleId: number;
  budgetMs: number;
  elapsedMs: number;
  stages: CycleStage[]; // must contain all 6 stages in order: scan → detect → validate → size → fill → settle
}

// Hyperliquid types
export interface HLAssetCtx {
  coin: string;
  markPx: number;
  prevDayPx: number;
  dayNtlVlm: number;
  openInterest: number;
  funding: number;
}
export interface HLCandle {
  t: number; // open time (ms)
  T: number; // close time (ms)
  o: number; // open price
  h: number; // high price
  l: number; // low price
  c: number; // close price
  v: number; // volume
}
export interface HLOrderBookLevel {
  px: number;
  sz: number;
  n: number;
}
export interface HLOrderBook {
  coin: string;
  time: number;
  levels: [HLOrderBookLevel[], HLOrderBookLevel[]]; // [asks, bids]
}
