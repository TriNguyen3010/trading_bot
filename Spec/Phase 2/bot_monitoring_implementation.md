# Bot Monitoring · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Bot Monitoring detail page (`/bots/:id`) with 10 sections (Cypheus rail + 9 main) for sếp demo, with FE-mocked bot data + real Hyperliquid market data.

**Architecture:** Single-file React page (`BotMonitoringPage.tsx`) with all sections inline. Reuse existing `src/features/cypheus/` for narrative rail. Real HL public API for market data; seeded RNG mock for bot performance. Service interfaces designed to swap to real BE later.

**Tech Stack:** React 18 · Vite 6 · TypeScript 5.7 · Tailwind 3 · shadcn/ui · Zustand 5 · React Router 7 · Vitest 2 · `lightweight-charts@4.x` (new) · `Press Start 2P` font (new).

**Spec ref:** [Spec/Phase 2/bot_monitoring_plan.md](./bot_monitoring_plan.md)
**Mockup ref:** `.superpowers/brainstorm/29556-1777968579/content/full-mockup.html`
**Branch:** `feat/bot-monitoring` off from `main`

---

## Pre-flight: Branch setup

- [ ] **Step 1: Create branch off main**

```bash
git checkout main
git pull --ff-only
git checkout -b feat/bot-monitoring
```

- [ ] **Step 2: Verify clean state**

```bash
git status
pnpm install
pnpm typecheck
pnpm test
```

Expected: Clean tree · `pnpm typecheck` 0 errors · `pnpm test` all pass.

- [ ] **Step 3: Verify Hyperliquid CORS** (critical pre-check)

In browser console at `localhost:5173`:

```js
fetch('https://api.hyperliquid.xyz/info', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({type: 'metaAndAssetCtxs'})
}).then(r => r.json()).then(d => console.log('HL OK', d.length))
```

Expected: Logs `HL OK 2` (array with [meta, ctxs]). If CORS blocked → STOP and add Vercel edge proxy task before continuing.

---

# Milestone M1 · Skeleton + 3-col shell + Cypheus visible

**PR title**: `feat(monitoring): M1 skeleton + 3-col shell + Cypheus reuse`

## Task 1.1: Add types.ts

**Files:**
- Create: `src/features/bot-monitoring/types.ts`

- [ ] **Step 1: Create types file**

```ts
// src/features/bot-monitoring/types.ts

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
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/bot-monitoring/types.ts
git commit -m "feat(monitoring): add shared types"
```

## Task 1.2: Hyperliquid service skeleton

**Files:**
- Create: `src/features/bot-monitoring/hyperliquid.service.ts`

- [ ] **Step 1: Create service with stub fetcher**

```ts
// src/features/bot-monitoring/hyperliquid.service.ts
import type { HLAssetCtx, HLCandle, HLOrderBook } from './types';

const HL_BASE = 'https://api.hyperliquid.xyz/info';

async function hlFetch<T>(body: object): Promise<T> {
  const res = await fetch(HL_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HL ${res.status}: ${res.statusText}`);
  return res.json();
}

export interface MetaAndAssetCtxs {
  meta: { universe: { name: string; szDecimals: number }[] };
  ctxs: HLAssetCtx[];
}

export interface HyperliquidApi {
  getMetaAndAssetCtxs(): Promise<MetaAndAssetCtxs>;
  getCandleSnapshot(coin: string, interval: '1m' | '5m' | '15m' | '1h' | '1d', startTime: number, endTime: number): Promise<HLCandle[]>;
  getL2Book(coin: string): Promise<HLOrderBook>;
}

export const hlApi: HyperliquidApi = {
  async getMetaAndAssetCtxs() {
    const res = await hlFetch<[any, HLAssetCtx[]]>({ type: 'metaAndAssetCtxs' });
    return { meta: res[0], ctxs: res[1] };
  },
  async getCandleSnapshot(coin, interval, startTime, endTime) {
    return hlFetch<HLCandle[]>({
      type: 'candleSnapshot',
      req: { coin, interval, startTime, endTime },
    });
  },
  async getL2Book(coin) {
    return hlFetch<HLOrderBook>({ type: 'l2Book', coin });
  },
};
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/bot-monitoring/hyperliquid.service.ts
git commit -m "feat(monitoring): add Hyperliquid service client"
```

## Task 1.3: Mock bot data with seeded RNG (TDD)

**Files:**
- Create: `src/features/bot-monitoring/mockBotData.ts`
- Create: `src/features/bot-monitoring/__tests__/mockBotData.test.ts`

- [ ] **Step 1: Write determinism test**

```ts
// src/features/bot-monitoring/__tests__/mockBotData.test.ts
import { describe, it, expect } from 'vitest';
import { generateMockFills, generateSnapshot } from '../mockBotData';

describe('mockBotData', () => {
  const botId = 'bot-1';
  const deployedAt = new Date('2026-04-23T00:00:00Z').getTime();
  const now = new Date('2026-05-05T14:32:00Z').getTime();

  it('produces deterministic fills for same seed', () => {
    const a = generateMockFills(botId, deployedAt, now);
    const b = generateMockFills(botId, deployedAt, now);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('different botId yields different fills', () => {
    const a = generateMockFills('bot-1', deployedAt, now);
    const b = generateMockFills('bot-2', deployedAt, now);
    expect(a[0]?.id).not.toEqual(b[0]?.id);
  });

  it('snapshot reflects fills', () => {
    const fills = generateMockFills(botId, deployedAt, now);
    const snap = generateSnapshot(fills, now);
    expect(snap.totalTrades).toBe(fills.filter(f => f.closedAt !== null).length);
    expect(snap.totalPnL).toBeCloseTo(fills.reduce((s, f) => s + f.pnl, 0), 2);
  });

  it('returns empty fills when bot just deployed', () => {
    const justDeployed = now - 60_000;  // 1m ago
    const fills = generateMockFills(botId, justDeployed, now);
    expect(fills).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify fails**

Run: `pnpm test src/features/bot-monitoring/__tests__/mockBotData.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement mockBotData.ts**

```ts
// src/features/bot-monitoring/mockBotData.ts
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
  // ~3-4 trades per day on average
  const targetCount = Math.min(200, Math.floor(hoursSinceDeploy * 0.15));

  let cumPrice = BTC_BASE;
  let cycleId = 1000;

  for (let i = 0; i < targetCount; i++) {
    const openedAt = deployedAt + Math.floor((i / targetCount) * (now - deployedAt));
    const durationMs = 5 * 60_000 + Math.floor(rng() * 60 * 60_000); // 5m to 1h
    const closedAt = openedAt + durationMs;
    const isOpen = i === targetCount - 1 && rng() > 0.5; // last fill might be open
    const drift = (rng() - 0.5) * 200;
    cumPrice = Math.max(50_000, Math.min(80_000, cumPrice + drift));
    const entryPrice = Number(cumPrice.toFixed(2));
    const moveBps = (rng() - 0.45) * 30; // slight positive bias
    const exitPrice = isOpen ? null : Number((entryPrice * (1 + moveBps / 1000)).toFixed(2));
    const pnl = exitPrice == null ? 0 : Number(((exitPrice - entryPrice) * 0.05).toFixed(2)); // 0.05 BTC size
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

  // win streak: count consecutive wins from latest
  let streak = 0;
  for (let i = closed.length - 1; i >= 0; i--) {
    if (closed[i].pnl > 0) streak++;
    else break;
  }

  // daily PnL aggregation for best/worst day
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
    totalPct: Number(((totalPnL / 10_000) * 100).toFixed(2)), // assume 10k base
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
  // filter by range
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
  const rng = mulberry32(stringHash(botId) + Math.floor(now / 2000));
  const tick = Math.floor((now / 2000) % 6); // active stage rotates
  const stages = (['scan', 'detect', 'validate', 'size', 'fill', 'settle'] as const).map((id, idx) => ({
    id, label: id[0].toUpperCase() + id.slice(1),
    durationMs: idx === tick ? Math.floor(50 + rng() * 500)
              : idx < tick ? Math.floor(50 + rng() * 200)
              : 0,
    status: idx === tick ? 'active' as const : idx < tick ? 'done' as const : 'pending' as const,
  }));
  const elapsedMs = stages.reduce((s, st) => s + st.durationMs, 0);
  return {
    cycleId: 1354 + Math.floor(now / 2000),
    budgetMs: 2700,
    elapsedMs,
    stages,
  };
}

export interface BotMonitoringApi {
  getBotMeta(id: string): Promise<BotMeta>;
  getFills(id: string, deployedAt: number): Promise<Fill[]>;
  getSnapshot(id: string, deployedAt: number): Promise<PerformanceSnapshot>;
  getEquityCurve(id: string, deployedAt: number, range: TimeRange): Promise<EquityPoint[]>;
  getDailyPnL(id: string, deployedAt: number, days: number): Promise<DailyPnL[]>;
  getCycle(id: string): Promise<ExecutionCycle>;
}

export const botApi: BotMonitoringApi = {
  async getBotMeta(id) {
    return {
      id, name: 'Bollinger Breakout BTC', pair: 'BTC-USDC', timeframe: '5m',
      exchange: 'hyperliquid', mode: 'dry-run',
      deployedAt: Date.now() - 12 * 86_400_000 - 4 * 3_600_000,
    };
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
```

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm test src/features/bot-monitoring/__tests__/mockBotData.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/mockBotData.ts src/features/bot-monitoring/__tests__/mockBotData.test.ts
git commit -m "feat(monitoring): add seeded RNG mock bot data + tests"
```

## Task 1.4: Add routes for /bots and /bots/:id

**Files:**
- Create: `src/features/bot-monitoring/BotMonitoringPage.tsx` (skeleton only)
- Create: `src/features/bot-monitoring/BotsListPage.tsx` (skeleton only)
- Modify: `src/routes.tsx`

- [ ] **Step 1: Create page skeletons**

```tsx
// src/features/bot-monitoring/BotMonitoringPage.tsx
import { useParams } from 'react-router-dom';

export function BotMonitoringPage() {
  const { id } = useParams<{ id: string }>();
  return <div className="p-4 text-slate-200">Bot Monitoring: {id}</div>;
}
```

```tsx
// src/features/bot-monitoring/BotsListPage.tsx
export function BotsListPage() {
  return <div className="p-4 text-slate-200">Bots List (M5)</div>;
}
```

- [ ] **Step 2: Read existing routes.tsx**

Run: `cat src/routes.tsx`
Note current structure (1-route SPA → /builder per PROJECT_OVERVIEW §5).

- [ ] **Step 3: Add routes**

Modify `src/routes.tsx`. Add imports + routes:

```tsx
// Add imports near top
import { BotMonitoringPage } from '@/features/bot-monitoring/BotMonitoringPage';
import { BotsListPage } from '@/features/bot-monitoring/BotsListPage';

// Add to routes array (alongside /builder):
{ path: '/bots', element: <BotsListPage /> },
{ path: '/bots/:id', element: <BotMonitoringPage /> },
```

- [ ] **Step 4: Verify typecheck + dev server**

Run: `pnpm typecheck`
Expected: 0 errors.

Run: `pnpm dev` then visit `http://localhost:5173/bots/test-id`
Expected: Page shows "Bot Monitoring: test-id".

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/BotMonitoringPage.tsx src/features/bot-monitoring/BotsListPage.tsx src/routes.tsx
git commit -m "feat(monitoring): wire routes /bots and /bots/:id"
```

## Task 1.5: Add Press Start 2P font

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add Google Font link**

In `index.html` `<head>`, add (with font-display: swap fallback):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Add Tailwind font family extension**

Modify `tailwind.config.ts`:

```ts
// In theme.extend.fontFamily (add if absent):
fontFamily: {
  pixel: ['"Press Start 2P"', 'monospace'],
}
```

- [ ] **Step 3: Test font in browser**

Run: `pnpm dev`. Visit `/bots/test-id`, temporarily add `<div className="font-pixel text-2xl">PIXEL TEST</div>` to BotMonitoringPage, verify pixelated rendering. Remove temp div.

- [ ] **Step 4: Commit**

```bash
git add index.html tailwind.config.ts
git commit -m "feat(monitoring): add Press Start 2P font for hero"
```

## Task 1.6: Extend Cypheus store with `mode` field

**Files:**
- Modify: `src/features/cypheus/store/cypheus.store.ts`

- [ ] **Step 1: Read existing Cypheus store**

Run: `cat src/features/cypheus/store/cypheus.store.ts`
Note current state shape.

- [ ] **Step 2: Add `mode` field (backward-compatible)**

Add to state interface and store:

```ts
// In state interface:
mode: 'builder' | 'monitoring';

// In setter actions, add:
setMode: (mode: 'builder' | 'monitoring') => void;

// In useCypheusStore implementation:
mode: 'builder', // default
setMode: (mode) => set({ mode }),
```

- [ ] **Step 3: Verify existing usage still works**

Run: `pnpm typecheck`
Expected: 0 errors. Existing Builder usage unaffected (mode defaults to 'builder').

Run: `pnpm test`
Expected: existing Cypheus tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/cypheus/store/cypheus.store.ts
git commit -m "feat(cypheus): add mode field for monitoring vs builder"
```

## Task 1.7: 3-col shell + IdentityBar + HeroPnL inline

**Files:**
- Modify: `src/features/bot-monitoring/BotMonitoringPage.tsx`

- [ ] **Step 1: Implement 3-col shell with IdentityBar + HeroPnL**

Replace skeleton:

```tsx
// src/features/bot-monitoring/BotMonitoringPage.tsx
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { botApi } from './mockBotData';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';
import type { BotMeta, PerformanceSnapshot } from './types';

// === Hooks (inline) ===
function useBotMeta(id: string) {
  const [meta, setMeta] = useState<BotMeta | null>(null);
  useEffect(() => { botApi.getBotMeta(id).then(setMeta); }, [id]);
  return meta;
}

function useSnapshot(id: string, deployedAt: number | undefined) {
  const [snap, setSnap] = useState<PerformanceSnapshot | null>(null);
  useEffect(() => {
    if (deployedAt == null) return;
    botApi.getSnapshot(id, deployedAt).then(setSnap);
  }, [id, deployedAt]);
  return snap;
}

// === Sections (inline) ===
function IdentityBar({ meta }: { meta: BotMeta }) {
  const uptime = Math.floor((Date.now() - meta.deployedAt) / 86_400_000);
  return (
    <div className="flex justify-between items-center bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm">
      <div className="flex items-center gap-2 text-slate-400">
        <span className="text-slate-100 font-semibold">{meta.name}</span>
        <span className="bg-amber-950 text-amber-400 px-2 py-0.5 rounded-full text-xs uppercase tracking-wide font-semibold">
          {meta.mode}
        </span>
        <span className="text-slate-600">·</span>
        <code className="text-teal-300">{meta.pair}</code>
        <span className="text-slate-600">·</span>
        <span>{meta.timeframe}</span>
        <span className="text-slate-600">·</span>
        <span>Running {uptime}d</span>
      </div>
      <div className="flex gap-1.5">
        <span className="bg-teal-700 text-white px-2 py-0.5 rounded-full text-xs uppercase font-semibold">● Live</span>
        <button className="border border-slate-600 text-slate-300 px-2.5 py-1 rounded text-xs">⏸ Pause</button>
        <button className="border border-amber-900 text-amber-400 px-2.5 py-1 rounded text-xs">⏹ Stop</button>
        <button className="border border-slate-600 text-slate-300 px-2.5 py-1 rounded text-xs">✎ Edit</button>
      </div>
    </div>
  );
}

function HeroPnL({ snap }: { snap: PerformanceSnapshot }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-6 bg-slate-950/80 border border-slate-800 rounded-xl p-7 relative overflow-hidden">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500 mb-3">
          Today · Realized PnL
        </div>
        <div className="font-pixel text-5xl text-rose-400" style={{textShadow:'0 0 30px rgba(248,113,113,0.4)'}}>
          ${snap.todayPnL >= 0 ? '+' : ''}{snap.todayPnL.toLocaleString()}
        </div>
        <div className="flex gap-4 mt-4 text-sm text-slate-400">
          <span><span className="text-emerald-400">▲</span> {snap.totalTrades} trades</span>
          <span className="text-slate-600">·</span>
          <span className="text-emerald-400 font-bold">{(snap.winRate * 100).toFixed(1)}% win</span>
          <span className="text-slate-600">·</span>
          <span>{snap.openPositions} open</span>
        </div>
      </div>
      <WinStreakGauge streak={snap.winStreak} />
    </div>
  );
}

function WinStreakGauge({ streak }: { streak: number }) {
  const pct = Math.min(streak / 15, 1);
  const dash = pct * 264;
  return (
    <div className="flex flex-col items-center justify-center w-32">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="4"/>
        <circle cx="50" cy="50" r="42" fill="none" stroke="#f87171" strokeWidth="4"
          strokeDasharray={`${dash} 264`} strokeDashoffset="0"
          transform="rotate(-90 50 50)" strokeLinecap="round"
          style={{filter:'drop-shadow(0 0 6px rgba(248,113,113,0.6))'}}/>
      </svg>
      <div className="font-pixel text-3xl text-rose-400 -mt-[72px]">{streak}</div>
      <div className="mt-8 text-[9px] uppercase tracking-widest text-slate-500 text-center leading-relaxed">
        <b className="text-rose-400">Win Streak</b><br/>Next in 4m
      </div>
    </div>
  );
}

function CypheusRail() {
  const collapsed = useLayoutPrefsStore(s => s.leftPanelCollapsed);
  // Placeholder for now — actual narrative wired in M3
  return (
    <aside className={`bg-slate-950 border-r border-slate-800 p-3 ${collapsed ? 'w-12' : 'w-60'} sticky top-0 h-screen`}>
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
        <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-sky-500 rounded-lg flex items-center justify-center text-white font-bold">
          C
        </div>
        {!collapsed && (
          <div>
            <h4 className="text-sm text-slate-100 font-semibold m-0">Cypheus</h4>
            <small className="text-xs text-teal-300">● Watching bot</small>
          </div>
        )}
      </div>
      {!collapsed && (
        <div className="mt-3 p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300">
          <div className="text-teal-300 text-[10px] uppercase tracking-wide mb-1">📡 Welcome</div>
          Bot monitoring view ready. (Narrative wired in M3.)
        </div>
      )}
    </aside>
  );
}

// === Main page ===
export function BotMonitoringPage() {
  const { id = '' } = useParams<{ id: string }>();
  const meta = useBotMeta(id);
  const snap = useSnapshot(id, meta?.deployedAt);

  if (!meta || !snap) return <div className="p-4 text-slate-400">Loading…</div>;

  return (
    <div className="grid grid-cols-[auto_1fr_280px] min-h-screen bg-slate-950">
      <CypheusRail />
      <main className="p-4 flex flex-col gap-3 min-w-0">
        <IdentityBar meta={meta} />
        <HeroPnL snap={snap} />
        <div className="border border-dashed border-slate-800 rounded-lg p-12 text-center text-slate-600 text-xs">
          [ Heatmap · PnL Curve · OrderBook · LiveSpotFeed · Pipeline · Recent Fills — coming in M2/M3/M4 ]
        </div>
      </main>
      <aside className="p-4 pl-0">
        <div className="border border-dashed border-slate-800 rounded-lg p-12 text-center text-slate-600 text-xs">
          [ Hyperliquid Markets — M4 ]
        </div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck + dev**

Run: `pnpm typecheck` → 0 errors.
Run: `pnpm dev`, visit `/bots/bot-1` → see 3-col shell with IdentityBar + Hero rendered.

Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add src/features/bot-monitoring/BotMonitoringPage.tsx
git commit -m "feat(monitoring): M1 shell + IdentityBar + HeroPnL + Cypheus rail placeholder"
```

## Task 1.8: M1 verification + PR

- [ ] **Step 1: Run all gates**

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Expected: all pass, build succeeds.

- [ ] **Step 2: Push branch**

```bash
git push -u origin feat/bot-monitoring
```

- [ ] **Step 3: Open PR**

```bash
gh pr create --title "feat(monitoring): M1 skeleton + 3-col shell + Cypheus reuse" --body "$(cat <<'EOF'
## Summary
- Routes `/bots` and `/bots/:id` wired
- 3-col shell layout (Cypheus rail · main · sidebar placeholder)
- IdentityBar + HeroPnL with seeded mock data
- Press Start 2P font for hero number
- Cypheus store extended with `mode` field (backward-compatible with Builder)
- HL service skeleton + types

## Test plan
- [ ] Navigate /bots/bot-1 → page renders without errors
- [ ] Hero number is pixelated (Press Start 2P loaded)
- [ ] Cypheus rail collapses/expands via existing layout-prefs store
- [ ] Builder still works (Cypheus mode='builder' default)
EOF
)"
```

---

# Milestone M2 · Charts (Equity Curve + Live Spot Feed)

**PR title**: `feat(monitoring): M2 charts (equity + HL kline)`

## Task 2.1: Install lightweight-charts

- [ ] **Step 1: Install dep**

```bash
pnpm add lightweight-charts@^4.2.0
```

- [ ] **Step 2: Verify install**

Run: `pnpm typecheck`
Expected: 0 errors (no usage yet).

- [ ] **Step 3: Commit lockfile**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add lightweight-charts@4.2 for monitoring charts"
```

## Task 2.2: useHyperliquidCandles hook (TDD-light)

**Files:**
- Modify: `src/features/bot-monitoring/BotMonitoringPage.tsx` (add inline hook)

- [ ] **Step 1: Add hook above sections**

In BotMonitoringPage.tsx, add after existing hooks:

```tsx
// Cache for HL candles (in-module, simple)
const candleCache = new Map<string, { data: HLCandle[]; ts: number }>();

function useHyperliquidCandles(coin: string, interval: '1m'|'5m'|'15m'|'1h'|'1d', enabled = true) {
  const [candles, setCandles] = useState<HLCandle[]>([]);
  useEffect(() => {
    if (!enabled || !coin) return;
    const key = `${coin}:${interval}`;
    const cached = candleCache.get(key);
    if (cached && Date.now() - cached.ts < 30_000) {
      setCandles(cached.data);
      return;
    }
    const now = Date.now();
    const startTime = now - 4 * 60 * 60 * 1000; // last 4h
    hlApi.getCandleSnapshot(coin, interval, startTime, now).then(data => {
      candleCache.set(key, { data, ts: Date.now() });
      setCandles(data);
    }).catch(err => console.warn('HL candle fetch failed:', err));
    const t = setInterval(() => {
      hlApi.getCandleSnapshot(coin, interval, startTime, Date.now()).then(data => {
        candleCache.set(key, { data, ts: Date.now() });
        setCandles(data);
      }).catch(err => console.warn('HL candle refresh:', err));
    }, 30_000);
    return () => clearInterval(t);
  }, [coin, interval, enabled]);
  return candles;
}
```

Add imports at top:
```tsx
import { hlApi } from './hyperliquid.service';
import type { HLCandle } from './types';
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck` → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/bot-monitoring/BotMonitoringPage.tsx
git commit -m "feat(monitoring): add useHyperliquidCandles hook with caching"
```

## Task 2.3: LiveSpotFeed inline section

**Files:**
- Modify: `src/features/bot-monitoring/BotMonitoringPage.tsx`

- [ ] **Step 1: Add LiveSpotFeed component using lightweight-charts**

Add section component after HeroPnL:

```tsx
import { createChart, CandlestickSeries, LineSeries, type IChartApi } from 'lightweight-charts';
import { useRef } from 'react';

function LiveSpotFeed({ coin, candles, fills }: {
  coin: string; candles: HLCandle[]; fills: Fill[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      timeScale: { borderColor: '#1e293b' },
      rightPriceScale: { borderColor: '#1e293b' },
      width: containerRef.current.clientWidth,
      height: 220,
    });
    chartRef.current = chart;
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#34d399', downColor: '#f87171',
      wickUpColor: '#34d399', wickDownColor: '#f87171',
      borderVisible: false,
    });
    series.setData(candles.map(c => ({
      time: Math.floor(c.t / 1000) as any,
      open: c.o, high: c.h, low: c.l, close: c.c,
    })));
    // Entry markers from fills
    series.setMarkers(fills.slice(-10).map(f => ({
      time: Math.floor(f.openedAt / 1000) as any,
      position: 'belowBar' as const,
      color: '#34d399',
      shape: 'arrowUp' as const,
      text: f.side,
    })));
    chart.timeScale().fitContent();
    const onResize = () => chart.applyOptions({ width: containerRef.current!.clientWidth });
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); chart.remove(); };
  }, [candles, fills]);

  const lastClose = candles[candles.length - 1]?.c ?? 0;
  const firstOpen = candles[0]?.o ?? 0;
  const pct = firstOpen > 0 ? ((lastClose - firstOpen) / firstOpen) * 100 : 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3 text-xs uppercase tracking-wide text-slate-500">
        <span>
          <span className="text-rose-400 border border-rose-950 bg-rose-950/30 px-1.5 py-0.5 rounded text-[10px] mr-2">● LIVE</span>
          {coin} · 5m · Market Data
        </span>
        <span className="text-slate-100 text-sm font-semibold normal-case tracking-normal">
          ${lastClose.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
          <span className={pct >= 0 ? 'text-emerald-400' : 'text-rose-400'} style={{fontSize:'11px'}}>
            {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
          </span>
        </span>
      </div>
      <div ref={containerRef} style={{ height: 220 }} />
    </div>
  );
}
```

Add import: `import type { Fill } from './types';`

- [ ] **Step 2: Add to page**

In `BotMonitoringPage()`, add hook + render. Before placeholder div:

```tsx
const candles = useHyperliquidCandles('BTC', '5m');
const [fills, setFills] = useState<Fill[]>([]);
useEffect(() => {
  if (!meta) return;
  botApi.getFills(meta.id, meta.deployedAt).then(setFills);
}, [meta]);

// In JSX, replace placeholder div with:
<LiveSpotFeed coin="BTC" candles={candles} fills={fills} />
```

- [ ] **Step 3: Verify dev**

Run: `pnpm dev`, visit `/bots/bot-1`.
Expected: real BTC 5m candlestick from Hyperliquid renders. Entry markers visible.

Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/features/bot-monitoring/BotMonitoringPage.tsx
git commit -m "feat(monitoring): add LiveSpotFeed with HL kline data"
```

## Task 2.4: EquityCurve inline section

**Files:**
- Modify: `src/features/bot-monitoring/BotMonitoringPage.tsx`

- [ ] **Step 1: Add EquityCurve component**

```tsx
import { LineSeries, AreaSeries } from 'lightweight-charts';

function EquityCurve({ data, range, onRangeChange }: {
  data: EquityPoint[]; range: TimeRange; onRangeChange: (r: TimeRange) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { color: '#0f172a' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
      timeScale: { borderColor: '#1e293b' },
      rightPriceScale: { borderColor: '#1e293b' },
      width: containerRef.current.clientWidth,
      height: 160,
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: '#34d399',
      topColor: 'rgba(52, 211, 153, 0.3)',
      bottomColor: 'rgba(52, 211, 153, 0)',
      lineWidth: 2,
    });
    series.setData(data.map(p => ({
      time: Math.floor(p.t / 1000) as any,
      value: p.equity,
    })));
    chart.timeScale().fitContent();
    const onResize = () => chart.applyOptions({ width: containerRef.current!.clientWidth });
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); chart.remove(); };
  }, [data]);

  const ranges: TimeRange[] = ['1D', '7D', '30D', 'all'];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3 text-xs uppercase tracking-wide text-slate-500">
        <span>PnL Curve</span>
        <div className="flex gap-1 bg-slate-950 p-0.5 rounded">
          {ranges.map(r => (
            <button key={r} onClick={() => onRangeChange(r)}
              className={`px-2 py-0.5 rounded text-[11px] ${r === range ? 'bg-teal-700 text-white' : 'text-slate-500'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div ref={containerRef} style={{ height: 160 }} />
    </div>
  );
}
```

Add imports: `import type { EquityPoint, TimeRange } from './types';`

- [ ] **Step 2: Wire in page**

```tsx
const [range, setRange] = useState<TimeRange>('30D');
const [equity, setEquity] = useState<EquityPoint[]>([]);
useEffect(() => {
  if (!meta) return;
  botApi.getEquityCurve(meta.id, meta.deployedAt, range).then(setEquity);
}, [meta, range]);

// Add EquityCurve before LiveSpotFeed in JSX:
<EquityCurve data={equity} range={range} onRangeChange={setRange} />
```

- [ ] **Step 3: Verify dev**

`pnpm dev`. Expected: equity curve renders, range tabs switch data. Stop server.

- [ ] **Step 4: Commit**

```bash
git add src/features/bot-monitoring/BotMonitoringPage.tsx
git commit -m "feat(monitoring): add EquityCurve with timeframe tabs"
```

## Task 2.5: useBotMaturity hook

**Files:**
- Modify: `src/features/bot-monitoring/BotMonitoringPage.tsx`

- [ ] **Step 1: Add hook + helper**

```tsx
function computeBotPhase(deployedAt: number, totalTrades: number): BotPhase {
  const hours = (Date.now() - deployedAt) / 3_600_000;
  if (hours < 24 || totalTrades === 0) return 'just-deployed';
  if (hours < 24 * 14) return 'collecting';
  return 'mature';
}

function useBotMaturity(deployedAt: number | undefined, totalTrades: number) {
  return deployedAt ? computeBotPhase(deployedAt, totalTrades) : 'just-deployed';
}
```

Add import: `import type { BotPhase } from './types';`

- [ ] **Step 2: Use in page**

```tsx
const phase = useBotMaturity(meta?.deployedAt, snap?.totalTrades ?? 0);
// Pass `phase` prop to sections that need it (M3+)
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/bot-monitoring/BotMonitoringPage.tsx
git commit -m "feat(monitoring): add useBotMaturity hook"
```

## Task 2.6: M2 verification + PR

- [ ] **Step 1: Run gates + push**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git push
```

- [ ] **Step 2: Open M2 PR**

```bash
gh pr create --title "feat(monitoring): M2 charts (equity + HL kline)" --body "$(cat <<'EOF'
## Summary
- Install lightweight-charts@4.2
- LiveSpotFeed renders real BTC 5m candles from Hyperliquid
- EquityCurve renders mock cumulative PnL with timeframe tabs
- useBotMaturity hook computes 'just-deployed'|'collecting'|'mature'

## Test plan
- [ ] /bots/bot-1 shows real candles + equity curve
- [ ] Switch range tabs → equity reflows
- [ ] No console errors
EOF
)"
```

---

# Milestone M3 · Heatmap + Pipeline + RecentFills + Cypheus narrative

**PR title**: `feat(monitoring): M3 heatmap + pipeline + fills + Cypheus narrative`

## Task 3.1: ActivityHeatmap section

**Files:**
- Modify: `src/features/bot-monitoring/BotMonitoringPage.tsx`

- [ ] **Step 1: Add ActivityHeatmap component**

```tsx
function colorForPnL(pnl: number, max: number, min: number): string {
  if (Math.abs(pnl) < 1) return '#1e293b';
  if (pnl > 0) {
    const t = pnl / Math.max(max, 1);
    if (t > 0.7) return '#34d399';
    if (t > 0.4) return '#10b981';
    return '#fbbf24';
  } else {
    const t = pnl / Math.min(min, -1);
    if (t > 0.7) return '#7f1d1d';
    if (t > 0.4) return '#dc2626';
    return '#f59e0b';
  }
}

function ActivityHeatmap({ daily, total, best, worst }: {
  daily: DailyPnL[]; total: number; best: number; worst: number;
}) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
      <div className="flex justify-between items-center mb-2 text-[11px] uppercase tracking-wide text-slate-500">
        <span>BTC-USDC · 47-Day All-Time</span>
        <span className="text-slate-300 normal-case tracking-normal text-xs">
          Total <b className="text-emerald-400">${total.toFixed(0)}</b> ·
          Best <b className="text-emerald-400">${best.toFixed(0)}</b> ·
          Worst <b className="text-rose-400">${worst.toFixed(0)}</b>
        </span>
      </div>
      <div className="grid grid-cols-[repeat(47,1fr)] gap-[3px] h-8">
        {daily.map((d, i) => (
          <div key={d.date}
            title={`${d.date}: $${d.pnl.toFixed(2)} (${d.trades} trades)`}
            className="rounded-sm transition-transform hover:scale-150 cursor-pointer"
            style={{
              background: colorForPnL(d.pnl, best, worst),
              boxShadow: i === daily.length - 1 ? '0 0 8px #34d399' : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

Add import: `import type { DailyPnL } from './types';`

- [ ] **Step 2: Wire in page**

```tsx
const [daily, setDaily] = useState<DailyPnL[]>([]);
useEffect(() => {
  if (!meta) return;
  botApi.getDailyPnL(meta.id, meta.deployedAt, 47).then(setDaily);
}, [meta]);

// In JSX, after HeroPnL, before EquityCurve:
{phase === 'mature' && (
  <ActivityHeatmap daily={daily} total={snap.totalPnL} best={snap.bestDay} worst={snap.worstDay} />
)}
```

- [ ] **Step 3: Verify dev** — heatmap renders 47 colored cells, hover tooltip works.

- [ ] **Step 4: Commit**

```bash
git add src/features/bot-monitoring/BotMonitoringPage.tsx
git commit -m "feat(monitoring): add ActivityHeatmap full mode"
```

## Task 3.2: ExecutionPipeline section

**Files:**
- Modify: `src/features/bot-monitoring/BotMonitoringPage.tsx`

- [ ] **Step 1: Add ExecutionPipeline component**

```tsx
function ExecutionPipeline({ cycle }: { cycle: ExecutionCycle }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
      <div className="flex justify-between items-center mb-2 text-[10px] uppercase tracking-wide text-slate-500">
        <span>
          <span className="text-teal-300">● Execution Cycle</span>
          <span className="text-slate-600 mx-2">·</span>
          Cycle <b className="text-slate-300">#{cycle.cycleId}</b>
        </span>
        <span>
          Budget <b className="text-slate-300">{(cycle.budgetMs/1000).toFixed(1)}s</b> ·
          Elapsed <b className="text-teal-300">{(cycle.elapsedMs/1000).toFixed(2)}s</b>
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cycle.stages.map((s, i) => (
          <div key={s.id}
            className={`rounded p-2 ${
              s.status === 'active' ? 'bg-emerald-950 border border-teal-500' :
              s.status === 'done' ? 'bg-emerald-950/60 border border-teal-900' :
              'bg-slate-800 border border-slate-700'
            }`}
            style={s.status === 'active' ? { boxShadow: '0 0 16px rgba(20,184,166,0.4)' } : undefined}>
            <div className={`text-[8px] tracking-widest ${
              s.status === 'active' ? 'text-teal-300' :
              s.status === 'done' ? 'text-emerald-400' : 'text-slate-500'
            }`}>{String(i+1).padStart(2,'0')}{s.status === 'active' ? ' ACT' : ''}</div>
            <div className="text-[11px] font-semibold text-slate-100 my-0.5">{s.label}</div>
            <div className={`text-[11px] font-bold ${
              s.status === 'active' ? 'text-teal-300' :
              s.status === 'done' ? 'text-emerald-400' : 'text-slate-500'
            }`}>
              {s.durationMs > 0 ? `${s.durationMs}ms` : '—'}
            </div>
          </div>
        ))}
        <div className="rounded p-2 bg-amber-950 border border-amber-900">
          <div className="text-[8px] tracking-widest text-amber-300">FILL</div>
          <div className="text-[11px] font-semibold text-amber-300 my-0.5">{(cycle.elapsedMs/1000).toFixed(2)}s</div>
          <div className="text-[10px] text-amber-200">UNDER</div>
        </div>
      </div>
    </div>
  );
}
```

Add import: `import type { ExecutionCycle } from './types';`

- [ ] **Step 2: Wire in page with periodic refresh**

```tsx
const [cycle, setCycle] = useState<ExecutionCycle | null>(null);
useEffect(() => {
  if (!meta) return;
  const tick = () => botApi.getCycle(meta.id).then(setCycle);
  tick();
  const t = setInterval(tick, 500);
  return () => clearInterval(t);
}, [meta]);

// In JSX after LiveSpotFeed:
{cycle && <ExecutionPipeline cycle={cycle} />}
```

- [ ] **Step 3: Verify dev** — Pipeline renders, active stage glows pulsing, cycles every ~2s.

- [ ] **Step 4: Commit**

```bash
git add src/features/bot-monitoring/BotMonitoringPage.tsx
git commit -m "feat(monitoring): add ExecutionPipeline with cycle animation"
```

## Task 3.3: RecentFills section

**Files:**
- Modify: `src/features/bot-monitoring/BotMonitoringPage.tsx`

- [ ] **Step 1: Add RecentFills component**

```tsx
function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.floor(diff/1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff/60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff/3_600_000)}h`;
  return `${Math.floor(diff/86_400_000)}d`;
}

function RecentFills({ fills }: { fills: Fill[] }) {
  const recent = fills.slice(-7).reverse();
  const lastHrPnL = fills
    .filter(f => f.closedAt && Date.now() - f.closedAt < 3_600_000)
    .reduce((s, f) => s + f.pnl, 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3 text-xs uppercase tracking-wide text-slate-500">
        <span>
          <span className="text-rose-400 border border-rose-950 bg-rose-950/30 px-1.5 py-0.5 rounded text-[10px] mr-2">● LIVE</span>
          Recent Fills · BTC-USDC
        </span>
        <span className={`normal-case tracking-normal ${lastHrPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {lastHrPnL >= 0 ? '▲' : '▼'} ${Math.abs(lastHrPnL).toFixed(2)} last hr
        </span>
      </div>
      <table className="w-full text-xs">
        <tbody>
          {recent.map(f => (
            <tr key={f.id} className={`border-b border-slate-900 ${f.status === 'OPEN' ? 'border-l-2 border-l-rose-500' : ''}`}>
              <td className="p-2 text-slate-400 text-[11px]">
                {f.status === 'OPEN'
                  ? <span className="text-amber-300 border border-amber-900 bg-amber-950/30 px-1.5 py-0.5 rounded text-[9px]">PENDING</span>
                  : timeAgo(f.closedAt!)}
              </td>
              <td className="p-2 text-slate-300">
                <span className="bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded text-[11px]">{f.side}</span>{' '}
                <b>{f.pair}</b> · 5m
              </td>
              <td className="p-2 text-slate-400 text-[11px]">
                {new Date(f.openedAt).toLocaleTimeString().slice(0, 5)} · {f.entryPrice.toLocaleString()}
                {f.exitPrice ? <> <span className="text-slate-600">→</span> {f.exitPrice.toLocaleString()}</> : ' → live'}
              </td>
              <td className="p-2 text-right">
                {f.status === 'OPEN'
                  ? <b className="text-amber-300">FILLING…</b>
                  : <>
                      <span className={f.pnl >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                        {f.pnl >= 0 ? '+' : ''}${f.pnl.toFixed(2)}
                      </span>{' '}
                      <span className={`${
                        f.status === 'TP1' || f.status === 'TP2' ? 'bg-emerald-950 text-emerald-300' :
                        f.status === 'SL' ? 'bg-rose-950 text-rose-300' : 'bg-slate-800 text-slate-300'
                      } px-1.5 py-0.5 rounded text-[10px]`}>{f.status}</span>
                    </>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-center text-slate-500 text-[11px] mt-2 pt-2 border-t border-slate-800 cursor-pointer">
        View all {fills.length} trades →
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire in page** — add `<RecentFills fills={fills} />` after Pipeline.

- [ ] **Step 3: Verify dev** — fills table renders 7 rows, latest with pending state if open.

- [ ] **Step 4: Commit**

```bash
git add src/features/bot-monitoring/BotMonitoringPage.tsx
git commit -m "feat(monitoring): add RecentFills table"
```

## Task 3.4: cypheusEvents.ts logic (TDD)

**Files:**
- Create: `src/features/bot-monitoring/cypheusEvents.ts`
- Create: `src/features/bot-monitoring/__tests__/cypheusEvents.test.ts`

- [ ] **Step 1: Write tests**

```ts
// src/features/bot-monitoring/__tests__/cypheusEvents.test.ts
import { describe, it, expect } from 'vitest';
import { generateEventNarrations } from '../cypheusEvents';
import type { Fill, PerformanceSnapshot, BotPhase } from '../types';

const baseSnap: PerformanceSnapshot = {
  totalPnL: 1000, todayPnL: 100, todayPnLPct: 10, totalPct: 10,
  winRate: 0.6, totalTrades: 10, wins: 6, losses: 4, avgRR: 2.1,
  openPositions: 0, openExposure: 0, winStreak: 5, bestDay: 200, worstDay: -50,
};

describe('cypheusEvents', () => {
  it('emits scanning when phase=just-deployed', () => {
    const msgs = generateEventNarrations({
      prevSnap: null, nextSnap: baseSnap,
      prevFills: [], nextFills: [],
      phase: 'just-deployed',
    });
    expect(msgs.some(m => m.type === 'scan')).toBe(true);
  });

  it('emits position.opened on new OPEN fill', () => {
    const fill: Fill = {
      id: 'f1', openedAt: Date.now(), closedAt: null, side: 'LONG',
      pair: 'BTC-USDC', entryPrice: 67000, exitPrice: null, pnl: 0,
      status: 'OPEN', cycleId: 1,
    };
    const msgs = generateEventNarrations({
      prevSnap: baseSnap, nextSnap: baseSnap,
      prevFills: [], nextFills: [fill],
      phase: 'mature',
    });
    expect(msgs.some(m => m.type === 'position-opened' && m.text.includes('67,000'))).toBe(true);
  });

  it('emits tp_hit when fill closes profitable', () => {
    const fill: Fill = {
      id: 'f2', openedAt: Date.now() - 10000, closedAt: Date.now(), side: 'LONG',
      pair: 'BTC-USDC', entryPrice: 67000, exitPrice: 67300, pnl: 150,
      status: 'TP1', cycleId: 2,
    };
    const msgs = generateEventNarrations({
      prevSnap: baseSnap, nextSnap: { ...baseSnap, totalPnL: 1150 },
      prevFills: [{ ...fill, closedAt: null, exitPrice: null, status: 'OPEN', pnl: 0 }],
      nextFills: [fill],
      phase: 'mature',
    });
    expect(msgs.some(m => m.type === 'tp-hit' && m.text.includes('150'))).toBe(true);
  });

  it('emits streak-milestone when streak reaches new high', () => {
    const msgs = generateEventNarrations({
      prevSnap: { ...baseSnap, winStreak: 11 },
      nextSnap: { ...baseSnap, winStreak: 12 },
      prevFills: [], nextFills: [],
      phase: 'mature',
    });
    expect(msgs.some(m => m.type === 'streak-milestone' && m.text.includes('12'))).toBe(true);
  });

  it('emits anomaly on 3+ consecutive losses', () => {
    const losses: Fill[] = Array.from({length: 3}).map((_, i) => ({
      id: `l${i}`, openedAt: Date.now() - i*1000, closedAt: Date.now() - i*500,
      side: 'LONG' as const, pair: 'BTC-USDC',
      entryPrice: 67000, exitPrice: 66900, pnl: -50, status: 'SL' as const, cycleId: i,
    }));
    const msgs = generateEventNarrations({
      prevSnap: baseSnap, nextSnap: baseSnap,
      prevFills: [], nextFills: losses,
      phase: 'mature',
    });
    expect(msgs.some(m => m.type === 'anomaly')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, verify fails**

Run: `pnpm test src/features/bot-monitoring/__tests__/cypheusEvents.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement cypheusEvents.ts**

```ts
// src/features/bot-monitoring/cypheusEvents.ts
import type { Fill, PerformanceSnapshot, BotPhase } from './types';

export type CypheusEventType =
  | 'scan' | 'position-opened' | 'tp-hit' | 'sl-hit'
  | 'streak-milestone' | 'anomaly' | 'pnl-milestone' | 'idle';

export interface CypheusMessage {
  id: string;
  type: CypheusEventType;
  text: string;
  ts: number;
}

interface Input {
  prevSnap: PerformanceSnapshot | null;
  nextSnap: PerformanceSnapshot;
  prevFills: Fill[];
  nextFills: Fill[];
  phase: BotPhase;
}

export function generateEventNarrations(input: Input): CypheusMessage[] {
  const { prevSnap, nextSnap, prevFills, nextFills, phase } = input;
  const msgs: CypheusMessage[] = [];
  const now = Date.now();
  let counter = 0;
  const mk = (type: CypheusEventType, text: string): CypheusMessage =>
    ({ id: `cy-${now}-${counter++}`, type, text, ts: now });

  // 1. Scanning state
  if (phase === 'just-deployed') {
    msgs.push(mk('scan', 'Scanning markets · est. first signal in 1–3h'));
    msgs.push(mk('scan', "I'll watch BB upper band cross + RSI <70 for you."));
    return msgs;
  }

  // 2. New positions opened
  const prevOpenIds = new Set(prevFills.filter(f => f.status === 'OPEN').map(f => f.id));
  for (const f of nextFills) {
    if (f.status === 'OPEN' && !prevOpenIds.has(f.id)) {
      msgs.push(mk('position-opened',
        `Just opened ${f.side} @ ${f.entryPrice.toLocaleString()} · stop at ${(f.entryPrice * 0.997).toLocaleString(undefined, {maximumFractionDigits: 0})}`));
    }
  }

  // 3. TP/SL closures
  const prevById = new Map(prevFills.map(f => [f.id, f]));
  for (const f of nextFills) {
    const prev = prevById.get(f.id);
    if (prev && prev.status === 'OPEN' && f.status !== 'OPEN') {
      if (f.pnl > 0) {
        msgs.push(mk('tp-hit', `${f.status} hit! +$${f.pnl.toFixed(2)}${f.status === 'TP2' ? ' — best trade today.' : ' · entry conditions met cleanly.'}`));
      } else {
        msgs.push(mk('sl-hit', `SL hit · -$${Math.abs(f.pnl).toFixed(2)}.`));
      }
    }
  }

  // 4. Streak milestone (new high)
  if (prevSnap && nextSnap.winStreak > prevSnap.winStreak && nextSnap.winStreak >= 5) {
    msgs.push(mk('streak-milestone', `Win streak ${nextSnap.winStreak} · personal best! 🎯`));
  }

  // 5. Anomaly: 3+ SL in last 5 closed trades
  const lastClosed = nextFills.filter(f => f.closedAt !== null).slice(-5);
  const slCount = lastClosed.filter(f => f.status === 'SL').length;
  if (slCount >= 3) {
    msgs.push(mk('anomaly', `${slCount} SL hits in last ${lastClosed.length} trades · maybe revisit your stop level?`));
  }

  // 6. PnL milestone (round thousands)
  if (prevSnap) {
    const thresholds = [1000, 2500, 5000, 10000];
    for (const t of thresholds) {
      if (prevSnap.totalPnL < t && nextSnap.totalPnL >= t) {
        msgs.push(mk('pnl-milestone', `Total PnL crossed +$${t.toLocaleString()} · keep it up.`));
      }
    }
  }

  return msgs;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm test src/features/bot-monitoring/__tests__/cypheusEvents.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/cypheusEvents.ts src/features/bot-monitoring/__tests__/cypheusEvents.test.ts
git commit -m "feat(monitoring): add Cypheus event-to-narrative script + tests"
```

## Task 3.5: useCypheusMonitoringNarrative + wire into rail

**Files:**
- Modify: `src/features/bot-monitoring/BotMonitoringPage.tsx`

- [ ] **Step 1: Add hook + update CypheusRail**

```tsx
import { generateEventNarrations, type CypheusMessage } from './cypheusEvents';

function useCypheusMonitoringNarrative(
  fills: Fill[], snap: PerformanceSnapshot | null, phase: BotPhase
) {
  const [messages, setMessages] = useState<CypheusMessage[]>([]);
  const prevRef = useRef<{ snap: PerformanceSnapshot | null; fills: Fill[] }>({ snap: null, fills: [] });

  useEffect(() => {
    if (!snap) return;
    const newMsgs = generateEventNarrations({
      prevSnap: prevRef.current.snap,
      nextSnap: snap,
      prevFills: prevRef.current.fills,
      nextFills: fills,
      phase,
    });
    if (newMsgs.length > 0) {
      setMessages(prev => [...newMsgs, ...prev].slice(0, 50));
    }
    prevRef.current = { snap, fills };
  }, [fills, snap, phase]);

  return messages;
}

function CypheusRail({ messages }: { messages: CypheusMessage[] }) {
  const collapsed = useLayoutPrefsStore(s => s.leftPanelCollapsed);

  const iconFor = (type: string) => {
    switch (type) {
      case 'tp-hit': return '🎯';
      case 'sl-hit': return '✕';
      case 'streak-milestone': return '🏆';
      case 'position-opened': return '↗';
      case 'pnl-milestone': return '📈';
      case 'scan': return '📡';
      case 'idle': return '⏸';
      case 'anomaly': return '⚠';
      default: return '•';
    }
  };

  const colorFor = (type: string) => ({
    'tp-hit': 'text-emerald-400',
    'sl-hit': 'text-rose-400',
    'streak-milestone': 'text-amber-400',
    'pnl-milestone': 'text-violet-300',
    'scan': 'text-sky-400',
    'idle': 'text-slate-400',
    'anomaly': 'text-amber-400',
  }[type] ?? 'text-teal-300');

  return (
    <aside className={`bg-slate-950 border-r border-slate-800 p-3 ${collapsed ? 'w-12' : 'w-60'} sticky top-0 h-screen flex flex-col gap-3`}>
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
        <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-sky-500 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">C</div>
        {!collapsed && (
          <div>
            <h4 className="text-sm text-slate-100 font-semibold m-0">Cypheus</h4>
            <small className="text-xs text-teal-300">● Watching bot</small>
          </div>
        )}
      </div>
      {!collapsed && (
        <>
          <div className="text-slate-600 text-[9px] uppercase tracking-wider">Live Narrative</div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
            {messages.map((m, i) => (
              <div key={m.id} className={`p-2.5 rounded-lg bg-slate-900 border ${i === 0 ? 'border-teal-700' : 'border-slate-800'}`}
                style={i === 0 ? { boxShadow: '0 0 0 1px rgba(20,184,166,0.3), 0 0 12px rgba(20,184,166,0.15)' } : undefined}>
                <div className={`text-[10px] uppercase tracking-wide ${colorFor(m.type)} flex items-center gap-1`}>
                  <span>{iconFor(m.type)}</span>
                  <span>{m.type.replace('-', ' ')}</span>
                </div>
                <div className="text-xs text-slate-300 mt-1">{m.text}</div>
                <div className="text-slate-600 text-[9px] mt-1">{i === 0 ? 'just now' : new Date(m.ts).toLocaleTimeString().slice(0,5)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
```

- [ ] **Step 2: Wire in page**

```tsx
// In BotMonitoringPage, after fills/snap/phase computed:
const cypheusMessages = useCypheusMonitoringNarrative(fills, snap, phase);

// In JSX, replace existing CypheusRail with:
<CypheusRail messages={cypheusMessages} />
```

- [ ] **Step 3: Verify dev** — Cypheus rail shows narrative messages flowing as fills "happen" in mock data.

- [ ] **Step 4: Commit**

```bash
git add src/features/bot-monitoring/BotMonitoringPage.tsx
git commit -m "feat(monitoring): wire Cypheus narrative rail with event mapping"
```

## Task 3.6: M3 verification + PR

- [ ] **Step 1: Gates + push**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git push
```

- [ ] **Step 2: PR**

```bash
gh pr create --title "feat(monitoring): M3 heatmap + pipeline + fills + Cypheus narrative" --body "Adds 4 sections + Cypheus event-driven narrative."
```

---

# Milestone M4 · OrderBook + Bubble + Empty States + Cypheus polish

**PR title**: `feat(monitoring): M4 HL sidebar + empty states + polish`

## Task 4.1: useHyperliquidMarkets + useHyperliquidOrderBook hooks

**Files:**
- Modify: `src/features/bot-monitoring/BotMonitoringPage.tsx`

- [ ] **Step 1: Add hooks**

```tsx
function useHyperliquidMarkets() {
  const [data, setData] = useState<HLAssetCtx[]>([]);
  const [meta, setMeta] = useState<{ name: string; szDecimals: number }[]>([]);
  useEffect(() => {
    const fetch = () => hlApi.getMetaAndAssetCtxs().then(d => {
      setMeta(d.meta.universe);
      setData(d.ctxs);
    }).catch(e => console.warn('HL markets:', e));
    fetch();
    const t = setInterval(fetch, 10_000);
    return () => clearInterval(t);
  }, []);
  return { ctxs: data, universe: meta };
}

function useHyperliquidOrderBook(coin: string) {
  const [book, setBook] = useState<HLOrderBook | null>(null);
  useEffect(() => {
    if (!coin) return;
    let active = true;
    const fetch = () => {
      if (document.hidden) return;
      hlApi.getL2Book(coin).then(b => { if (active) setBook(b); }).catch(e => console.warn('HL book:', e));
    };
    fetch();
    const t = setInterval(fetch, 1000);
    return () => { active = false; clearInterval(t); };
  }, [coin]);
  return book;
}
```

Add imports: `import type { HLAssetCtx, HLOrderBook } from './types';`

- [ ] **Step 2: Verify typecheck** → 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/bot-monitoring/BotMonitoringPage.tsx
git commit -m "feat(monitoring): add HL markets + orderbook polling hooks"
```

## Task 4.2: OrderBookL2 section

**Files:**
- Modify: `src/features/bot-monitoring/BotMonitoringPage.tsx`

- [ ] **Step 1: Add OrderBookL2 component**

```tsx
function OrderBookL2({ book }: { book: HLOrderBook | null }) {
  if (!book) return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-slate-500 text-xs">Loading order book…</div>
  );
  const [asks, bids] = book.levels;
  const top = (arr: typeof asks, count: number) => arr.slice(0, count);
  const asks6 = top([...asks].sort((a, b) => a.px - b.px), 6).reverse();
  const bids6 = top([...bids].sort((a, b) => b.px - a.px), 6);
  const bestAsk = asks6[asks6.length - 1]?.px ?? 0;
  const bestBid = bids6[0]?.px ?? 0;
  const spread = bestAsk - bestBid;
  const mid = (bestAsk + bestBid) / 2;
  const maxAskSize = Math.max(...asks6.map(a => a.sz), 1);
  const maxBidSize = Math.max(...bids6.map(b => b.sz), 1);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <div className="flex justify-between items-center px-4 py-2.5 border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
        <span>
          <span className="text-teal-300 border border-teal-900 bg-teal-950/30 px-1.5 py-0.5 rounded text-[10px]">● L2</span>
          <span className="ml-2">Order Book</span>
          <span className="text-slate-600 mx-2">·</span>
          <span>{book.coin}</span>
        </span>
        <span className="text-slate-400 text-[10px] normal-case">Updates 1s</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr]">
        <div className="p-2 px-3 tabular-nums">
          <h5 className="m-0 mb-1.5 text-[9px] uppercase tracking-wider text-slate-500">Asks · sells</h5>
          {asks6.map(a => (
            <div key={a.px} className="grid grid-cols-[80px_1fr_70px] gap-2 py-0.5 text-[11.5px] items-center">
              <span className="text-rose-400 font-semibold">{a.px.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              <div className="h-3 rounded-sm" style={{
                width: `${(a.sz/maxAskSize)*100}%`,
                background: 'linear-gradient(90deg, transparent, rgba(248,113,113,0.25))',
              }} />
              <span className="text-slate-400 text-right text-[10.5px]">{a.sz.toFixed(2)} {book.coin}</span>
            </div>
          ))}
        </div>
        <div className="bg-slate-950 border-x border-slate-800 px-4 py-2 flex flex-col items-center justify-center min-w-[130px]">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Spread</div>
          <div className="text-base text-slate-100 font-bold tabular-nums my-1">{mid.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
          <div className="text-[10px] text-amber-400 tabular-nums">${spread.toFixed(2)} · {((spread/mid)*100).toFixed(3)}%</div>
          <div className="mt-2 text-[8px] uppercase tracking-wider text-slate-600">Mid Price</div>
        </div>
        <div className="p-2 px-3 tabular-nums">
          <h5 className="m-0 mb-1.5 text-[9px] uppercase tracking-wider text-slate-500">Bids · buys</h5>
          {bids6.map(b => (
            <div key={b.px} className="grid grid-cols-[80px_1fr_70px] gap-2 py-0.5 text-[11.5px] items-center">
              <span className="text-emerald-400 font-semibold">{b.px.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              <div className="h-3 rounded-sm" style={{
                width: `${(b.sz/maxBidSize)*100}%`,
                background: 'linear-gradient(90deg, transparent, rgba(52,211,153,0.25))',
              }} />
              <span className="text-slate-400 text-right text-[10.5px]">{b.sz.toFixed(2)} {book.coin}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire in page**

```tsx
const orderBook = useHyperliquidOrderBook('BTC');

// In JSX, between EquityCurve and LiveSpotFeed:
<OrderBookL2 book={orderBook} />
```

- [ ] **Step 3: Verify dev** — order book renders real BTC depth, updates ~1s.

- [ ] **Step 4: Commit**

```bash
git add src/features/bot-monitoring/BotMonitoringPage.tsx
git commit -m "feat(monitoring): add OrderBookL2 with HL polling"
```

## Task 4.3: GainersLosersBubble section

**Note**: Tabs 24H/7D/30D/90D render correctly but **only 24H tab fetches real % change** (from `metaAndAssetCtxs.prevDayPx`). Tabs 7D/30D/90D require batched candleSnapshot per pair (~50–100 calls) — defer to follow-up task post-demo. For v1, all tabs show 24H data (acceptance: tabs visually switchable, even if data identical). See spec §5.5.


**Files:**
- Modify: `src/features/bot-monitoring/BotMonitoringPage.tsx`

- [ ] **Step 1: Add bubble layout helper**

```tsx
type BubbleTimeframe = '24H' | '7D' | '30D' | '90D';

function computeBubbles(ctxs: HLAssetCtx[], universe: { name: string }[], _tf: BubbleTimeframe) {
  const items = ctxs.map((c, i) => {
    const name = universe[i]?.name ?? c.coin ?? `?`;
    const pct = c.prevDayPx > 0 ? ((c.markPx - c.prevDayPx) / c.prevDayPx) * 100 : 0;
    return { name, pct, vol: c.dayNtlVlm };
  }).filter(p => p.vol >= 100_000);

  // Sort by magnitude
  items.sort((a, b) => Math.abs(b.pct) * Math.log10(b.vol + 10) - Math.abs(a.pct) * Math.log10(a.vol + 10));
  const top = items.slice(0, 15);
  const maxAbsPct = Math.max(...top.map(p => Math.abs(p.pct)), 1);

  // Precomputed positions (15 slots in a 280×540 canvas)
  const positions = [
    [50, 2, 80], [8, 14, 62], [60, 14, 66], [38, 24, 50], [8, 30, 54],
    [60, 32, 42], [32, 42, 48], [62, 46, 44], [6, 50, 38], [34, 60, 40],
    [60, 62, 46], [8, 68, 36], [36, 78, 42], [60, 78, 38], [14, 88, 34],
  ];

  return top.map((p, i) => {
    const [left, top, baseSize] = positions[i] ?? [50, 50, 30];
    const size = baseSize * (0.7 + 0.3 * (Math.abs(p.pct) / maxAbsPct));
    return { ...p, left, top, size };
  });
}

function BubbleStats({ ctxs }: { ctxs: HLAssetCtx[] }) {
  const filtered = ctxs.filter(c => c.dayNtlVlm >= 100_000);
  const winners = filtered.filter(c => c.markPx > c.prevDayPx).length;
  const losers = filtered.filter(c => c.markPx < c.prevDayPx).length;
  const sortedBest = [...filtered].sort((a, b) => ((b.markPx-b.prevDayPx)/b.prevDayPx) - ((a.markPx-a.prevDayPx)/a.prevDayPx));
  const best = sortedBest[0];
  const worst = sortedBest[sortedBest.length-1];
  return (
    <div className="mt-2 pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wide text-slate-500">
      <div>Winners <b className="block text-emerald-400 text-[11px] mt-0.5 normal-case">{winners} pairs</b></div>
      <div>Losers <b className="block text-rose-400 text-[11px] mt-0.5 normal-case">{losers} pairs</b></div>
      {best && <div>Best <b className="block text-emerald-400 text-[11px] mt-0.5 normal-case">{best.coin} {(((best.markPx-best.prevDayPx)/best.prevDayPx)*100).toFixed(1)}%</b></div>}
      {worst && <div>Worst <b className="block text-rose-400 text-[11px] mt-0.5 normal-case">{worst.coin} {(((worst.markPx-worst.prevDayPx)/worst.prevDayPx)*100).toFixed(1)}%</b></div>}
    </div>
  );
}

function GainersLosersBubble({ ctxs, universe }: { ctxs: HLAssetCtx[]; universe: { name: string }[] }) {
  const [tf, setTf] = useState<BubbleTimeframe>('24H');
  const bubbles = computeBubbles(ctxs, universe, tf);
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 sticky top-3">
      <div className="flex justify-between items-center mb-2 text-[11px] uppercase tracking-wide text-slate-500">
        <span>Hyperliquid Markets</span>
        <span className="text-teal-300 normal-case tracking-normal text-xs">● Live</span>
      </div>
      <div className="flex gap-0.5 mb-2.5 bg-slate-950 rounded p-0.5">
        {(['24H','7D','30D','90D'] as BubbleTimeframe[]).map(t => (
          <button key={t} onClick={() => setTf(t)}
            className={`flex-1 text-center py-1 text-[10px] rounded ${t === tf ? 'bg-slate-800 text-slate-100' : 'text-slate-500'}`}>{t}</button>
        ))}
      </div>
      <div className="relative rounded-lg overflow-hidden" style={{
        height: 540, background: 'radial-gradient(ellipse at center, rgba(20,184,166,0.04), transparent 70%)'
      }}>
        {bubbles.map(b => (
          <div key={b.name}
            className={`absolute rounded-full flex flex-col items-center justify-center text-white font-bold tabular-nums cursor-pointer transition-transform hover:scale-110 ${
              b.pct >= 0 ? 'bg-gradient-to-br from-emerald-400 to-emerald-800 border border-emerald-400' : 'bg-gradient-to-br from-rose-400 to-rose-800 border border-rose-400'
            }`}
            style={{
              width: b.size, height: b.size,
              left: `${b.left}%`, top: `${b.top}%`,
              boxShadow: b.pct >= 0 ? '0 0 12px rgba(52,211,153,0.4)' : '0 0 12px rgba(248,113,113,0.4)',
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }}>
            <div className="text-[11px] opacity-90">{b.name}</div>
            <div className="text-xs">{b.pct >= 0 ? '+' : ''}{b.pct.toFixed(1)}%</div>
          </div>
        ))}
      </div>
      <BubbleStats ctxs={ctxs} />
    </div>
  );
}
```

- [ ] **Step 2: Wire into page sidebar**

```tsx
const { ctxs, universe } = useHyperliquidMarkets();

// In JSX, replace sidebar placeholder with:
<aside className="p-4 pl-0">
  <GainersLosersBubble ctxs={ctxs} universe={universe} />
</aside>
```

- [ ] **Step 3: Verify dev** — bubble chart renders top 15 HL pairs with real data.

- [ ] **Step 4: Commit**

```bash
git add src/features/bot-monitoring/BotMonitoringPage.tsx
git commit -m "feat(monitoring): add GainersLosersBubble with real HL data"
```

## Task 4.4: Empty state mode for vulnerable sections

**Files:**
- Modify: `src/features/bot-monitoring/BotMonitoringPage.tsx`

- [ ] **Step 1: Add EmptyStateCard helper + modify HeroPnL/Heatmap/EquityCurve/RecentFills for phase**

```tsx
function EmptyStateCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-10 text-center text-slate-500">
      <div className="w-10 h-10 mx-auto mb-2 bg-slate-800 rounded-lg flex items-center justify-center text-lg">{icon}</div>
      <h4 className="m-0 text-slate-300 text-sm font-semibold">{title}</h4>
      <p className="mt-1 text-slate-500 text-xs">{body}</p>
    </div>
  );
}

// Modify HeroPnL signature — wrap existing mature impl in phase check:
function HeroPnL({ snap, phase }: { snap: PerformanceSnapshot; phase: BotPhase }) {
  if (phase === 'just-deployed') {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-7 grid grid-cols-[1fr_auto] gap-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500 mb-3 flex gap-3">
            <span>Today · Realized PnL</span>
            <span className="text-sky-400">● Scanning</span>
            <span className="text-slate-600">·</span>
            <span>0 trades yet</span>
          </div>
          <div className="font-pixel text-5xl text-slate-600">$0.00</div>
          <div className="flex gap-4 mt-4 text-xs text-slate-500">
            <span>⏱ Est. first signal in <b className="text-slate-300">1–3h</b></span>
            <div className="h-1 bg-slate-800 rounded w-48 relative overflow-hidden">
              <div className="absolute inset-0" style={{
                background: 'linear-gradient(90deg, transparent, #60a5fa, transparent)',
                width: 60,
                animation: 'scan 2s linear infinite',
              }} />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center w-32 opacity-40">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="4"/>
          </svg>
          <div className="font-pixel text-3xl text-slate-600 -mt-[72px]">—</div>
          <div className="mt-8 text-[9px] uppercase tracking-widest text-slate-600 text-center leading-relaxed">
            Build a streak
          </div>
        </div>
      </div>
    );
  }
  // Mature/collecting: existing implementation from Task 1.7 (unchanged from current code)
  return (
    <div className="grid grid-cols-[1fr_auto] gap-6 bg-slate-950/80 border border-slate-800 rounded-xl p-7 relative overflow-hidden">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500 mb-3">
          Today · Realized PnL
        </div>
        <div className="font-pixel text-5xl text-rose-400" style={{textShadow:'0 0 30px rgba(248,113,113,0.4)'}}>
          ${snap.todayPnL >= 0 ? '+' : ''}{snap.todayPnL.toLocaleString()}
        </div>
        <div className="flex gap-4 mt-4 text-sm text-slate-400">
          <span><span className="text-emerald-400">▲</span> {snap.totalTrades} trades</span>
          <span className="text-slate-600">·</span>
          <span className="text-emerald-400 font-bold">{(snap.winRate * 100).toFixed(1)}% win</span>
          <span className="text-slate-600">·</span>
          <span>{snap.openPositions} open</span>
        </div>
      </div>
      <WinStreakGauge streak={snap.winStreak} />
    </div>
  );
}
```

**Note**: Pass `phase` prop from BotMonitoringPage to HeroPnL. Mature branch is the same code as Task 1.7 — copy verbatim.

Add CSS keyframes once globally — modify `src/styles/tokens.css`:

```css
@keyframes scan {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(360px); }
}
```

- [ ] **Step 2: Add ActivityHeatmap onboarding strip variant**

In ActivityHeatmap, add phase prop and onboarding branch:

```tsx
function ActivityHeatmap({ daily, total, best, worst, phase }: {
  daily: DailyPnL[]; total: number; best: number; worst: number; phase: BotPhase;
}) {
  if (phase === 'just-deployed') {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex justify-between items-center text-xs">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-7 h-7 bg-blue-950 rounded text-blue-300 flex items-center justify-center text-base">📊</div>
          <div>
            <h4 className="m-0 text-slate-100 text-[13px] font-semibold">Daily activity heatmap</h4>
            <p className="mt-0.5 text-slate-500 text-[11px]">Will populate as bot accumulates trades · 47-day window</p>
          </div>
        </div>
        <div className="flex gap-0.5">
          {Array.from({length: 47}).map((_, i) => (
            <div key={i} className={`w-2 h-4 rounded-sm ${i === 46 ? 'bg-sky-500 animate-pulse' : 'bg-slate-800'}`} />
          ))}
        </div>
      </div>
    );
  }
  // Mature: existing implementation from Task 3.1 (copy verbatim)
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
      <div className="flex justify-between items-center mb-2 text-[11px] uppercase tracking-wide text-slate-500">
        <span>BTC-USDC · 47-Day All-Time</span>
        <span className="text-slate-300 normal-case tracking-normal text-xs">
          Total <b className="text-emerald-400">${total.toFixed(0)}</b> ·
          Best <b className="text-emerald-400">${best.toFixed(0)}</b> ·
          Worst <b className="text-rose-400">${worst.toFixed(0)}</b>
        </span>
      </div>
      <div className="grid grid-cols-[repeat(47,1fr)] gap-[3px] h-8">
        {daily.map((d, i) => (
          <div key={d.date}
            title={`${d.date}: $${d.pnl.toFixed(2)} (${d.trades} trades)`}
            className="rounded-sm transition-transform hover:scale-150 cursor-pointer"
            style={{
              background: colorForPnL(d.pnl, best, worst),
              boxShadow: i === daily.length - 1 ? '0 0 8px #34d399' : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Modify EquityCurve + RecentFills for empty state**

```tsx
function EquityCurve({ data, range, onRangeChange, phase }: {
  data: EquityPoint[]; range: TimeRange; onRangeChange: (r: TimeRange) => void; phase: BotPhase;
}) {
  if (phase === 'just-deployed' || data.length === 0) {
    return <EmptyStateCard icon="📈" title="Equity curve will appear here" body="After your first closed trade · est. 1–3 hours" />;
  }
  // Mature: existing implementation from Task 2.4 (copy verbatim — useEffect with chart, ranges array, JSX)
  // NOTE: The existing EquityCurve body from Task 2.4 stays unchanged. Just add early-return above.
  return /* existing JSX from Task 2.4 */;
}

function RecentFills({ fills, phase }: { fills: Fill[]; phase: BotPhase }) {
  if (phase === 'just-deployed' || fills.length === 0) {
    return <EmptyStateCard icon="⏳" title="Waiting for first signal" body="Trades will stream here as they execute · est. first within 1–3 hours" />;
  }
  // Mature: existing implementation from Task 3.3 (copy verbatim)
  return /* existing JSX from Task 3.3 */;
}
```

**Note**: The "/* existing ... */" comments above are direction for the engineer — keep the existing implementation body from referenced tasks, just wrap with the empty-state early return at the top.

- [ ] **Step 4: Wire phase prop everywhere**

In BotMonitoringPage JSX, pass `phase` to HeroPnL, ActivityHeatmap, EquityCurve, RecentFills.

- [ ] **Step 5: Verify dev with dev controls** (next task adds them; for now manually edit deployedAt in mock)

Temporarily modify `botApi.getBotMeta` to return `deployedAt: Date.now() - 60_000` (1 minute ago) → verify just-deployed empty states render. Revert after.

- [ ] **Step 6: Commit**

```bash
git add src/features/bot-monitoring/BotMonitoringPage.tsx src/styles/tokens.css
git commit -m "feat(monitoring): add empty state mode for vulnerable sections"
```

## Task 4.5: Dev controls for demo (?dev=1)

**Files:**
- Modify: `src/features/bot-monitoring/BotMonitoringPage.tsx`

- [ ] **Step 1: Add dev controls panel**

```tsx
function DevControls({ onSetDeployedAt }: { onSetDeployedAt: (ts: number) => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => { setShow(new URLSearchParams(window.location.search).has('dev')); }, []);
  if (!show) return null;
  const now = Date.now();
  return (
    <div className="fixed bottom-4 right-4 bg-slate-900 border border-amber-800 rounded-lg p-3 z-50 shadow-xl">
      <div className="text-amber-400 text-[10px] uppercase tracking-wider mb-2">Dev Controls</div>
      <div className="flex flex-col gap-1">
        <button onClick={() => onSetDeployedAt(now - 60_000)} className="text-xs px-2 py-1 bg-slate-800 text-slate-200 rounded hover:bg-slate-700">Reset to Day 0</button>
        <button onClick={() => onSetDeployedAt(now - 14*86_400_000)} className="text-xs px-2 py-1 bg-slate-800 text-slate-200 rounded hover:bg-slate-700">Skip to Day 14</button>
        <button onClick={() => onSetDeployedAt(now - 47*86_400_000)} className="text-xs px-2 py-1 bg-slate-800 text-slate-200 rounded hover:bg-slate-700">Skip to Day 47</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire override into page**

```tsx
const [deployedOverride, setDeployedOverride] = useState<number | null>(null);
const meta = useBotMeta(id);
const effectiveMeta = meta && deployedOverride != null ? { ...meta, deployedAt: deployedOverride } : meta;
// Use effectiveMeta everywhere instead of meta
// ...
{effectiveMeta && <DevControls onSetDeployedAt={setDeployedOverride} />}
```

- [ ] **Step 3: Verify** — visit `/bots/bot-1?dev=1` → buttons visible, click → toggle phase.

- [ ] **Step 4: Commit**

```bash
git add src/features/bot-monitoring/BotMonitoringPage.tsx
git commit -m "feat(monitoring): add ?dev=1 demo controls for phase override"
```

## Task 4.6: M4 verification + PR

- [ ] **Step 1: Gates + push**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git push
```

- [ ] **Step 2: PR**

```bash
gh pr create --title "feat(monitoring): M4 HL sidebar + empty states + dev controls" --body "OrderBook + Bubble + empty states + Cypheus polish + dev controls."
```

---

# Milestone M5 · BotsListPage + Builder integration

**PR title**: `feat(monitoring): M5 bots list + builder integration`

## Task 5.1: BotsListPage implementation

**Files:**
- Modify: `src/features/bot-monitoring/BotsListPage.tsx`

- [ ] **Step 1: Implement list page**

```tsx
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { botApi } from './mockBotData';
import type { BotMeta, PerformanceSnapshot } from './types';

interface BotRow { meta: BotMeta; snap: PerformanceSnapshot; }

export function BotsListPage() {
  const [rows, setRows] = useState<BotRow[]>([]);
  useEffect(() => {
    const ids = ['bot-1', 'bot-2', 'bot-3'];
    Promise.all(ids.map(async id => {
      const meta = await botApi.getBotMeta(id);
      const snap = await botApi.getSnapshot(id, meta.deployedAt);
      return { meta, snap };
    })).then(setRows);
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto bg-slate-950 min-h-screen text-slate-200">
      <h1 className="text-2xl font-semibold mb-6">My Bots</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map(({meta, snap}) => (
          <Link key={meta.id} to={`/bots/${meta.id}`}
            className="block bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-teal-700 transition-colors">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-base font-semibold text-slate-100">{meta.name}</div>
                <code className="text-xs text-teal-300">{meta.pair}</code>
                <span className="text-xs text-slate-500 ml-2">{meta.timeframe}</span>
              </div>
              <span className="bg-teal-700 text-white px-2 py-0.5 rounded-full text-xs uppercase font-semibold">● Live</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-slate-500 uppercase tracking-wide text-[10px]">Today</div>
                <div className={snap.todayPnL >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {snap.todayPnL >= 0 ? '+' : ''}${snap.todayPnL.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-slate-500 uppercase tracking-wide text-[10px]">Total</div>
                <div className="text-slate-200 font-bold">${snap.totalPnL.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-slate-500 uppercase tracking-wide text-[10px]">Win</div>
                <div className="text-slate-200 font-bold">{(snap.winRate*100).toFixed(0)}%</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify dev** — `/bots` shows 3 bot cards, click navigates to detail.

- [ ] **Step 3: Commit**

```bash
git add src/features/bot-monitoring/BotsListPage.tsx
git commit -m "feat(monitoring): implement BotsListPage with mini stats cards"
```

## Task 5.2: Wire Builder Deploy → /bots/:id

**Files:**
- Modify: `src/features/export-import/ExportDialog.tsx`

- [ ] **Step 1: Locate the export confirm button handler**

Read file: `src/features/export-import/ExportDialog.tsx`. Find the click handler that triggers download/export confirmation (typically named `handleExport`, `onExport`, or wired to a primary CTA button).

- [ ] **Step 2: Add navigate hook + redirect after success**

```tsx
// Add at top of imports
import { useNavigate } from 'react-router-dom';

// Inside ExportDialog component:
const navigate = useNavigate();

// After the existing export logic completes successfully (e.g., after `download()` or `closeDialog()`):
const newBotId = `bot-${Date.now()}`;  // mock ID for v1; real BE will return ID from POST /bot-strategy/create response
navigate(`/bots/${newBotId}`);
```

If ExportDialog is the wrong location (e.g., the actual "Deploy" CTA is elsewhere), confirm by running:
```bash
grep -rn "Export\|Deploy\|bot-strategy" src/features/export-import/ src/features/bot-builder/ src/pages/ | grep -i "button\|onClick\|handleSubmit"
```
Then apply same pattern in the correct file.

- [ ] **Step 3: Verify in dev**

Run `pnpm dev`, go through Builder flow, click Deploy/Export → after success → page navigates to `/bots/bot-{timestamp}` showing monitoring detail.

- [ ] **Step 4: Commit**

```bash
git add src/features/export-import/ExportDialog.tsx
git commit -m "feat(monitoring): wire Builder Deploy → /bots/:id navigation"
```

## Task 5.3: M5 verification + PR

- [ ] **Step 1: Final gates**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
git push
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(monitoring): M5 bots list + builder integration" --body "Completes monitoring feature with list page and Deploy → Monitor flow."
```

- [ ] **Step 3: Final acceptance walkthrough**

Visit `/bots` → click bot → `/bots/:id` shows full 10-section monitoring page. Add `?dev=1` → toggle Day 0/14/47 → all phases work. Verify HL data live (bubble + spot + orderbook). Cypheus rail shows narrative.

---

## Final acceptance checklist (across all M1–M5)

Run before announcing demo-ready:

- [ ] `pnpm typecheck` — 0 errors
- [ ] `pnpm lint` — 0 warnings
- [ ] `pnpm test` — all pass (mockBotData + cypheusEvents tests + existing app tests)
- [ ] `pnpm build` — succeeds
- [ ] `/bots/:id` renders 10 sections without console errors
- [ ] HL bubble chart renders real Hyperliquid data
- [ ] HL live spot feed renders real BTC 5m candles
- [ ] HL order book L2 updates ~1s smoothly
- [ ] Cypheus narrative messages flow as fills happen
- [ ] `?dev=1` controls work — toggle Day 0 / 14 / 47, all phases graceful
- [ ] Press Start 2P loaded for hero number (with `font-display: swap` fallback)
- [ ] No layout shift on initial load
- [ ] Page LCP < 2s on dev machine
- [ ] Looks good 1440×900 viewport
- [ ] Builder Deploy → /bots/:id flow works end-to-end
