export type TimeRange = '1D' | '7D' | '30D' | 'all';
export type BotPhase = 'just-deployed' | 'collecting' | 'mature';
export type FillStatus = 'OPEN' | 'TP1' | 'TP2' | 'SL' | 'BREAKEVEN';
export type FillSide = 'LONG' | 'SHORT';

export interface BotMeta {
  id: string;
  name: string;
  pair: string;             // e.g. "BTC-USDC"
  timeframe: string;        // e.g. "5m"
  exchange: string;         // "hyperliquid"
  mode: 'live' | 'dry-run';
  deployedAt: number;       // epoch ms
}

export interface Fill {
  id: string;
  openedAt: number;
  closedAt: number | null;  // null = still open
  side: FillSide;
  pair: string;
  entryPrice: number;
  exitPrice: number | null;
  pnl: number;              // realized; 0 if open
  status: FillStatus;
  cycleId: number;
}

export interface PerformanceSnapshot {
  totalPnL: number;
  todayPnL: number;
  todayPnLPct: number;
  totalPct: number;
  winRate: number;          // 0..1
  totalTrades: number;
  wins: number;
  losses: number;
  avgRR: number;
  openPositions: number;
  openExposure: number;
  winStreak: number;
  bestDay: number;
  worstDay: number;
}

export interface EquityPoint { t: number; equity: number; }
export interface DailyPnL { date: string; pnl: number; trades: number; }

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
  stages: CycleStage[];
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
  t: number; T: number; o: number; h: number; l: number; c: number; v: number;
}
export interface HLOrderBookLevel { px: number; sz: number; n: number; }
export interface HLOrderBook {
  coin: string;
  time: number;
  levels: [HLOrderBookLevel[], HLOrderBookLevel[]];  // [asks, bids]
}
