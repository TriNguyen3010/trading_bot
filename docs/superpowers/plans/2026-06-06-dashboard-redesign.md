# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Dashboard overview and Bot detail screens to show richer, BE-grounded information (balance, config, live status, backtest performance) replacing the current mock PnL/sparkline UI, with full state coverage and honest empty states.

**Architecture:** Three phases. Phase 1 builds a pure data layer (API methods + defensive types + pure transform/derivation functions) — fully unit-tested. Phase 2 rewires the Dashboard overview (`DashboardPage` + extracted `BotCard`). Phase 3 replaces the 4000-line mock `BotMonitoringPage` with a lean, BE-backed detail page composed of focused panels. Every number maps to a real BE field per the spec; fields BE doesn't return yet are hidden (not faked).

**Tech Stack:** React 18 + TypeScript 5.7, Vite 6, Tailwind 3 (design tokens in `src/styles/tokens.css`), Vitest + @testing-library/react, native `fetch` via `src/lib/http.ts`.

**Spec:** `docs/superpowers/specs/2026-06-06-dashboard-redesign-design.md`
**Visual reference (markup source of truth):** `public/dashboard-redesign-app-style.html`

---

## Conventions for this plan

- Import alias `@/` (never relative `../../`).
- API calls only via `http<T>(method, path, body?)` from `@/lib/http`, wrapped in `botApi` (`src/features/bot-monitoring/bot.api.ts`).
- Test files: co-located `__tests__/` or `*.test.ts(x)`.
- Run a single test: `pnpm test -- <path>` (Vitest). Run all: `pnpm test`.
- Commit format: `<type>(scope): desc` (e.g. `feat(dashboard): …`).
- `/performance` and `/open_trades` are **untyped** in openapi (response = None) → FE declares its own defensive types and parses with candidate keys.

---

# PHASE 1 — Data layer (pure, fully tested)

New files:

- `src/features/bot-monitoring/bot-performance.ts` — `BotPerformance` type + `parseBotPerformance`.
- `src/features/bot-monitoring/backtest-results.ts` — pure transforms over `BacktestHistoryItem.results`.
- `src/features/bot-monitoring/presentational-state.ts` — `derivePresentationalState`.
- `src/features/bot-monitoring/portfolio-stats.ts` — dashboard hero aggregate.

Modified:

- `src/features/bot-monitoring/bot.api.ts` — add `getPerformance`, `getBacktestHistory`, `getBacktest`. (No `getOpenTrades`/`listJobs` — open positions dropped from v1; backtest-in-progress derived from history status.)

---

### Task 1: `BotPerformance` type + defensive parser

`/bot/{id}/performance` has no openapi schema. Observed at runtime: returns `balance` and an open-trades count; PnL/win-rate currently N/A. Parser must read candidate keys and return `null` for anything missing — never throw, never invent.

**Files:**

- Create: `src/features/bot-monitoring/bot-performance.ts`
- Test: `src/features/bot-monitoring/__tests__/bot-performance.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/bot-monitoring/__tests__/bot-performance.test.ts
import { describe, it, expect } from 'vitest';
import { parseBotPerformance } from '../bot-performance';

describe('parseBotPerformance', () => {
  it('reads balance + open trades from observed keys', () => {
    const p = parseBotPerformance({ balance: 967.9355, open_trades: 1 });
    expect(p.balance).toBe(967.9355);
    expect(p.openTrades).toBe(1);
  });

  it('accepts alternate key spellings', () => {
    const p = parseBotPerformance({
      wallet_balance: 500,
      open_trades_count: 2,
    });
    expect(p.balance).toBe(500);
    expect(p.openTrades).toBe(2);
  });

  it('returns null for missing fields, never throws', () => {
    const p = parseBotPerformance({ balance: 100 });
    expect(p.balance).toBe(100);
    expect(p.openTrades).toBeNull();
  });

  it('handles non-object input defensively', () => {
    expect(parseBotPerformance(null).balance).toBeNull();
    expect(parseBotPerformance('oops').openTrades).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/features/bot-monitoring/__tests__/bot-performance.test.ts`
Expected: FAIL — `parseBotPerformance` not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/bot-monitoring/bot-performance.ts

/** Defensive shape for the untyped GET /bot/{id}/performance response.
 * openapi declares no schema; we read only the fields BE is observed to
 * return today — balance + open-trades count. PnL/win-rate are NOT read
 * (BE returns N/A → dropped from the design, spec §6). Verify candidate
 * keys against a real BE response. */
export interface BotPerformance {
  balance: number | null;
  openTrades: number | null;
}

function num(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

export function parseBotPerformance(raw: unknown): BotPerformance {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    balance: num(o, ['balance', 'wallet_balance', 'current_balance']),
    openTrades: num(o, [
      'open_trades',
      'open_trades_count',
      'open_trade_count',
    ]),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/features/bot-monitoring/__tests__/bot-performance.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/bot-performance.ts src/features/bot-monitoring/__tests__/bot-performance.test.ts
git commit -m "feat(dashboard): defensive BotPerformance parser for untyped /performance"
```

---

### Task 2: Backtest results pure transforms

Operates on `BacktestHistoryItem.results.strategy[strategy_name]` (the rich block parsed from `BE/backtest_200.json`). Pure functions for the detail Performance panel.

**Files:**

- Create: `src/features/bot-monitoring/backtest-results.ts`
- Test: `src/features/bot-monitoring/__tests__/backtest-results.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/bot-monitoring/__tests__/backtest-results.test.ts
import { describe, it, expect } from 'vitest';
import {
  extractStrategyBlock,
  buildEquityCurve,
  extractBacktestMetrics,
  extractExitReasons,
} from '../backtest-results';

const ITEM = {
  strategy_name: 'Gamma',
  results: {
    strategy: {
      Gamma: {
        trades: [
          { profit_abs: 0.979, close_timestamp: 30 },
          { profit_abs: -3.571, close_timestamp: 10 },
          { profit_abs: 2.0, close_timestamp: 20 },
        ],
        total_trades: 104,
        profit_total_abs: -36.59,
        profit_total: -0.0366,
        trade_count_long: 51,
        trade_count_short: 53,
        sharpe: -3.42,
        sortino: -5.08,
        profit_factor: 0.87,
        expectancy: -0.35,
        trades_per_day: 3.47,
        avg_stake_amount: 99.96,
        total_volume: 208020,
        market_change: -0.0367,
        best_pair: {
          winrate: 0.4423,
          wins: 46,
          losses: 58,
          max_drawdown_abs: 96.93,
          max_drawdown_account: 0.0953,
        },
        exit_reason_summary: [
          { key: 'exit_signal', trades: 1, profit_total_abs: 14.99 },
          { key: 'duration_6.0_hours', trades: 103, profit_total_abs: -51.58 },
          { key: 'TOTAL', trades: 104, profit_total_abs: -36.59 },
        ],
      },
    },
  },
} as any;

describe('backtest-results', () => {
  it('extracts the strategy block by strategy_name', () => {
    expect(extractStrategyBlock(ITEM)?.total_trades).toBe(104);
  });

  it('returns null when results/strategy missing', () => {
    expect(
      extractStrategyBlock({ strategy_name: 'X', results: null } as any),
    ).toBeNull();
  });

  it('builds a cumulative equity curve sorted by close_timestamp', () => {
    // sorted: -3.571 (t10), +2.0 (t20), +0.979 (t30) -> cumulative
    expect(buildEquityCurve(extractStrategyBlock(ITEM)!)).toEqual([
      -3.571, -1.571, -0.592,
    ]);
  });

  it('extracts metrics with win-rate/drawdown from best_pair', () => {
    const m = extractBacktestMetrics(extractStrategyBlock(ITEM)!);
    expect(m.netAbs).toBe(-36.59);
    expect(m.trades).toBe(104);
    expect(m.winRatePct).toBeCloseTo(44.23, 1);
    expect(m.sharpe).toBe(-3.42);
    expect(m.profitFactor).toBe(0.87);
    expect(m.maxDrawdownAbs).toBe(96.93);
    expect(m.maxDrawdownPct).toBeCloseTo(9.53, 1);
    expect(m.longCount).toBe(51);
    expect(m.shortCount).toBe(53);
  });

  it('extracts exit reasons excluding TOTAL', () => {
    const ex = extractExitReasons(extractStrategyBlock(ITEM)!);
    expect(ex.map((e) => e.key)).toEqual(['exit_signal', 'duration_6.0_hours']);
    expect(ex[0].profitAbs).toBe(14.99);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/features/bot-monitoring/__tests__/backtest-results.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/bot-monitoring/backtest-results.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/features/bot-monitoring/__tests__/backtest-results.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/backtest-results.ts src/features/bot-monitoring/__tests__/backtest-results.test.ts
git commit -m "feat(dashboard): pure transforms for backtest results (equity, metrics, exits)"
```

---

### Task 3: `derivePresentationalState`

Maps the 6 lifecycle modes plus context (backtest history + active job) to the UI's presentational state. Does NOT modify `deriveMode`.

**Files:**

- Create: `src/features/bot-monitoring/presentational-state.ts`
- Test: `src/features/bot-monitoring/__tests__/presentational-state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/bot-monitoring/__tests__/presentational-state.test.ts
import { describe, it, expect } from 'vitest';
import { derivePresentationalState } from '../presentational-state';

describe('derivePresentationalState', () => {
  it('returns the mode unchanged when running with a completed backtest', () => {
    expect(
      derivePresentationalState('DRY-RUN', {
        historyCount: 5,
        latestStatus: 'completed',
      }),
    ).toBe('DRY-RUN');
    expect(
      derivePresentationalState('LIVE', {
        historyCount: 0,
        latestStatus: null,
      }),
    ).toBe('LIVE');
  });

  it('BACKTESTING overlays any mode when latest backtest is running/pending', () => {
    expect(
      derivePresentationalState('PAUSED', {
        historyCount: 1,
        latestStatus: 'running',
      }),
    ).toBe('BACKTESTING');
    expect(
      derivePresentationalState('DRY-RUN', {
        historyCount: 1,
        latestStatus: 'pending',
      }),
    ).toBe('BACKTESTING');
  });

  it('NEW when paused with no backtest history', () => {
    expect(
      derivePresentationalState('PAUSED', {
        historyCount: 0,
        latestStatus: null,
      }),
    ).toBe('NEW');
  });

  it('BACKTEST_FAILED when paused and latest backtest failed', () => {
    expect(
      derivePresentationalState('PAUSED', {
        historyCount: 2,
        latestStatus: 'failed',
      }),
    ).toBe('BACKTEST_FAILED');
  });

  it('plain PAUSED when paused with a completed backtest', () => {
    expect(
      derivePresentationalState('PAUSED', {
        historyCount: 2,
        latestStatus: 'completed',
      }),
    ).toBe('PAUSED');
  });

  it('ERROR/STARTING/STOPPING pass through', () => {
    expect(
      derivePresentationalState('ERROR', {
        historyCount: 0,
        latestStatus: null,
      }),
    ).toBe('ERROR');
    expect(
      derivePresentationalState('STARTING', {
        historyCount: 0,
        latestStatus: null,
      }),
    ).toBe('STARTING');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/features/bot-monitoring/__tests__/presentational-state.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/bot-monitoring/presentational-state.ts
import type { DashboardBotMode } from './bot-list.helpers';

export type PresentationalState =
  | DashboardBotMode
  | 'NEW'
  | 'BACKTESTING'
  | 'BACKTEST_FAILED';

export interface PresentationalContext {
  historyCount: number;
  /** status of the most recent backtest history item (from /backtest/history) */
  latestStatus: string | null;
}

const BACKTEST_IN_PROGRESS = ['running', 'pending'];

export function derivePresentationalState(
  mode: DashboardBotMode,
  ctx: PresentationalContext,
): PresentationalState {
  // BACKTESTING is sourced from the bot's latest backtest-history status
  // (bot-scoped, reliable) — NOT from /jobs (no reliable job→bot mapping).
  if (ctx.latestStatus && BACKTEST_IN_PROGRESS.includes(ctx.latestStatus))
    return 'BACKTESTING';
  if (mode === 'PAUSED') {
    if (ctx.historyCount === 0) return 'NEW';
    if (ctx.latestStatus === 'failed') return 'BACKTEST_FAILED';
  }
  return mode;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/features/bot-monitoring/__tests__/presentational-state.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/presentational-state.ts src/features/bot-monitoring/__tests__/presentational-state.test.ts
git commit -m "feat(dashboard): derivePresentationalState (New/Backtesting/Backtest-failed overlays)"
```

---

### Task 4: Portfolio aggregate (hero numbers)

**Files:**

- Create: `src/features/bot-monitoring/portfolio-stats.ts`
- Test: `src/features/bot-monitoring/__tests__/portfolio-stats.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/bot-monitoring/__tests__/portfolio-stats.test.ts
import { describe, it, expect } from 'vitest';
import { computePortfolioStats } from '../portfolio-stats';

const bots = [
  { id: 1, mode: 'DRY-RUN' as const },
  { id: 2, mode: 'LIVE' as const },
  { id: 3, mode: 'PAUSED' as const },
  { id: 4, mode: 'ERROR' as const },
  { id: 5, mode: 'STARTING' as const },
];
const perf = new Map([
  [1, { balance: 967.94, openTrades: 1 }],
  [2, { balance: 4820.11, openTrades: 2 }],
]);

describe('computePortfolioStats', () => {
  it('sums balance + open trades of running bots only', () => {
    const s = computePortfolioStats(bots, perf as any);
    expect(s.capitalDeployed).toBeCloseTo(5788.05, 2);
    expect(s.openTrades).toBe(3);
  });
  it('counts modes', () => {
    const s = computePortfolioStats(bots, perf as any);
    expect(s.total).toBe(5);
    expect(s.active).toBe(2); // LIVE + DRY-RUN
    expect(s.transitioning).toBe(1); // STARTING
    expect(s.idle).toBe(1); // PAUSED
    expect(s.error).toBe(1);
  });
  it('handles empty', () => {
    const s = computePortfolioStats([], new Map());
    expect(s.total).toBe(0);
    expect(s.capitalDeployed).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/features/bot-monitoring/__tests__/portfolio-stats.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/bot-monitoring/portfolio-stats.ts
import type { DashboardBotMode } from './bot-list.helpers';
import type { BotPerformance } from './bot-performance';

export interface PortfolioStats {
  capitalDeployed: number;
  openTrades: number;
  total: number;
  active: number;
  transitioning: number;
  idle: number;
  error: number;
}

const RUNNING: DashboardBotMode[] = ['LIVE', 'DRY-RUN'];
const TRANSIT: DashboardBotMode[] = ['STARTING', 'STOPPING'];

export function computePortfolioStats(
  bots: Array<{ id: number; mode: DashboardBotMode }>,
  perfById: Map<number, Pick<BotPerformance, 'balance' | 'openTrades'>>,
): PortfolioStats {
  let capitalDeployed = 0;
  let openTrades = 0;
  for (const b of bots) {
    if (!RUNNING.includes(b.mode)) continue;
    const p = perfById.get(b.id);
    if (p?.balance) capitalDeployed += p.balance;
    if (p?.openTrades) openTrades += p.openTrades;
  }
  return {
    capitalDeployed,
    openTrades,
    total: bots.length,
    active: bots.filter((b) => RUNNING.includes(b.mode)).length,
    transitioning: bots.filter((b) => TRANSIT.includes(b.mode)).length,
    idle: bots.filter((b) => b.mode === 'PAUSED').length,
    error: bots.filter((b) => b.mode === 'ERROR').length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/features/bot-monitoring/__tests__/portfolio-stats.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/portfolio-stats.ts src/features/bot-monitoring/__tests__/portfolio-stats.test.ts
git commit -m "feat(dashboard): computePortfolioStats hero aggregate (running bots only)"
```

---

### Task 5: API methods

**Files:**

- Modify: `src/features/bot-monitoring/bot.api.ts`
- Test: `src/features/bot-monitoring/__tests__/bot.api.dashboard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/bot-monitoring/__tests__/bot.api.dashboard.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { botApi } from '../bot.api';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  const ok = (data: unknown) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    } as Response);
  fetchMock.mockImplementation(() => ok({}));
});

describe('botApi dashboard methods', () => {
  it('getPerformance parses defensively', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ balance: 10, open_trades: 2 }),
      } as Response),
    );
    const p = await botApi.getPerformance(86);
    expect(p.balance).toBe(10);
    expect(p.openTrades).toBe(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/bot/86/performance');
  });

  it('getBacktestHistory hits /backtest/history with bot_id', async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ items: [], total: 0 }),
      } as Response),
    );
    await botApi.getBacktestHistory(86);
    expect(fetchMock.mock.calls[0][0]).toContain('/backtest/history?bot_id=86');
  });

  it('getBacktest hits /backtest/{id}', async () => {
    await botApi.getBacktest(200);
    expect(fetchMock.mock.calls[0][0]).toContain('/backtest/200');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/features/bot-monitoring/__tests__/bot.api.dashboard.test.ts`
Expected: FAIL — methods undefined.

- [ ] **Step 3: Write minimal implementation** — add to `bot.api.ts`

At the top, add imports + types:

```ts
import { parseBotPerformance, type BotPerformance } from './bot-performance';

export type BacktestHistoryItem = components['schemas']['BacktestHistoryItem'];
export type BacktestHistoryList = components['schemas']['BacktestHistoryList'];
```

Inside the `botApi` object (before the closing `}`):

```ts
  /** Untyped in openapi — parsed defensively. */
  getPerformance: (id: number): Promise<BotPerformance> =>
    http<unknown>('GET', `/bot/${id}/performance`).then(parseBotPerformance),
  getBacktestHistory: (botId: number, limit = 20) =>
    http<BacktestHistoryList>('GET', `/backtest/history?bot_id=${botId}&limit=${limit}`),
  getBacktest: (backtestId: number) =>
    http<BacktestHistoryItem>('GET', `/backtest/${backtestId}`),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/features/bot-monitoring/__tests__/bot.api.dashboard.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add src/features/bot-monitoring/bot.api.ts src/features/bot-monitoring/__tests__/bot.api.dashboard.test.ts
git commit -m "feat(dashboard): bot.api methods getPerformance/getBacktestHistory/getBacktest"
```

---

# PHASE 2 — Dashboard overview

Modified:

- `src/pages/DashboardPage.tsx` — hero = capital deployed; remove `MOCK_BOTS`; real empty state; fetch performance for running bots; route all bots to detail.
- Create: `src/features/bot-monitoring/BotCard.tsx` (extract + redesign) + `__tests__/BotCard.test.tsx`.
- Create: `src/features/bot-monitoring/DashboardEmptyState.tsx`.

Visual markup: mirror `public/dashboard-redesign-app-style.html` (#view-dash, #view-dash-empty) using existing tokens/components.

---

### Task 6: Extend `DashboardBot` with BE-real fields

The card needs balance/openTrades/leverage/stake/last-backtest. Add these to the row shape and populate in `zipBotsAndConfigs`.

**Files:**

- Modify: `src/features/bot-monitoring/bot-list.helpers.ts`
- Test: `src/features/bot-monitoring/__tests__/bot-list.helpers.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

```ts
// src/features/bot-monitoring/__tests__/bot-list.helpers.test.ts
import { describe, it, expect } from 'vitest';
import { zipBotsAndConfigs } from '../bot-list.helpers';

const bot = {
  id: 86,
  bot_name: 'Gamma',
  status: 'running',
  error_message: null,
  strategy_name: 'Gamma',
} as any;
const config = {
  dry_run: true,
  timeframe: '5m',
  exchange: { pair_whitelist: ['BTC/USDC:USDC'] },
  leverage: 10,
  stake_amount: 100,
  max_open_trades: 10,
  trading_mode: 'futures',
} as any;

describe('zipBotsAndConfigs config extraction', () => {
  it('pulls leverage/stake/max/tradingMode from config', () => {
    const [row] = zipBotsAndConfigs([bot], [config]);
    expect(row.leverage).toBe(10);
    expect(row.stakeAmount).toBe(100);
    expect(row.maxOpenTrades).toBe(10);
    expect(row.tradingMode).toBe('futures');
  });
  it('null-fills when config missing', () => {
    const [row] = zipBotsAndConfigs([bot], [null]);
    expect(row.leverage).toBeNull();
    expect(row.maxOpenTrades).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/features/bot-monitoring/__tests__/bot-list.helpers.test.ts`
Expected: FAIL — `leverage` not on row.

- [ ] **Step 3: Write minimal implementation**

In `bot-list.helpers.ts`, extend `ConfigShape`:

```ts
export interface ConfigShape {
  dry_run?: boolean | null;
  timeframe?: string | null;
  exchange?: { pair_whitelist?: string[] } | null;
  leverage?: number | null;
  stake_amount?: number | null;
  max_open_trades?: number | null;
  trading_mode?: string | null;
}
```

Extend `DashboardBot` (add after `dryRun`):

```ts
createdAt: string | null;
leverage: number | null;
stakeAmount: number | null;
maxOpenTrades: number | null;
tradingMode: string | null;
```

In `zipBotsAndConfigs` return object, add (`createdAt` from `bot.created_at`, the rest from config):

```ts
      createdAt: bot.created_at ?? null,
      leverage: config?.leverage ?? null,
      stakeAmount: config?.stake_amount ?? null,
      maxOpenTrades: config?.max_open_trades ?? null,
      tradingMode: config?.trading_mode ?? null,
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm test -- src/features/bot-monitoring/__tests__/bot-list.helpers.test.ts`
Expected: PASS. Then `pnpm typecheck` — fix any `DashboardBot` literal usages flagged (e.g. MOCK_BOTS in DashboardPage — handled in Task 9).

> Note: typecheck may flag `MOCK_BOTS` (missing new fields). That's expected; MOCK_BOTS is deleted in Task 9. If blocking, add the four fields as `null` to each MOCK_BOTS entry temporarily, or do Task 9 before re-running full typecheck.

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/bot-list.helpers.ts src/features/bot-monitoring/__tests__/bot-list.helpers.test.ts
git commit -m "feat(dashboard): add leverage/stake/maxTrades/tradingMode to DashboardBot"
```

---

### Task 7: `BotCard` component — extract + redesign (render tests)

Extract the inline `BotCard` from `DashboardPage.tsx` into its own file, redesigned per spec: badge by presentational state, name/meta, **Balance** hero, 4 micro-stats, last-backtest strip, action rows. Markup mirrors `#view-dash` cards in the mockup.

**Files:**

- Create: `src/features/bot-monitoring/BotCard.tsx`
- Test: `src/features/bot-monitoring/__tests__/BotCard.test.tsx`

- [ ] **Step 1: Write the failing test (state rendering)**

```tsx
// src/features/bot-monitoring/__tests__/BotCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BotCard } from '../BotCard';

const base = {
  id: 86,
  name: 'Gamma',
  pair: 'BTC/USDC:USDC',
  timeframe: '5m',
  leverage: 10,
  stakeAmount: 100,
  maxOpenTrades: 10,
  balance: 967.94,
  openTrades: 1,
  lastBacktest: {
    winRate: 44.2,
    trades: 104,
    netPct: -3.66,
    status: 'completed',
  },
  state: 'DRY-RUN' as const,
  errorMsg: null,
  createdAt: '2026-05-15',
};

const noop = () => {};
const handlers = {
  onClick: noop,
  onStart: noop,
  onStop: noop,
  onSync: noop,
  onRemove: noop,
  onBacktest: noop,
};

describe('BotCard', () => {
  it('renders balance + micro stats for a running bot', () => {
    render(<BotCard bot={base} {...handlers} />);
    expect(screen.getByText('967.94')).toBeInTheDocument();
    expect(screen.getByText(/1\s*\/\s*10/)).toBeInTheDocument(); // open/max
    expect(screen.getByText('44.2%')).toBeInTheDocument();
  });

  it('renders NEW empty hint + Run first backtest', () => {
    render(
      <BotCard
        bot={{ ...base, state: 'NEW', balance: null, lastBacktest: null }}
        {...handlers}
      />,
    );
    expect(screen.getByText(/Run first backtest/i)).toBeInTheDocument();
  });

  it('renders error_message for ERROR state', () => {
    render(
      <BotCard
        bot={{
          ...base,
          state: 'ERROR',
          errorMsg: 'Insufficient agent allowance',
        }}
        {...handlers}
      />,
    );
    expect(
      screen.getByText(/Insufficient agent allowance/),
    ).toBeInTheDocument();
  });

  it('renders backtest-failed message', () => {
    render(
      <BotCard
        bot={{
          ...base,
          state: 'BACKTEST_FAILED',
          lastBacktest: { ...base.lastBacktest, status: 'failed' },
        }}
        {...handlers}
      />,
    );
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
  });

  it('shows a spinner + status text while BACKTESTING (no %)', () => {
    render(<BotCard bot={{ ...base, state: 'BACKTESTING' }} {...handlers} />);
    expect(screen.getByText(/Backtesting/i)).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/features/bot-monitoring/__tests__/BotCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `BotCard.tsx`. Define the prop shape, then render per state. Use existing `Button` (`@/components/ui/button`) and Tailwind tokens. Copy badge color classes from the current inline `BotCard.modeStyle` (DashboardPage.tsx:846-853) and extend with `NEW`/`BACKTESTING`/`BACKTEST_FAILED` per the mockup (`.b-new`, `.b-bt`, paused+errline). Markup structure = mockup `#view-dash` card.

```tsx
// src/features/bot-monitoring/BotCard.tsx
import { Button } from '@/components/ui/button';
import {
  FlaskConical,
  Play,
  StopCircle,
  RefreshCcw,
  Trash2,
  Loader2,
} from 'lucide-react';
import type { PresentationalState } from './presentational-state';

export interface BotCardData {
  id: number;
  name: string;
  pair: string;
  timeframe: string;
  createdAt: string | null;
  leverage: number | null;
  stakeAmount: number | null;
  maxOpenTrades: number | null;
  balance: number | null;
  openTrades: number | null;
  state: PresentationalState;
  errorMsg: string | null;
  lastBacktest: {
    winRate: number | null;
    trades: number | null;
    netPct: number | null;
    status: string;
  } | null;
}

export interface BotCardProps {
  bot: BotCardData;
  onClick: () => void;
  onStart: () => void;
  onStop: () => void;
  onSync: () => void;
  onRemove: () => void;
  onBacktest: () => void;
}

const badgeClass: Record<PresentationalState, string> = {
  LIVE: 'border-bullish/30 bg-bullish-subtle text-bullish',
  'DRY-RUN': 'border-brand/30 bg-brand-subtle text-brand',
  PAUSED: 'border-fg-muted/30 bg-fg-muted/10 text-fg-muted',
  ERROR: 'border-bearish/40 bg-bearish-subtle text-bearish',
  STARTING: 'border-brand/20 bg-brand/5 text-brand/70',
  STOPPING: 'border-fg-muted/20 bg-fg-muted/5 text-fg-muted/70',
  NEW: 'border-dashed border-brand/35 bg-brand/5 text-brand',
  BACKTESTING: 'border-info/30 bg-info/10 text-info',
  BACKTEST_FAILED: 'border-fg-muted/30 bg-fg-muted/10 text-fg-muted',
};

const badgeLabel: Record<PresentationalState, string> = {
  LIVE: 'Live',
  'DRY-RUN': 'Dry-run',
  PAUSED: 'Paused',
  ERROR: '! Error',
  STARTING: 'Starting…',
  STOPPING: 'Stopping…',
  NEW: 'New',
  BACKTESTING: 'Backtesting',
  BACKTEST_FAILED: 'Paused',
};

const fmt = (n: number | null, d = 2) => (n == null ? '—' : n.toFixed(d));

export function BotCard({
  bot,
  onClick,
  onStart,
  onStop,
  onSync,
  onRemove,
  onBacktest,
}: BotCardProps) {
  const s = bot.state;
  return (
    <article
      role="link"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="card-coin98-flat cursor-pointer rounded-2xl p-4 transition hover:brightness-110"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span
            className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-2xs font-bold uppercase ${badgeClass[s]}`}
          >
            {badgeLabel[s]}
          </span>
          <h3 className="mt-2 truncate text-md font-semibold text-fg">
            {bot.name}
          </h3>
          <div className="text-xs text-fg-muted">
            {bot.pair} · {bot.timeframe}
            {bot.createdAt ? ` · created ${bot.createdAt}` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="text-fg-muted hover:text-fg"
          aria-label="More options"
        >
          ⋯
        </button>
      </div>

      {/* Balance hero (hidden for ERROR/transition states) */}
      {s !== 'ERROR' && s !== 'STARTING' && s !== 'STOPPING' && (
        <div className="mt-3 font-mono text-xl font-bold tabular-nums text-fg">
          {fmt(bot.balance)} <span className="text-xs text-fg-muted">USDC</span>
        </div>
      )}

      {/* Micro stats */}
      {s !== 'ERROR' && (
        <div className="mt-3 grid grid-cols-4 gap-2 text-2xs">
          <Stat
            label="Open"
            value={`${bot.openTrades ?? 0}/${bot.maxOpenTrades ?? '—'}`}
          />
          <Stat label="Lev" value={bot.leverage ? `${bot.leverage}×` : '—'} />
          <Stat label="Stake" value={fmt(bot.stakeAmount, 0)} />
          <Stat label="TF" value={bot.timeframe} />
        </div>
      )}

      {/* Backtesting — spinner + status text only (BE has no progress %) */}
      {s === 'BACKTESTING' && (
        <div className="mt-3 flex items-center gap-2 text-2xs text-info">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Backtesting…</span>
        </div>
      )}

      {/* NEW empty hint */}
      {s === 'NEW' && (
        <p className="mt-3 text-2xs text-fg-muted">
          No backtest yet · run one before going live ↓
        </p>
      )}

      {/* Last backtest strip */}
      {s !== 'NEW' &&
        s !== 'ERROR' &&
        s !== 'BACKTEST_FAILED' &&
        bot.lastBacktest && (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-border-subtle bg-black/20 px-2.5 py-2">
            <span className="text-2xs text-fg-muted">Last backtest</span>
            <div className="flex gap-3 text-right">
              <MiniStat
                k="Win"
                v={
                  bot.lastBacktest.winRate == null
                    ? '—'
                    : `${bot.lastBacktest.winRate}%`
                }
              />
              <MiniStat k="Trades" v={String(bot.lastBacktest.trades ?? '—')} />
              <MiniStat
                k="Net"
                v={
                  bot.lastBacktest.netPct == null
                    ? '—'
                    : `${bot.lastBacktest.netPct}%`
                }
                cls={
                  (bot.lastBacktest.netPct ?? 0) >= 0
                    ? 'text-bullish'
                    : 'text-bearish'
                }
              />
            </div>
          </div>
        )}

      {/* Error / backtest-failed messages */}
      {s === 'ERROR' && bot.errorMsg && (
        <p className="mt-3 text-xs text-bearish/90">
          <strong>error_message:</strong> {bot.errorMsg}
        </p>
      )}
      {s === 'BACKTEST_FAILED' && (
        <p className="mt-3 text-xs text-fg-muted">
          <strong>Backtest failed.</strong> Retry below.
        </p>
      )}

      {/* Actions */}
      <Actions
        bot={bot}
        onStart={onStart}
        onStop={onStop}
        onSync={onSync}
        onRemove={onRemove}
        onBacktest={onBacktest}
      />
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-fg-muted">{label}</div>
      <div className="font-mono font-semibold tabular-nums text-fg">
        {value}
      </div>
    </div>
  );
}
function MiniStat({
  k,
  v,
  cls = 'text-fg',
}: {
  k: string;
  v: string;
  cls?: string;
}) {
  return (
    <div>
      <div className="text-[9px] text-fg-muted">{k}</div>
      <div className={`font-mono text-xs font-semibold ${cls}`}>{v}</div>
    </div>
  );
}

function Actions({
  bot,
  onStart,
  onStop,
  onSync,
  onRemove,
  onBacktest,
}: Omit<BotCardProps, 'onClick'>) {
  const s = bot.state;
  if (s === 'STARTING' || s === 'STOPPING') {
    return (
      <div className="mt-3" onClick={(e) => e.stopPropagation()}>
        <Button variant="secondary" size="sm" className="w-full" disabled>
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          {s === 'STARTING' ? 'Starting…' : 'Stopping…'}
        </Button>
      </div>
    );
  }
  return (
    <div
      className="mt-3 flex flex-col gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        size="sm"
        className="border border-border-subtle text-fg-secondary hover:text-fg"
        disabled={s === 'BACKTESTING'}
        onClick={onBacktest}
      >
        <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
        {s === 'BACKTEST_FAILED'
          ? 'Retry backtest'
          : s === 'NEW'
            ? 'Run first backtest'
            : 'Backtest'}
      </Button>
      <div className="flex gap-1.5">
        {s === 'ERROR' ? (
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={onSync}
          >
            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
            Fix connection
          </Button>
        ) : s === 'LIVE' || s === 'DRY-RUN' ? (
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={onStop}
          >
            <StopCircle className="mr-1.5 h-3.5 w-3.5" />
            Stop
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={onStart}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Start
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="px-2 text-bearish hover:bg-bearish-subtle"
          aria-label="Delete bot"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm test -- src/features/bot-monitoring/__tests__/BotCard.test.tsx`
Expected: PASS (5 tests). Then `pnpm typecheck`.

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/BotCard.tsx src/features/bot-monitoring/__tests__/BotCard.test.tsx
git commit -m "feat(dashboard): redesigned BotCard with balance + state matrix"
```

---

### Task 8: `DashboardEmptyState` component

**Files:**

- Create: `src/features/bot-monitoring/DashboardEmptyState.tsx`
- Test: `src/features/bot-monitoring/__tests__/DashboardEmptyState.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/bot-monitoring/__tests__/DashboardEmptyState.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardEmptyState } from '../DashboardEmptyState';

describe('DashboardEmptyState', () => {
  it('renders CTA and fires callbacks', () => {
    const onCreate = vi.fn();
    const onImport = vi.fn();
    render(<DashboardEmptyState onCreate={onCreate} onImport={onImport} />);
    expect(screen.getByText(/No bots yet/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Create your first bot/i));
    expect(onCreate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/features/bot-monitoring/__tests__/DashboardEmptyState.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component** (markup = mockup `#view-dash-empty` empty card + 3 steps)

```tsx
// src/features/bot-monitoring/DashboardEmptyState.tsx
import { Button } from '@/components/ui/button';

export function DashboardEmptyState({
  onCreate,
  onImport,
}: {
  onCreate: () => void;
  onImport: () => void;
}) {
  return (
    <div className="card-coin98-flat flex flex-col items-center rounded-2xl p-16 text-center">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden>
        <rect
          x="7"
          y="7"
          width="50"
          height="50"
          rx="13"
          stroke="#474d57"
          strokeWidth="2"
          strokeDasharray="5 6"
        />
        <path
          d="M32 23V41M23 32H41"
          stroke="#f0b90b"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-4 text-lg font-bold text-fg">No bots yet</div>
      <p className="mt-2 max-w-md text-sm text-fg-secondary">
        Build your first trading bot — pick a pair, indicators and entry/exit
        rules. No Python required.
      </p>
      <div className="mt-5 flex gap-2.5">
        <Button variant="primary" onClick={onCreate}>
          ＋ Create your first bot
        </Button>
        <Button variant="secondary" onClick={onImport}>
          Import from JSON
        </Button>
      </div>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2 text-xs text-fg-secondary">
        <Step n={1} label="Build strategy" />{' '}
        <span className="text-fg-muted">→</span>
        <Step n={2} label="Backtest it" />{' '}
        <span className="text-fg-muted">→</span>
        <Step n={3} label="Dry-run / Go live" />
      </div>
    </div>
  );
}

function Step({ n, label }: { n: number; label: string }) {
  return (
    <span className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface px-3 py-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface-elevated font-mono text-2xs text-brand">
        {n}
      </span>
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/features/bot-monitoring/__tests__/DashboardEmptyState.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/DashboardEmptyState.tsx src/features/bot-monitoring/__tests__/DashboardEmptyState.test.tsx
git commit -m "feat(dashboard): real empty state replacing MOCK_BOTS fallback"
```

---

### Task 9: Wire `DashboardPage` — hero, performance fetch, routing, empty state

Rewire `DashboardPage.tsx`: delete `MOCK_BOTS` + `MockBot` + inline `BotCard`/`Sparkline`; use new `BotCard`, `DashboardEmptyState`, `computePortfolioStats`; fetch `/performance` for running bots; route every bot to `/bots/{id}`.

**Files:**

- Modify: `src/pages/DashboardPage.tsx`
- Test: `src/pages/__tests__/DashboardPage.test.tsx` (update existing)

- [ ] **Step 1: Update the test for new behavior**

Add/adjust tests in `DashboardPage.test.tsx`:

```tsx
// key cases — mock botApi.list/getConfig/getPerformance/getBacktestHistory
it('renders empty state when list is empty (no mock bots)', async () => {
  vi.spyOn(botApi, 'list').mockResolvedValue([]);
  render(<DashboardPage />, { wrapper });
  expect(await screen.findByText(/No bots yet/i)).toBeInTheDocument();
  expect(screen.queryByText('RSI Momentum Long')).not.toBeInTheDocument(); // old mock gone
});

it('shows capital deployed from running bots performance', async () => {
  vi.spyOn(botApi, 'list').mockResolvedValue([
    {
      id: 86,
      bot_name: 'Gamma',
      status: 'running',
      error_message: null,
      strategy_name: 'Gamma',
    },
  ] as any);
  vi.spyOn(botApi, 'getConfig').mockResolvedValue({
    config: {
      dry_run: true,
      timeframe: '5m',
      exchange: { pair_whitelist: ['BTC/USDC:USDC'] },
      leverage: 10,
      stake_amount: 100,
      max_open_trades: 10,
    },
  } as any);
  vi.spyOn(botApi, 'getPerformance').mockResolvedValue({
    balance: 967.94,
    openTrades: 1,
  });
  vi.spyOn(botApi, 'getBacktestHistory').mockResolvedValue({
    items: [],
    total: 0,
  } as any);
  render(<DashboardPage />, { wrapper });
  expect(await screen.findByText(/967\.94/)).toBeInTheDocument();
});

it('clicking a card navigates to detail for any bot', async () => {
  // ...mock a PAUSED bot, click card, assert navigate('/bots/{id}')
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/pages/__tests__/DashboardPage.test.tsx`
Expected: FAIL (mock bots still rendered / capital not shown).

- [ ] **Step 3: Implement the rewire**

In `DashboardPage.tsx`:

1. Delete `MOCK_BOTS`, `MockBot` type, inline `BotCard`, `Sparkline`, `buildRoundedSparklinePath`.
2. Import `{ BotCard }`, `{ DashboardEmptyState }`, `{ computePortfolioStats }`, `{ derivePresentationalState }`, `{ botApi }`.
3. After loading bots+configs, fetch performance for running bots + latest backtest per bot (parallel):

```ts
// after setRealBots(zipped) — enrich
const running = zipped.filter((b) => b.mode === 'LIVE' || b.mode === 'DRY-RUN');
const perfs = await Promise.allSettled(
  running.map((b) => botApi.getPerformance(b.id)),
);
const perfById = new Map<number, BotPerformance>();
running.forEach((b, i) => {
  const r = perfs[i];
  if (r.status === 'fulfilled') perfById.set(b.id, r.value);
});
// latest backtest per bot (limit=1, top-level fields only — ignore results blob)
const histories = await Promise.allSettled(
  zipped.map((b) => botApi.getBacktestHistory(b.id, 1)),
);
// latestStatus/historyCount per bot from histories[i].value.items[0]
```

4. Build `BotCardData[]` mapping each zipped row + perf + latest backtest item. Presentational state = `derivePresentationalState(b.mode, { historyCount: items.length, latestStatus: items[0]?.status ?? null })`. BACKTESTING is derived from the latest backtest status (`running`/`pending`) — **no `/jobs` call**.
5. `portfolioStats = computePortfolioStats(zipped, perfById)`.
6. Hero: big number = `portfolioStats.capitalDeployed.toLocaleString()` USDC; sub-line = active/total · idle · transitioning · open trades. **Remove** the 30D PnL big number, the 30D-return right column, `tradesToday`, `tradesNet`, `capitalDeployed:'—'` placeholders.
7. Empty state: when `realBots?.length === 0` render `<DashboardEmptyState onCreate={() => navigate('/builder')} onImport={() => setImportOpen(true)} />` (gate with `requireWalletThen`).
8. Card `onClick` → `navigate('/bots/${bot.id}')` for ALL bots. Keep `onStart` → `setLaunchBotTarget(...)` (opens LaunchpadModal). Keep stop/sync/remove/backtest handlers.

> Markup reference for hero: mockup `#view-dash` HERO section (already token-faithful). Keep existing `DotGridSpotlight`, halos, `AppHeader`, toolbar.

- [ ] **Step 4: Run tests + typecheck + lint**

Run: `pnpm test -- src/pages/__tests__/DashboardPage.test.tsx && pnpm typecheck && pnpm lint`
Expected: PASS / no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/DashboardPage.tsx src/pages/__tests__/DashboardPage.test.tsx
git commit -m "feat(dashboard): hero capital deployed, real empty state, perf fetch, route all bots to detail"
```

---

# PHASE 3 — Bot detail (replace mock BotMonitoringPage)

The current `BotMonitoringPage.tsx` (4014 lines) imports `botApi` from `./mockBotData` and renders mock orderbook/spot-feed/bubble/equity. Replace it with a lean page composed of BE-backed panels. Build panels first (each tested), then assemble.

New files (folder `src/features/bot-monitoring/detail/`):

- `DetailHero.tsx`, `PerformancePanel.tsx`, `BacktestEquityChart.tsx`, `RecentTradesPanel.tsx`, `StatusPanel.tsx`, `ConfigPanel.tsx`, `ActivityLogPanel.tsx`. (No `OpenPositionsPanel` — dropped from v1.)

Modified:

- `src/features/bot-monitoring/BotMonitoringPage.tsx` — gut + recompose.

Deleted (after recompose, Task 16):

- `mockBotData.ts`, `hyperliquid.service.ts` and other mock-only modules, **if** no other file imports them (verify with grep).

> Markup reference: mockup `#view-detail` and `#view-detail-empty`.

---

### Task 10: `BacktestEquityChart` (pure SVG from equity curve)

**Files:**

- Create: `src/features/bot-monitoring/detail/BacktestEquityChart.tsx`
- Test: `src/features/bot-monitoring/detail/__tests__/BacktestEquityChart.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BacktestEquityChart } from '../BacktestEquityChart';

describe('BacktestEquityChart', () => {
  it('renders an svg path for the curve', () => {
    const { container } = render(
      <BacktestEquityChart curve={[-3.5, -1.5, 0.9, -2]} />,
    );
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeGreaterThanOrEqual(2); // area + line
  });
  it('renders nothing for empty curve', () => {
    const { container } = render(<BacktestEquityChart curve={[]} />);
    expect(container.querySelector('path')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/features/bot-monitoring/detail/__tests__/BacktestEquityChart.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component** (port the SVG math from mockup `#equity` script — area + line + zero baseline)

```tsx
// src/features/bot-monitoring/detail/BacktestEquityChart.tsx
export function BacktestEquityChart({ curve }: { curve: number[] }) {
  if (curve.length < 2) return null;
  const W = 720,
    H = 150,
    p = 8;
  const min = Math.min(...curve),
    max = Math.max(...curve);
  const span = max - min || 1;
  const x = (i: number) => p + (i * (W - 2 * p)) / (curve.length - 1);
  const y = (v: number) => p + ((max - v) * (H - 2 * p)) / span;
  const zero = y(0);
  const line = curve
    .map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(curve.length - 1).toFixed(1)} ${zero.toFixed(1)} L${x(0).toFixed(1)} ${zero.toFixed(1)} Z`;
  const up = curve[curve.length - 1] >= 0;
  const stroke = up ? '#0ecb81' : '#f6465d';
  const fill = up ? 'rgba(14,203,129,0.26)' : 'rgba(246,70,93,0.26)';
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="block h-[150px] w-full"
    >
      <defs>
        <linearGradient id="eq-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} />
          <stop offset="100%" stopColor={fill.replace('0.26', '0')} />
        </linearGradient>
      </defs>
      <line
        x1={p}
        y1={zero}
        x2={W - p}
        y2={zero}
        stroke="#2b3139"
        strokeDasharray="3 3"
      />
      <path d={area} fill="url(#eq-grad)" />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/features/bot-monitoring/detail/__tests__/BacktestEquityChart.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/detail/BacktestEquityChart.tsx src/features/bot-monitoring/detail/__tests__/BacktestEquityChart.test.tsx
git commit -m "feat(detail): backtest equity chart (pure SVG)"
```

---

### Task 11: `PerformancePanel` (backtest metrics + chart + exit reasons)

Consumes a `BacktestHistoryItem`, uses `extractStrategyBlock`/`buildEquityCurve`/`extractBacktestMetrics`/`extractExitReasons` and `BacktestEquityChart`. Renders empty when no backtest.

**Files:**

- Create: `src/features/bot-monitoring/detail/PerformancePanel.tsx`
- Test: `src/features/bot-monitoring/detail/__tests__/PerformancePanel.test.tsx`

- [ ] **Step 1: Write the failing test** (reuse the `ITEM` fixture from Task 2; import or inline a trimmed copy)

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PerformancePanel } from '../PerformancePanel';

const ITEM = {
  /* same shape as Task 2 ITEM (Gamma, 104 trades, net -36.59, sharpe -3.42, win 44.23) */
} as any;

describe('PerformancePanel', () => {
  it('renders metrics from the backtest item', () => {
    render(<PerformancePanel item={ITEM} onRunBacktest={vi.fn()} />);
    expect(screen.getByText('104')).toBeInTheDocument(); // trades
    expect(screen.getByText(/-36\.59/)).toBeInTheDocument(); // net
    expect(screen.getByText(/-3\.42/)).toBeInTheDocument(); // sharpe
  });
  it('renders empty state when item is null', () => {
    render(<PerformancePanel item={null} onRunBacktest={vi.fn()} />);
    expect(screen.getByText(/No backtest yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/features/bot-monitoring/detail/__tests__/PerformancePanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component** (markup = mockup `#view-detail` Performance panel: header, chart, 8-metric grid, pills, exit-reason bars; empty = mockup `#view-detail-empty` Performance pempty)

```tsx
// src/features/bot-monitoring/detail/PerformancePanel.tsx
import { Button } from '@/components/ui/button';
import {
  extractStrategyBlock,
  buildEquityCurve,
  extractBacktestMetrics,
  extractExitReasons,
  type BacktestHistoryItem,
} from '../backtest-results';
import { BacktestEquityChart } from './BacktestEquityChart';

const f = (n: number | null, d = 2, suffix = '') =>
  n == null ? '—' : `${n.toFixed(d)}${suffix}`;

export function PerformancePanel({
  item,
  onRunBacktest,
}: {
  item: BacktestHistoryItem | null;
  onRunBacktest: () => void;
}) {
  const block = item ? extractStrategyBlock(item) : null;
  if (!item || !block) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface/40">
        <div className="border-b border-border-subtle px-4 py-3 text-sm font-bold text-fg">
          Performance
        </div>
        <div className="px-4 py-8 text-center text-sm text-fg-muted">
          <div className="font-semibold text-fg-secondary">No backtest yet</div>
          <p className="mt-1.5">
            Run a backtest to see equity curve, win rate, Sharpe and drawdown
            before committing real funds.
          </p>
          <Button variant="primary" className="mt-4" onClick={onRunBacktest}>
            Run first backtest
          </Button>
        </div>
      </div>
    );
  }
  const m = extractBacktestMetrics(block);
  const curve = buildEquityCurve(block);
  const exits = extractExitReasons(block);
  const cells: Array<[string, string, boolean?]> = [
    ['Net profit', f(m.netAbs), (m.netAbs ?? 0) < 0],
    ['Win rate', f(m.winRatePct, 1, '%')],
    ['Trades', String(m.trades ?? '—')],
    ['Profit factor', f(m.profitFactor)],
    ['Sharpe', f(m.sharpe)],
    ['Sortino', f(m.sortino)],
    ['Max drawdown', f(m.maxDrawdownAbs)],
    ['Trades/day', f(m.tradesPerDay)],
  ];
  return (
    <div className="rounded-xl border border-border-subtle bg-surface/40">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <span className="text-sm font-bold text-fg">
          Performance · run #{item.id}
        </span>
        <span className="text-xs text-fg-muted">
          {item.timerange} · {item.timeframe}
        </span>
      </div>
      <div className="p-4">
        <BacktestEquityChart curve={curve} />
        <div className="mt-5 grid grid-cols-4 gap-2.5">
          {cells.map(([l, v, neg]) => (
            <div
              key={l}
              className="rounded-lg border border-border-subtle bg-black/20 p-3"
            >
              <div className="text-2xs text-fg-muted">{l}</div>
              <div
                className={`mt-1 font-mono text-lg font-bold ${neg ? 'text-bearish' : 'text-fg'}`}
              >
                {v}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3.5 flex flex-wrap gap-2">
          <Pill
            text={`Long ${m.longCount ?? '—'} · Short ${m.shortCount ?? '—'}`}
          />
          <Pill text={`Wins ${m.wins ?? '—'} / Losses ${m.losses ?? '—'}`} />
          <Pill text={`Avg stake ${f(m.avgStake)}`} />
          <Pill text={`Expectancy ${f(m.expectancy)}`} />
          {m.marketChangePct != null && (
            <Pill text={`vs Market ${m.marketChangePct}%`} />
          )}
        </div>
        {exits.length > 0 && (
          <>
            <div className="mb-2 mt-5 text-2xs uppercase tracking-widest text-fg-muted">
              Exit reasons
            </div>
            {exits.map((e) => {
              const maxAbs = Math.max(
                ...exits.map((x) => Math.abs(x.profitAbs)),
                1,
              );
              return (
                <div
                  key={e.key}
                  className="flex items-center gap-2.5 py-1.5 text-xs"
                >
                  <span className="w-36 truncate">{e.key}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded bg-border">
                    <div
                      className={
                        e.profitAbs >= 0
                          ? 'h-full bg-bullish'
                          : 'h-full bg-bearish'
                      }
                      style={{
                        width: `${(Math.abs(e.profitAbs) / maxAbs) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-28 text-right font-mono text-fg-secondary">
                    {e.trades} · {e.profitAbs.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
function Pill({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-xs text-fg-secondary">
      {text}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/features/bot-monitoring/detail/__tests__/PerformancePanel.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/detail/PerformancePanel.tsx src/features/bot-monitoring/detail/__tests__/PerformancePanel.test.tsx
git commit -m "feat(detail): PerformancePanel from backtest results"
```

---

### Task 12: `StatusPanel`, `ConfigPanel`, `ActivityLogPanel` (BE-real, key-value)

Three small read-only panels. Build together (one commit).

**Files:**

- Create: `src/features/bot-monitoring/detail/StatusPanel.tsx`, `ConfigPanel.tsx`, `ActivityLogPanel.tsx`
- Test: `src/features/bot-monitoring/detail/__tests__/info-panels.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusPanel } from '../StatusPanel';
import { ConfigPanel } from '../ConfigPanel';
import { ActivityLogPanel } from '../ActivityLogPanel';

describe('info panels', () => {
  it('StatusPanel shows state + heartbeat', () => {
    render(
      <StatusPanel
        status={
          {
            status: 'running',
            desired_status: 'running',
            is_process_running: true,
            last_heartbeat: '2026-06-06T00:00:00Z',
            error_message: null,
          } as any
        }
      />,
    );
    expect(screen.getByText('running')).toBeInTheDocument();
  });
  it('ConfigPanel renders config rows', () => {
    render(
      <ConfigPanel
        config={
          {
            exchange_name: 'hyperliquid',
            stake_currency: 'USDC',
            stake_amount: 100,
            max_open_trades: 10,
            trading_mode: 'futures',
            leverage: 10,
          } as any
        }
      />,
    );
    expect(screen.getByText('hyperliquid')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });
  it('ActivityLogPanel lists audit rows + empty', () => {
    render(
      <ActivityLogPanel
        logs={[
          {
            id: 1,
            action: 'start',
            triggered_by: 'user',
            result: 'ok',
            timestamp: '2026-06-06T00:00:00Z',
          } as any,
        ]}
      />,
    );
    expect(screen.getByText(/start/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/features/bot-monitoring/detail/__tests__/info-panels.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the three components**

Each is a `<Panel>` with key/value rows (markup = mockup `#view-detail` right column). Use `BotStatusOut` for StatusPanel, the raw config object for ConfigPanel, `BotAuditLogOut[]` for ActivityLogPanel. Render `—` for null fields. ActivityLogPanel shows an empty hint when `logs.length === 0`.

```tsx
// StatusPanel.tsx
import type { BotStatusOut } from '../bot.api';
export function StatusPanel({ status }: { status: BotStatusOut | null }) {
  const v = (x: unknown) => (x == null || x === '' ? '—' : String(x));
  return (
    <Panel title="Status & process">
      <KV k="State" v={v(status?.status)} accent />
      <KV k="Desired status" v={v(status?.desired_status)} />
      <KV k="Process" v={status?.is_process_running ? 'up' : 'down'} />
      <KV k="Last heartbeat" v={v(status?.last_heartbeat)} />
      <KV k="Error" v={v(status?.error_message)} />
    </Panel>
  );
}
// Panel + KV are shared — put them in detail/panel-kit.tsx and import in all three.
```

Create `src/features/bot-monitoring/detail/panel-kit.tsx`:

```tsx
export function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface/40">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <span className="text-sm font-bold text-fg">{title}</span>
        {hint && <span className="text-xs text-fg-muted">{hint}</span>}
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  );
}
export function KV({
  k,
  v,
  accent,
}: {
  k: string;
  v: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border-subtle py-2 text-xs last:border-0">
      <span className="text-fg-secondary">{k}</span>
      <span
        className={`font-mono font-semibold ${accent ? 'text-bullish' : 'text-fg'}`}
      >
        {v}
      </span>
    </div>
  );
}
```

`ConfigPanel.tsx` renders KV rows for exchange_name, stake_currency, stake_amount, max_open_trades, trading_mode, margin_mode, leverage, stoploss, trailing_stop, dry_run_wallet (read off the raw config object, `?? '—'`). `ActivityLogPanel.tsx` maps logs to `KV` (`k={`${log.action} · ${log.triggered_by}`}` v={relativeTime(log.timestamp)}); empty → `<p className="py-6 text-center text-xs text-fg-muted">No activity yet</p>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/features/bot-monitoring/detail/__tests__/info-panels.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/detail/StatusPanel.tsx src/features/bot-monitoring/detail/ConfigPanel.tsx src/features/bot-monitoring/detail/ActivityLogPanel.tsx src/features/bot-monitoring/detail/panel-kit.tsx src/features/bot-monitoring/detail/__tests__/info-panels.test.tsx
git commit -m "feat(detail): Status/Config/Activity panels (BE-real key-value)"
```

---

### Task 13: `RecentTradesPanel`

`RecentTradesPanel` renders the last N rows of `block.trades` (from backtest). **No OpenPositionsPanel** — live open positions dropped from v1 (`/open_trades` untyped, per spec §10 decision #2).

**Files:**

- Create: `src/features/bot-monitoring/detail/RecentTradesPanel.tsx`
- Test: `src/features/bot-monitoring/detail/__tests__/trades-panels.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecentTradesPanel } from '../RecentTradesPanel';

const trades = [
  {
    pair: 'BTC/USDC:USDC',
    is_short: false,
    leverage: 10,
    open_rate: 78938,
    close_rate: 79088,
    profit_abs: 0.98,
    profit_ratio: 0.0098,
    funding_fees: -0.02,
    close_timestamp: 1,
  },
] as any;

describe('RecentTradesPanel', () => {
  it('renders rows', () => {
    render(<RecentTradesPanel trades={trades} />);
    expect(screen.getByText('LONG')).toBeInTheDocument();
    expect(screen.getByText(/78,?938/)).toBeInTheDocument();
  });
  it('empty', () => {
    render(<RecentTradesPanel trades={[]} />);
    expect(screen.getByText(/No trades yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/features/bot-monitoring/detail/__tests__/trades-panels.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the component** (markup = mockup `#view-detail` Recent trades table; reuse `Panel`)

`RecentTradesPanel`: table headers Pair/Side/Entry/Exit/Lev/PnL/%/Funding; rows from `trades.slice(0, 8)`; side LONG/SHORT from `is_short`; PnL color by sign; empty → "No trades yet".

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/features/bot-monitoring/detail/__tests__/trades-panels.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/detail/RecentTradesPanel.tsx src/features/bot-monitoring/detail/__tests__/trades-panels.test.tsx
git commit -m "feat(detail): RecentTrades panel (from backtest results)"
```

---

### Task 14: `DetailHero`

Header with name/badge/state, meta (pair/tf/exchange/**created**), KPI row (Balance, Open trades from `/performance`; **Win rate + Net from last backtest**). No PnL-today / win-rate-live / uptime (dropped — BE has none). Action buttons (Sync/Restart/Stop, or Start for non-running). Markup = mockup `#view-detail` hero (+ `#view-detail-empty` for not-started).

**Files:**

- Create: `src/features/bot-monitoring/detail/DetailHero.tsx`
- Test: `src/features/bot-monitoring/detail/__tests__/DetailHero.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DetailHero } from '../DetailHero';

const base = {
  name: 'Gamma',
  state: 'DRY-RUN' as const,
  pair: 'BTC/USDC:USDC',
  timeframe: '5m',
  exchange: 'hyperliquid',
  tradingMode: 'futures',
  createdAt: '2026-05-15',
  balance: 967.94,
  openTrades: 1,
  maxOpenTrades: 10,
  lastBacktest: { winRate: 44.2, netPct: -3.66 },
};
const h = {
  onSync: vi.fn(),
  onRestart: vi.fn(),
  onStop: vi.fn(),
  onStart: vi.fn(),
};

describe('DetailHero', () => {
  it('shows balance and open trades', () => {
    render(<DetailHero bot={base} {...h} />);
    expect(screen.getByText(/967\.94/)).toBeInTheDocument();
  });
  it('shows win rate + net from last backtest (no live PnL field)', () => {
    render(<DetailHero bot={base} {...h} />);
    expect(screen.getByText(/44\.2%/)).toBeInTheDocument();
    expect(screen.queryByText(/PnL today/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/needs BE/i)).not.toBeInTheDocument();
  });
  it('shows created date, not uptime', () => {
    render(<DetailHero bot={base} {...h} />);
    expect(screen.getByText(/2026-05-15/)).toBeInTheDocument();
    expect(screen.queryByText(/uptime/i)).not.toBeInTheDocument();
  });
  it('shows Start for a not-started bot', () => {
    render(
      <DetailHero bot={{ ...base, state: 'NEW', balance: null }} {...h} />,
    );
    expect(screen.getByText(/Start/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/features/bot-monitoring/detail/__tests__/DetailHero.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component** — KPIs: Balance + Open trades (`/performance`); Win rate + Net (`lastBacktest`, `—` if no backtest). Meta shows `created {createdAt}` (no uptime). Action row: NEW/PAUSED/ERROR → Start/Fix; LIVE/DRY-RUN → Sync/Restart/Stop.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/features/bot-monitoring/detail/__tests__/DetailHero.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/detail/DetailHero.tsx src/features/bot-monitoring/detail/__tests__/DetailHero.test.tsx
git commit -m "feat(detail): DetailHero with conditional live KPIs"
```

---

### Task 15: Recompose `BotMonitoringPage`

Replace the page body: fetch real data, compose the panels, handle loading/empty/not-started. Keep existing lifecycle wiring patterns from the old page where BE-real (`lifecycleApi` = `bot.api`, `useBotStatusPoll`, `ConfirmActionDialog`).

**Files:**

- Modify: `src/features/bot-monitoring/BotMonitoringPage.tsx`
- Test: `src/features/bot-monitoring/__tests__/BotMonitoringPage.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { BotMonitoringPage } from '../BotMonitoringPage';
import { botApi } from '../bot.api';

const wrap = (id: number) => (
  <MemoryRouter initialEntries={[`/bots/${id}`]}>
    <Routes>
      <Route path="/bots/:id" element={<BotMonitoringPage />} />
    </Routes>
  </MemoryRouter>
);

beforeEach(() => {
  vi.spyOn(botApi, 'getStatus').mockResolvedValue({
    id: 86,
    status: 'running',
    desired_status: 'running',
    is_process_running: true,
    error_message: null,
    last_heartbeat: null,
  } as any);
  vi.spyOn(botApi, 'getConfig').mockResolvedValue({
    config: {
      dry_run: true,
      timeframe: '5m',
      exchange: { pair_whitelist: ['BTC/USDC:USDC'] },
      exchange_name: 'hyperliquid',
      stake_currency: 'USDC',
      stake_amount: 100,
      max_open_trades: 10,
      trading_mode: 'futures',
      leverage: 10,
    },
  } as any);
  vi.spyOn(botApi, 'getPerformance').mockResolvedValue({
    balance: 967.94,
    openTrades: 1,
  });
  vi.spyOn(botApi, 'getBacktestHistory').mockResolvedValue({
    items: [{ id: 200, status: 'completed' }],
    total: 1,
  } as any);
  vi.spyOn(botApi, 'getBacktest').mockResolvedValue({
    id: 200,
    strategy_name: 'Gamma',
    timerange: '20260427-20260527',
    timeframe: '5m',
    results: {
      strategy: {
        Gamma: {
          trades: [{ profit_abs: 1, close_timestamp: 1 }],
          total_trades: 104,
          profit_total_abs: -36.59,
          best_pair: { winrate: 0.4423 },
        },
      },
    },
  } as any);
  vi.spyOn(botApi, 'getAuditLogs' as any).mockResolvedValue([]);
});

describe('BotMonitoringPage', () => {
  it('renders detail with balance + performance', async () => {
    render(wrap(86));
    expect(await screen.findByText(/967\.94/)).toBeInTheDocument();
    expect(await screen.findByText('104')).toBeInTheDocument();
  });
  it('renders not-started empty panels for a new bot', async () => {
    vi.spyOn(botApi, 'getStatus').mockResolvedValue({
      id: 9,
      status: 'stopped',
      desired_status: 'stopped',
      is_process_running: false,
      error_message: null,
      last_heartbeat: null,
    } as any);
    vi.spyOn(botApi, 'getBacktestHistory').mockResolvedValue({
      items: [],
      total: 0,
    } as any);
    render(wrap(9));
    expect(await screen.findByText(/No backtest yet/i)).toBeInTheDocument();
  });
});
```

> If `botApi.getAuditLogs` doesn't exist, add it in this task: `getAuditLogs: (id: number, limit = 50) => http<BotAuditLogOut[]>('GET', `/bot/${id}/audit_logs?limit=${limit}`)` with `export type BotAuditLogOut = components['schemas']['BotAuditLogOut'];`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/features/bot-monitoring/__tests__/BotMonitoringPage.test.tsx`
Expected: FAIL (old page renders mock UI / panels not wired).

- [ ] **Step 3: Recompose the page**

Gut `BotMonitoringPage.tsx`. Remove: `import { botApi } from './mockBotData'`, `hyperliquid.service`, and all mock hooks/components (`useSnapshot`, `useFills`, `useEquityCurve`, `useHyperliquid*`, `useCycle`, `EquityCurve`, `LiveSpotFeed`, `ExecutionPipeline`, `OrderBookL2`, `GainersLosers*`, bubble physics, `RecentFills`, `HeroPnL`, `CypheusRail`, etc.). Keep `lifecycleApi`/`bot.api`, `useBotStatusPoll`, `ConfirmActionDialog`, `DotGridSpotlight`, `AppHeader`/header pattern, `LaunchpadModal` wiring.

New body:

```tsx
export function BotMonitoringPage() {
  const { id } = useParams();
  const botId = Number(id);
  // fetch status, config, performance, latest backtest item, audit logs (parallel, best-effort)
  // derive mode (deriveMode) + presentational state
  // compose:
  //   <DetailHero ... />
  //   <div className="grid grid-cols-[1fr_320px] gap-4">
  //     <div className="flex flex-col gap-4">
  //       <PerformancePanel item={latestBacktestItem} onRunBacktest={openBacktest} />
  //       <RecentTradesPanel trades={blockTrades} />
  //     </div>
  //     <div className="flex flex-col gap-4">
  //       <StatusPanel status={status} />
  //       <ConfigPanel config={rawConfig} />
  //       <ActivityLogPanel logs={auditLogs} />
  //     </div>
  //   </div>
  // wire BacktestDialog + LaunchpadModal + ConfirmActionDialog (stop/remove) as on Dashboard
}
```

Fetch the latest backtest item: `getBacktestHistory(botId, 1)` → if `items[0]` and `items[0].status === 'completed'` → `getBacktest(items[0].id)` for the full `results`. `blockTrades = extractStrategyBlock(item)?.trades ?? []`.

- [ ] **Step 4: Run tests + typecheck + lint**

Run: `pnpm test -- src/features/bot-monitoring/__tests__/BotMonitoringPage.test.tsx && pnpm typecheck && pnpm lint`
Expected: PASS / no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/BotMonitoringPage.tsx src/features/bot-monitoring/__tests__/BotMonitoringPage.test.tsx src/features/bot-monitoring/bot.api.ts
git commit -m "feat(detail): recompose BotMonitoringPage from BE-backed panels"
```

---

### Task 16: Remove dead mock modules

After recompose, delete mock-only modules **iff** unused.

**Files:**

- Delete (conditional): `src/features/bot-monitoring/mockBotData.ts`, `hyperliquid.service.ts`, and any component file now unused.

- [ ] **Step 1: Find remaining importers**

Run:

```bash
grep -rn "mockBotData\|hyperliquid.service" src --include=*.ts --include=*.tsx | grep -v "__tests__"
```

Expected: only the files about to be deleted (or none). If other production files import them, STOP and leave them — note the importer in the commit body.

- [ ] **Step 2: Delete unused files + their tests**

```bash
git rm src/features/bot-monitoring/mockBotData.ts src/features/bot-monitoring/hyperliquid.service.ts
# plus any now-unused mock test files surfaced by step 1
```

- [ ] **Step 3: Verify build**

Run: `pnpm typecheck && pnpm test`
Expected: no missing-module errors; all tests pass.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(detail): remove dead mock data/service modules"
```

---

### Task 17: Full verification pass

- [ ] **Step 1: Run the whole suite + checks**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm format`
Expected: all green.

- [ ] **Step 2: Manual smoke (per CLAUDE.md §9.5)**

Run `pnpm dev`, log in with the test wallet, verify: dashboard hero shows capital deployed; cards show balance + last backtest; empty state when no bots; clicking any card opens detail; detail shows backtest performance + config + status; a never-run bot shows empty panels.

- [ ] **Step 3: Commit any format-only changes**

```bash
git add -A && git commit -m "chore(dashboard): prettier format" || echo "nothing to format"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**

- Hero capital deployed → Task 4 + Task 9 ✓
- BotCard balance + micro-stats + last backtest + 9 states → Task 6, 7 ✓
- Empty dashboard state (no MOCK_BOTS) → Task 8, 9 ✓
- Routing all bots to detail → Task 9 ✓
- Detail performance from backtest (equity/metrics/exits) → Task 2, 10, 11 ✓
- Status/Config/Activity panels → Task 12 ✓
- Recent trades from backtest (Open positions dropped) → Task 13 ✓
- Detail hero KPIs = Balance/Open (live) + Win/Net (backtest); created not uptime → Task 14 ✓
- Recompose page + remove mocks → Task 15, 16 ✓
- `/performance` defensive parse, balance+open only (untyped) → Task 1 ✓
- presentational state from backtest-history status (not deriveMode, not /jobs) → Task 3 ✓
- BE asks → documented in spec §7 (future-only; v1 has no blocker)

**Removed from v1 (only-BE-real principle, spec §6/§10):** PnL live, win-rate live, uptime, backtest progress %, live open positions, 30D return, trades today. None appear in any task; no `needs BE` placeholders in UI.

**Type consistency:** `BotPerformance` (Task 1, balance+openTrades) reused in Tasks 4/9/15; `PresentationalState` (Task 3) reused in Task 7; `PresentationalContext` = `{historyCount, latestStatus}` (Task 3) fed by Task 9; `BacktestHistoryItem`/`StrategyBlock` (Task 2) reused in Tasks 11/15; `BotCardData` (Task 7, `createdAt` not `uptime`, no `backtestProgress`) fed by Task 9. ✓

**Known external dependency:** `/performance` candidate keys (Task 1, balance/open-trades only) require confirming against a real response; FE degrades to `—` until then. No `/open_trades`/`/jobs` dependency in v1.
