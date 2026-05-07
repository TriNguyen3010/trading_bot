import type {
  BotMeta, Fill, PerformanceSnapshot, EquityPoint, DailyPnL, ExecutionCycle, FillStatus, TimeRange
} from './types';

// Deterministic RNG (mulberry32)
function mulberry32(seed: number) {
  return function() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stringHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

function dailySeed(botId: string): number {
  const day = Math.floor(Date.now() / 86_400_000);
  return stringHash(botId + ':' + day);
}

const BTC_BASE = 67_000;

export function generateMockFills(botId: string, deployedAt: number, now: number): Fill[] {
  if (now - deployedAt < 3_600_000) return []; // <1h since deploy → no fills yet

  const rng = mulberry32(dailySeed(botId));
  const fills: Fill[] = [];
  const hoursSinceDeploy = Math.floor((now - deployedAt) / 3_600_000);
  const targetCount = Math.min(200, Math.floor(hoursSinceDeploy * 0.15));

  let cumPrice = BTC_BASE;
  const cycleId = 1000;

  for (let i = 0; i < targetCount; i++) {
    const openedAt = deployedAt + Math.floor((i / targetCount) * (now - deployedAt));
    const durationMs = 5 * 60_000 + Math.floor(rng() * 60 * 60_000);
    const closedAt = openedAt + durationMs;
    const isOpen = i === targetCount - 1 && rng() > 0.5;
    const drift = (rng() - 0.5) * 200;
    cumPrice = Math.max(50_000, Math.min(80_000, cumPrice + drift));
    const entryPrice = Number(cumPrice.toFixed(2));
    const moveBps = (rng() - 0.45) * 30;
    const exitPrice = isOpen ? null : Number((entryPrice * (1 + moveBps / 1000)).toFixed(2));
    const pnl = exitPrice == null ? 0 : Number(((exitPrice - entryPrice) * 0.05).toFixed(2));
    let status: FillStatus;
    if (isOpen) status = 'OPEN';
    else if (pnl > 100) status = 'TP2';
    else if (pnl > 0) status = 'TP1';
    else if (pnl < -10) status = 'SL';
    else status = 'BREAKEVEN';

    fills.push({
      id: `f-${botId}-${i}`,
      openedAt,
      closedAt: isOpen ? null : closedAt,
      side: 'LONG',
      pair: 'BTC-USDC',
      entryPrice,
      exitPrice,
      pnl,
      status,
      cycleId: cycleId + i,
    });
  }
  return fills;
}

export function generateSnapshot(fills: Fill[], now: number): PerformanceSnapshot {
  const closed = fills.filter(f => f.closedAt !== null);
  const open = fills.filter(f => f.closedAt === null);
  const wins = closed.filter(f => f.pnl > 0);
  const losses = closed.filter(f => f.pnl < 0);
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayFills = closed.filter(f => f.closedAt! >= todayStart.getTime());
  const todayPnL = todayFills.reduce((s, f) => s + f.pnl, 0);
  const totalPnL = closed.reduce((s, f) => s + f.pnl, 0);

  let streak = 0;
  for (let i = closed.length - 1; i >= 0; i--) {
    if (closed[i].pnl > 0) streak++;
    else break;
  }

  const byDay = new Map<string, number>();
  closed.forEach(f => {
    const d = new Date(f.closedAt!).toISOString().slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + f.pnl);
  });
  const dailyPnLs = Array.from(byDay.values());

  return {
    totalPnL: Number(totalPnL.toFixed(2)),
    todayPnL: Number(todayPnL.toFixed(2)),
    todayPnLPct: totalPnL > 0 ? Number(((todayPnL / totalPnL) * 100).toFixed(2)) : 0,
    totalPct: Number(((totalPnL / 10_000) * 100).toFixed(2)),
    winRate: closed.length > 0 ? wins.length / closed.length : 0,
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    avgRR: 2.1,
    openPositions: open.length,
    openExposure: open.reduce((s, f) => s + f.entryPrice * 0.05, 0),
    winStreak: streak,
    bestDay: dailyPnLs.length > 0 ? Math.max(...dailyPnLs) : 0,
    worstDay: dailyPnLs.length > 0 ? Math.min(...dailyPnLs) : 0,
  };
}

export function generateEquityCurve(fills: Fill[], range: TimeRange, now: number): EquityPoint[] {
  const closed = fills.filter(f => f.closedAt !== null).sort((a, b) => a.closedAt! - b.closedAt!);
  let cum = 10_000;
  const points: EquityPoint[] = [];
  closed.forEach(f => {
    cum += f.pnl;
    points.push({ t: f.closedAt!, equity: Number(cum.toFixed(2)) });
  });
  const cutoff = range === 'all' ? 0
    : range === '30D' ? now - 30 * 86_400_000
    : range === '7D' ? now - 7 * 86_400_000
    : now - 86_400_000;
  return points.filter(p => p.t >= cutoff);
}

export function generateDailyPnL(fills: Fill[], days: number, now: number): DailyPnL[] {
  const result: DailyPnL[] = [];
  const dayMs = 86_400_000;
  const closed = fills.filter(f => f.closedAt !== null);
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = Math.floor((now - i * dayMs) / dayMs) * dayMs;
    const dayEnd = dayStart + dayMs;
    const dayFills = closed.filter(f => f.closedAt! >= dayStart && f.closedAt! < dayEnd);
    result.push({
      date: new Date(dayStart).toISOString().slice(0, 10),
      pnl: Number(dayFills.reduce((s, f) => s + f.pnl, 0).toFixed(2)),
      trades: dayFills.length,
    });
  }
  return result;
}

export function generateCycle(botId: string, now: number): ExecutionCycle {
  // Each stage stays active for STAGE_MS. Full round of 6 stages = 1.5s
  // (250 × 6) — fast snappy execution rhythm.
  const STAGE_MS = 250;
  const rng = mulberry32(stringHash(botId) + Math.floor(now / STAGE_MS));
  const tick = Math.floor((now / STAGE_MS) % 6);
  const stages = (['scan', 'detect', 'validate', 'size', 'fill', 'settle'] as const).map((id, idx) => ({
    id, label: id[0].toUpperCase() + id.slice(1),
    durationMs: idx === tick ? Math.floor(100 + rng() * 1000)
              : idx < tick ? Math.floor(100 + rng() * 400)
              : 0,
    status: idx === tick ? 'active' as const : idx < tick ? 'done' as const : 'pending' as const,
  }));
  const elapsedMs = stages.reduce((s, st) => s + st.durationMs, 0);
  return {
    cycleId: 1354 + Math.floor(now / STAGE_MS),
    budgetMs: 5400,
    elapsedMs,
    stages,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Mock bot registry — 3 demo bots for the BotsListPage. Any other id
// (e.g. one minted by the Builder Deploy CTA: `bot-${Date.now()}`) falls
// through to the default Bollinger config.
// ──────────────────────────────────────────────────────────────────────
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

interface MockBotEntry extends Omit<BotMeta, 'id' | 'deployedAt'> {
  // Real BE would compute deployedAt from a stored timestamp; we store
  // the offset instead so Date.now() shifts naturally over time and the
  // mock data generator picks up "more history" as the page lives.
  uptimeOffsetMs: number;
}

const BOT_REGISTRY: Record<string, MockBotEntry> = {
  'bot-1': {
    name: 'Bollinger Breakout BTC',
    pair: 'BTC-USDC',
    timeframe: '5m',
    exchange: 'hyperliquid',
    mode: 'dry-run',
    uptimeOffsetMs: 12 * DAY_MS + 4 * HOUR_MS,
  },
  'bot-2': {
    name: 'RSI Reversal ETH',
    pair: 'ETH-USDC',
    timeframe: '15m',
    exchange: 'hyperliquid',
    mode: 'live',
    uptimeOffsetMs: 28 * DAY_MS + 9 * HOUR_MS,
  },
  'bot-3': {
    name: 'MACD Momentum BNB',
    pair: 'BNB-USDC',
    timeframe: '1h',
    exchange: 'hyperliquid',
    mode: 'dry-run',
    uptimeOffsetMs: 6 * DAY_MS + 2 * HOUR_MS,
  },
};

const DEFAULT_BOT: MockBotEntry = BOT_REGISTRY['bot-1'];
export const MOCK_BOT_IDS = Object.keys(BOT_REGISTRY);

function resolveMeta(id: string): BotMeta {
  const entry = BOT_REGISTRY[id] ?? DEFAULT_BOT;
  return {
    id,
    name: entry.name,
    pair: entry.pair,
    timeframe: entry.timeframe,
    exchange: entry.exchange,
    mode: entry.mode,
    deployedAt: Date.now() - entry.uptimeOffsetMs,
  };
}

export interface BotMonitoringApi {
  getBotMeta(id: string): Promise<BotMeta>;
  listBots(): Promise<BotMeta[]>;
  getFills(id: string, deployedAt: number): Promise<Fill[]>;
  getSnapshot(id: string, deployedAt: number): Promise<PerformanceSnapshot>;
  getEquityCurve(id: string, deployedAt: number, range: TimeRange): Promise<EquityPoint[]>;
  getDailyPnL(id: string, deployedAt: number, days: number): Promise<DailyPnL[]>;
  getCycle(id: string): Promise<ExecutionCycle>;
}

export const botApi: BotMonitoringApi = {
  async getBotMeta(id) {
    return resolveMeta(id);
  },
  async listBots() {
    return MOCK_BOT_IDS.map((id) => resolveMeta(id));
  },
  async getFills(id, deployedAt) { return generateMockFills(id, deployedAt, Date.now()); },
  async getSnapshot(id, deployedAt) {
    const fills = generateMockFills(id, deployedAt, Date.now());
    return generateSnapshot(fills, Date.now());
  },
  async getEquityCurve(id, deployedAt, range) {
    const fills = generateMockFills(id, deployedAt, Date.now());
    return generateEquityCurve(fills, range, Date.now());
  },
  async getDailyPnL(id, deployedAt, days) {
    const fills = generateMockFills(id, deployedAt, Date.now());
    return generateDailyPnL(fills, days, Date.now());
  },
  async getCycle(id) { return generateCycle(id, Date.now()); },
};
