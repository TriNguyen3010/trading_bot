# Dashboard Card-Grid Redesign (direction D) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `/dashboard` overview to direction D (Card Grid): a compact portfolio KPI bar, a status-filter toolbar, and a uniform responsive grid of redesigned bot cards with an explicit sort order.

**Architecture:** Pure helpers (`bot-sort`, `bot-filter`) compute order + filter buckets from the existing `BotCardData[]`. New presentational components (`PortfolioBar`, `OpenTradesGauge`, `StatusFilterChips`) replace the old hero. `BotCard` is rebuilt to the D anatomy preserving the existing `mode`-driven action logic and per-state display rules. `DashboardPage` wires it together; data loading / polling / lifecycle are untouched.

**Tech Stack:** React 18, TypeScript, Tailwind (tokens in `src/styles/tokens.css`), Vitest + Testing Library, lucide-react, `cn()` from `@/lib/utils`.

**Spec:** `docs/superpowers/specs/2026-06-08-dashboard-card-grid-redesign-design.md`. Visual source of truth: `public/dashboard-v2-cards.html`.

**Decisions baked in (from spec §10, recommended defaults):** D-1 triage-first sort · D-2 DRY-RUN badge = blue/info · D-3 ship the 6-chip filter. If Tri flips any on review, each is a localized change (noted at the relevant task).

---

## File map

| File                                                                           | Responsibility                                                                          |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `src/features/bot-monitoring/bot-sort.ts`                                      | **New.** `sortCards()` — triage-first stable ordering.                                  |
| `src/features/bot-monitoring/bot-filter.ts`                                    | **New.** Filter categories, `matchesCategory`, `filterByCategory`, `countByCategory`.   |
| `src/features/bot-monitoring/OpenTradesGauge.tsx`                              | **New.** Segmented pip gauge for `open/max`.                                            |
| `src/features/bot-monitoring/PortfolioBar.tsx`                                 | **New.** Horizontal KPI bar (+ refresh).                                                |
| `src/features/bot-monitoring/StatusFilterChips.tsx`                            | **New.** Status filter chips + counts.                                                  |
| `src/features/bot-monitoring/BotCard.tsx`                                      | **Rebuild** to D anatomy; preserve action/display logic.                                |
| `src/pages/DashboardPage.tsx`                                                  | **Modify** layout: PortfolioBar + chips + sort/filter + container width + state gating. |
| `__tests__/bot-sort.test.ts`, `bot-filter.test.ts`, `OpenTradesGauge.test.tsx` | **New** tests.                                                                          |
| `__tests__/BotCard.test.tsx`, `DashboardPage.test.tsx`                         | Keep green; extend.                                                                     |

All test files live in `src/features/bot-monitoring/__tests__/` (or `src/pages/__tests__/` for the page), matching the existing convention.

---

### Task 1: `bot-sort.ts` — triage-first card ordering

**Files:**

- Create: `src/features/bot-monitoring/bot-sort.ts`
- Test: `src/features/bot-monitoring/__tests__/bot-sort.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/bot-monitoring/__tests__/bot-sort.test.ts
import { describe, it, expect } from 'vitest';
import { sortCards } from '../bot-sort';
import type { BotCardData } from '../BotCard';

function card(
  p: Partial<BotCardData> & Pick<BotCardData, 'id' | 'state'>,
): BotCardData {
  return {
    id: p.id,
    name: p.name ?? `Bot ${p.id}`,
    pair: 'BTC/USDC',
    timeframe: '1h',
    createdAt: p.createdAt ?? '2026-01-01',
    stakeAmount: 100,
    maxOpenTrades: 5,
    balance: p.balance ?? null,
    openTrades: 0,
    mode: p.mode ?? 'PAUSED',
    state: p.state,
    errorMsg: null,
    lastBacktest: null,
  };
}

describe('sortCards', () => {
  it('orders buckets: needs-attention, working, running, idle, new', () => {
    const input = [
      card({ id: 1, state: 'NEW' }),
      card({ id: 2, state: 'PAUSED' }),
      card({ id: 3, state: 'LIVE', mode: 'LIVE', balance: 100 }),
      card({ id: 4, state: 'BACKTESTING', mode: 'PAUSED', balance: 50 }),
      card({ id: 5, state: 'ERROR', mode: 'ERROR' }),
    ];
    expect(sortCards(input).map((c) => c.id)).toEqual([5, 4, 3, 2, 1]);
  });

  it('within running: LIVE before DRY-RUN, then balance desc', () => {
    const input = [
      card({ id: 1, state: 'DRY-RUN', mode: 'DRY-RUN', balance: 999 }),
      card({ id: 2, state: 'LIVE', mode: 'LIVE', balance: 10 }),
      card({ id: 3, state: 'LIVE', mode: 'LIVE', balance: 80 }),
    ];
    expect(sortCards(input).map((c) => c.id)).toEqual([3, 2, 1]);
  });

  it('within needs-attention: ERROR before BACKTEST_FAILED', () => {
    const input = [
      card({ id: 1, state: 'BACKTEST_FAILED' }),
      card({ id: 2, state: 'ERROR', mode: 'ERROR' }),
    ];
    expect(sortCards(input).map((c) => c.id)).toEqual([2, 1]);
  });

  it('is stable: equal-bucket equal-key bots keep id-ascending order', () => {
    const input = [
      card({ id: 9, state: 'LIVE', mode: 'LIVE', balance: 100 }),
      card({ id: 4, state: 'LIVE', mode: 'LIVE', balance: 100 }),
    ];
    expect(sortCards(input).map((c) => c.id)).toEqual([4, 9]);
  });

  it('does not mutate the input array', () => {
    const input = [
      card({ id: 1, state: 'LIVE', mode: 'LIVE' }),
      card({ id: 2, state: 'ERROR', mode: 'ERROR' }),
    ];
    const before = input.map((c) => c.id);
    sortCards(input);
    expect(input.map((c) => c.id)).toEqual(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- bot-sort`
Expected: FAIL — `Cannot find module '../bot-sort'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/features/bot-monitoring/bot-sort.ts
import type { BotCardData } from './BotCard';
import type { PresentationalState } from './presentational-state';

/** Bucket priority — lower renders first (top-left). See spec §6.2. */
const BUCKET: Record<PresentationalState, number> = {
  ERROR: 0,
  BACKTEST_FAILED: 0,
  STARTING: 1,
  STOPPING: 1,
  BACKTESTING: 1,
  LIVE: 2,
  'DRY-RUN': 2,
  PAUSED: 3,
  NEW: 4,
};

function byBalanceDesc(a: BotCardData, b: BotCardData): number {
  return (b.balance ?? -Infinity) - (a.balance ?? -Infinity);
}

/** ISO date strings sort lexicographically; newest first = descending. */
function byCreatedDesc(a: BotCardData, b: BotCardData): number {
  return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
}

function compareCards(a: BotCardData, b: BotCardData): number {
  const ba = BUCKET[a.state];
  const bb = BUCKET[b.state];
  if (ba !== bb) return ba - bb;

  switch (ba) {
    case 0: {
      // Needs attention: ERROR before BACKTEST_FAILED, then name.
      const sa = a.state === 'ERROR' ? 0 : 1;
      const sb = b.state === 'ERROR' ? 0 : 1;
      if (sa !== sb) return sa - sb;
      const n = a.name.localeCompare(b.name);
      if (n !== 0) return n;
      break;
    }
    case 1: {
      // Working: balance desc, then name.
      const c = byBalanceDesc(a, b);
      if (c !== 0) return c;
      const n = a.name.localeCompare(b.name);
      if (n !== 0) return n;
      break;
    }
    case 2: {
      // Running: LIVE before DRY-RUN, then balance desc.
      const sa = a.state === 'LIVE' ? 0 : 1;
      const sb = b.state === 'LIVE' ? 0 : 1;
      if (sa !== sb) return sa - sb;
      const c = byBalanceDesc(a, b);
      if (c !== 0) return c;
      break;
    }
    case 3:
    case 4: {
      // Idle / New: newest first.
      const c = byCreatedDesc(a, b);
      if (c !== 0) return c;
      break;
    }
  }
  return a.id - b.id; // stable final tiebreak
}

export function sortCards(cards: BotCardData[]): BotCardData[] {
  return [...cards].sort(compareCards);
}
```

> **If Tri picks value-first (D-1):** swap the BUCKET values so `LIVE`/`DRY-RUN` = 0 and shift the rest down. Nothing else changes.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- bot-sort`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/bot-sort.ts src/features/bot-monitoring/__tests__/bot-sort.test.ts
git commit -m "feat(dashboard): add triage-first card sort helper"
```

---

### Task 2: `bot-filter.ts` — status filter categories

**Files:**

- Create: `src/features/bot-monitoring/bot-filter.ts`
- Test: `src/features/bot-monitoring/__tests__/bot-filter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/bot-monitoring/__tests__/bot-filter.test.ts
import { describe, it, expect } from 'vitest';
import {
  matchesCategory,
  filterByCategory,
  countByCategory,
  type FilterCategory,
} from '../bot-filter';
import type { BotCardData } from '../BotCard';

const mk = (id: number, state: BotCardData['state']): BotCardData => ({
  id,
  name: `Bot ${id}`,
  pair: 'BTC/USDC',
  timeframe: '1h',
  createdAt: '2026-01-01',
  stakeAmount: 100,
  maxOpenTrades: 5,
  balance: null,
  openTrades: 0,
  mode: 'PAUSED',
  state,
  errorMsg: null,
  lastBacktest: null,
});

const cards: BotCardData[] = [
  mk(1, 'LIVE'),
  mk(2, 'DRY-RUN'),
  mk(3, 'PAUSED'),
  mk(4, 'STARTING'),
  mk(5, 'BACKTESTING'),
  mk(6, 'ERROR'),
  mk(7, 'NEW'),
  mk(8, 'BACKTEST_FAILED'),
];

describe('bot-filter', () => {
  it('matchesCategory maps states to chips', () => {
    expect(matchesCategory('LIVE', 'live')).toBe(true);
    expect(matchesCategory('DRY-RUN', 'dry-run')).toBe(true);
    expect(matchesCategory('STARTING', 'working')).toBe(true);
    expect(matchesCategory('BACKTESTING', 'working')).toBe(true);
    expect(matchesCategory('ERROR', 'attention')).toBe(true);
    expect(matchesCategory('NEW', 'attention')).toBe(true);
    expect(matchesCategory('BACKTEST_FAILED', 'attention')).toBe(true);
    expect(matchesCategory('LIVE', 'all')).toBe(true);
    expect(matchesCategory('LIVE', 'attention')).toBe(false);
  });

  it('filterByCategory returns matching cards', () => {
    expect(filterByCategory(cards, 'all')).toHaveLength(8);
    expect(filterByCategory(cards, 'working').map((c) => c.id)).toEqual([4, 5]);
    expect(filterByCategory(cards, 'attention').map((c) => c.id)).toEqual([
      6, 7, 8,
    ]);
  });

  it('countByCategory tallies every chip', () => {
    const counts = countByCategory(cards);
    expect(counts).toEqual<Record<FilterCategory, number>>({
      all: 8,
      live: 1,
      'dry-run': 1,
      paused: 1,
      working: 2,
      attention: 3,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- bot-filter`
Expected: FAIL — `Cannot find module '../bot-filter'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/features/bot-monitoring/bot-filter.ts
import type { BotCardData } from './BotCard';
import type { PresentationalState } from './presentational-state';

export type FilterCategory =
  | 'all'
  | 'live'
  | 'dry-run'
  | 'paused'
  | 'working'
  | 'attention';

/** Non-"all" categories mapped to the presentational states they include. */
const CATEGORY_STATES: Record<
  Exclude<FilterCategory, 'all'>,
  PresentationalState[]
> = {
  live: ['LIVE'],
  'dry-run': ['DRY-RUN'],
  paused: ['PAUSED'],
  working: ['STARTING', 'STOPPING', 'BACKTESTING'],
  attention: ['ERROR', 'BACKTEST_FAILED', 'NEW'],
};

export function matchesCategory(
  state: PresentationalState,
  cat: FilterCategory,
): boolean {
  if (cat === 'all') return true;
  return CATEGORY_STATES[cat].includes(state);
}

export function filterByCategory(
  cards: BotCardData[],
  cat: FilterCategory,
): BotCardData[] {
  return cards.filter((c) => matchesCategory(c.state, cat));
}

export function countByCategory(
  cards: BotCardData[],
): Record<FilterCategory, number> {
  const counts: Record<FilterCategory, number> = {
    all: cards.length,
    live: 0,
    'dry-run': 0,
    paused: 0,
    working: 0,
    attention: 0,
  };
  const cats = Object.keys(CATEGORY_STATES) as Array<
    Exclude<FilterCategory, 'all'>
  >;
  for (const c of cards) {
    for (const cat of cats) {
      if (matchesCategory(c.state, cat)) counts[cat] += 1;
    }
  }
  return counts;
}

/** Display order + labels for the chip row. */
export const FILTER_CHIPS: Array<{ key: FilterCategory; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'dry-run', label: 'Dry-run' },
  { key: 'paused', label: 'Paused' },
  { key: 'working', label: 'Working' },
  { key: 'attention', label: 'Needs attention' },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- bot-filter`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/bot-filter.ts src/features/bot-monitoring/__tests__/bot-filter.test.ts
git commit -m "feat(dashboard): add status-filter category helpers"
```

---

### Task 3: `OpenTradesGauge.tsx` — segmented pip gauge

**Files:**

- Create: `src/features/bot-monitoring/OpenTradesGauge.tsx`
- Test: `src/features/bot-monitoring/__tests__/OpenTradesGauge.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/bot-monitoring/__tests__/OpenTradesGauge.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OpenTradesGauge } from '../OpenTradesGauge';

describe('OpenTradesGauge', () => {
  it('renders numeric open/max and one pip per slot when small', () => {
    const { container } = render(<OpenTradesGauge open={3} max={5} />);
    expect(screen.getByText('3/5')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-pip]')).toHaveLength(5);
    expect(container.querySelectorAll('[data-pip="on"]')).toHaveLength(3);
  });

  it('shows em-dash when max is unknown', () => {
    render(<OpenTradesGauge open={null} max={null} />);
    expect(screen.getByText('—/—')).toBeInTheDocument();
  });

  it('caps pips at 8 but keeps the true numeric', () => {
    const { container } = render(<OpenTradesGauge open={1} max={10} />);
    expect(screen.getByText('1/10')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-pip]')).toHaveLength(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- OpenTradesGauge`
Expected: FAIL — `Cannot find module '../OpenTradesGauge'`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/features/bot-monitoring/OpenTradesGauge.tsx
import { cn } from '@/lib/utils';

const MAX_PIPS = 8;

export function OpenTradesGauge({
  open,
  max,
}: {
  open: number | null;
  max: number | null;
}) {
  const total = max ?? 0;
  const filled = open ?? 0;
  const pipCount = Math.min(total, MAX_PIPS);
  const filledPips =
    total <= MAX_PIPS ? filled : Math.round((filled / total) * MAX_PIPS);

  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs uppercase tracking-wide text-fg-muted">
        Open
      </span>
      {pipCount > 0 && (
        <div className="flex gap-0.5" aria-hidden>
          {Array.from({ length: pipCount }).map((_, i) => (
            <span
              key={i}
              data-pip={i < filledPips ? 'on' : 'off'}
              className={cn(
                'h-1.5 w-2 rounded-sm',
                i < filledPips ? 'bg-brand' : 'bg-fg-muted/20',
              )}
            />
          ))}
        </div>
      )}
      <span className="font-mono text-2xs font-semibold tabular-nums text-fg">
        {max == null ? '—/—' : `${filled}/${total}`}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- OpenTradesGauge`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/OpenTradesGauge.tsx src/features/bot-monitoring/__tests__/OpenTradesGauge.test.tsx
git commit -m "feat(dashboard): add open-trades pip gauge"
```

---

### Task 4: Rebuild `BotCard.tsx` to direction-D anatomy

Preserve: the `BotCardData` interface, `mode`-driven Start/Stop/spinner logic, and the per-state display matrix (spec §6.3). Change: layout to D anatomy, DRY-RUN badge → blue/info (D-2), Open micro-stat → `OpenTradesGauge`, equal-height card.

**Files:**

- Modify: `src/features/bot-monitoring/BotCard.tsx` (full rewrite of the component body; interface unchanged)
- Test: `src/features/bot-monitoring/__tests__/BotCard.test.tsx` (extend)

- [ ] **Step 1: Add failing test cases for the new anatomy**

Append these inside the existing `describe('BotCard', …)` block in `__tests__/BotCard.test.tsx`:

```tsx
it('renders the open-trades gauge numeric for a running bot', () => {
  render(<BotCard bot={base} {...handlers} />);
  // base: openTrades 1, maxOpenTrades 10
  expect(screen.getByText('1/10')).toBeInTheDocument();
});

it('shows Stop for a LIVE bot even while BACKTESTING', () => {
  render(
    <BotCard
      bot={{ ...base, mode: 'LIVE', state: 'BACKTESTING' }}
      {...handlers}
    />,
  );
  expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /^start$/i }),
  ).not.toBeInTheDocument();
});

it('shows a disabled spinner button while STARTING', () => {
  render(
    <BotCard
      bot={{ ...base, mode: 'STARTING', state: 'STARTING' }}
      {...handlers}
    />,
  );
  expect(screen.getByRole('button', { name: /starting/i })).toBeDisabled();
});

it('hides balance + gauge for ERROR state', () => {
  render(
    <BotCard
      bot={{ ...base, state: 'ERROR', mode: 'ERROR', errorMsg: 'boom' }}
      {...handlers}
    />,
  );
  expect(screen.queryByText('967.94')).not.toBeInTheDocument();
  expect(screen.queryByText('1/10')).not.toBeInTheDocument();
  expect(screen.getByText(/boom/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify the new cases fail**

Run: `pnpm test -- BotCard`
Expected: FAIL — `1/10` not found (old code renders `1/10` only via the old micro-stat as `1/10`? it currently renders `${openTrades}/${maxOpenTrades}` = `1/10`, so this may already pass; the Stop-while-BACKTESTING and ERROR-hides-gauge cases drive the change). At least the ERROR-hides-`1/10` case must fail because the old card hides the whole micro-stats grid for ERROR — verify which fail, then proceed.

- [ ] **Step 3: Rewrite the component**

Replace the entire body of `src/features/bot-monitoring/BotCard.tsx` **below the `BotCardData`/`BotCardProps` interfaces** (keep those two interfaces exactly as they are today) with:

```tsx
import { FlaskConical, Play, StopCircle, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { OpenTradesGauge } from './OpenTradesGauge';
import type { DashboardBotMode } from './bot-list.helpers';
import type { PresentationalState } from './presentational-state';

// ── keep the existing BotCardData and BotCardProps interfaces above this line ──

const badgeClass: Record<PresentationalState, string> = {
  LIVE: 'border-bullish/30 bg-bullish-subtle text-bullish',
  'DRY-RUN': 'border-info/30 bg-info/10 text-info', // D-2: blue
  PAUSED: 'border-fg-muted/30 bg-fg-muted/10 text-fg-muted',
  ERROR: 'border-bearish/40 bg-bearish-subtle text-bearish',
  STARTING: 'border-brand/30 bg-brand/10 text-brand',
  STOPPING: 'border-fg-muted/20 bg-fg-muted/5 text-fg-muted',
  NEW: 'border-dashed border-brand/35 bg-brand/5 text-brand',
  BACKTESTING: 'border-info/30 bg-info/10 text-info',
  BACKTEST_FAILED: 'border-fg-muted/30 bg-fg-muted/10 text-fg-muted',
};

const badgeLabel: Record<PresentationalState, string> = {
  LIVE: 'Live',
  'DRY-RUN': 'Dry-run',
  PAUSED: 'Paused',
  ERROR: '! Error', // keep current label; no test asserts it
  STARTING: 'Starting…',
  STOPPING: 'Stopping…',
  NEW: 'New',
  BACKTESTING: 'Backtesting',
  BACKTEST_FAILED: 'Paused',
};

const PULSE = new Set<PresentationalState>([
  'STARTING',
  'STOPPING',
  'BACKTESTING',
]);

const fmt = (n: number | null, d = 2) => (n == null ? '—' : n.toFixed(d));

export function BotCard({
  bot,
  onClick,
  onStart,
  onStop,
  onRemove,
  onBacktest,
}: BotCardProps) {
  const s = bot.state;
  const showsBalance =
    s !== 'ERROR' && s !== 'STARTING' && s !== 'STOPPING' && s !== 'NEW';
  const showsGauge = s !== 'ERROR' && s !== 'STARTING' && s !== 'STOPPING';
  const showsMeta = s !== 'ERROR';
  const showsStrip =
    s !== 'NEW' &&
    s !== 'ERROR' &&
    s !== 'BACKTEST_FAILED' &&
    s !== 'BACKTESTING' &&
    bot.lastBacktest != null;

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
      className="card-coin98-flat flex h-full cursor-pointer flex-col rounded-2xl p-4 transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
    >
      {/* Header */}
      <div className="min-w-0">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-2xs font-bold uppercase',
            badgeClass[s],
          )}
        >
          {PULSE.has(s) && (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
          )}
          {badgeLabel[s]}
        </span>
        <h3 className="mt-2 truncate text-md font-semibold text-fg">
          {bot.name}
        </h3>
        <div className="truncate text-xs text-fg-muted">
          {bot.pair} · {bot.timeframe}
        </div>
      </div>

      {/* Balance */}
      {showsBalance && (
        <div className="mt-3 font-mono text-xl font-bold tabular-nums text-fg">
          {fmt(bot.balance)} <span className="text-xs text-fg-muted">USDC</span>
        </div>
      )}

      {/* Open-trades gauge */}
      {showsGauge && (
        <div className="mt-3">
          <OpenTradesGauge open={bot.openTrades} max={bot.maxOpenTrades} />
        </div>
      )}

      {/* Meta */}
      {showsMeta && (
        <div className="mt-2 flex gap-4 text-2xs text-fg-muted">
          <span>
            Stake{' '}
            <span className="font-mono font-semibold tabular-nums text-fg-secondary">
              {fmt(bot.stakeAmount, 0)}
            </span>
          </span>
          <span>
            TF{' '}
            <span className="font-mono font-semibold text-fg-secondary">
              {bot.timeframe}
            </span>
          </span>
        </div>
      )}

      {/* Status hints */}
      {s === 'BACKTESTING' && (
        <div className="mt-3 flex items-center gap-2 text-2xs text-info">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Backtesting…</span>
        </div>
      )}
      {s === 'NEW' && (
        <p className="mt-3 text-2xs text-fg-muted">
          No backtest yet · run one before going live ↓
        </p>
      )}
      {s === 'ERROR' && bot.errorMsg && (
        <p className="mt-3 line-clamp-2 text-xs text-bearish/90">
          <strong>error_message:</strong> {bot.errorMsg}
        </p>
      )}
      {s === 'BACKTEST_FAILED' && (
        <p className="mt-3 text-xs text-fg-muted">
          <strong>Backtest failed.</strong> Retry below.
        </p>
      )}

      {/* Backtest strip */}
      {showsStrip && bot.lastBacktest && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-border-subtle bg-black/20 px-2.5 py-2">
          <span className="text-2xs text-fg-muted">Last backtest</span>
          <div className="flex gap-3 text-right">
            <MiniStat
              k="Win"
              v={
                bot.lastBacktest.winRate == null
                  ? '—'
                  : `${bot.lastBacktest.winRate.toFixed(1)}%`
              }
            />
            <MiniStat k="Trades" v={String(bot.lastBacktest.trades ?? '—')} />
            <MiniStat
              k="Net"
              v={
                bot.lastBacktest.netAbs == null
                  ? '—'
                  : `${bot.lastBacktest.netAbs >= 0 ? '+' : ''}${bot.lastBacktest.netAbs.toFixed(2)}`
              }
              cls={
                (bot.lastBacktest.netAbs ?? 0) >= 0
                  ? 'text-bullish'
                  : 'text-bearish'
              }
            />
          </div>
        </div>
      )}

      {/* Actions pinned to the bottom for equal-height cards */}
      <div className="mt-auto pt-3">
        <Actions
          bot={bot}
          onStart={onStart}
          onStop={onStop}
          onRemove={onRemove}
          onBacktest={onBacktest}
        />
      </div>
    </article>
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
  onRemove,
  onBacktest,
}: Omit<BotCardProps, 'onClick'>) {
  const s = bot.state;
  // Start/Stop + transition spinner follow the underlying lifecycle MODE,
  // never the presentational overlay (a LIVE bot running a backtest must still
  // show Stop, not Start).
  const m = bot.mode;
  if (m === 'STARTING' || m === 'STOPPING') {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <Button variant="secondary" size="sm" className="w-full" disabled>
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          {m === 'STARTING' ? 'Starting…' : 'Stopping…'}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
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
        {m === 'LIVE' || m === 'DRY-RUN' ? (
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

> Note: the `Stat` helper from the old file is removed (replaced by `OpenTradesGauge` + the inline meta row). The ERROR badge keeps its current `! Error` label (no existing test asserts the badge text; the `!` + red carry the urgency).
> **If Tri keeps DRY-RUN yellow (D-2):** revert the `'DRY-RUN'` line in `badgeClass` to `'border-brand/30 bg-brand-subtle text-brand'`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- BotCard`
Expected: PASS (existing + 4 new). If the old `! Error` assertion exists, change it to `Error` first.

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/BotCard.tsx src/features/bot-monitoring/__tests__/BotCard.test.tsx
git commit -m "feat(dashboard): rebuild BotCard to card-grid anatomy"
```

---

### Task 5: `PortfolioBar.tsx` — horizontal KPI bar

**Files:**

- Create: `src/features/bot-monitoring/PortfolioBar.tsx`
- Test: `src/features/bot-monitoring/__tests__/PortfolioBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/bot-monitoring/__tests__/PortfolioBar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PortfolioBar } from '../PortfolioBar';
import type { PortfolioStats } from '../portfolio-stats';

const stats: PortfolioStats = {
  capitalDeployed: 12480.5,
  openTrades: 6,
  total: 9,
  active: 4,
  transitioning: 1,
  idle: 1,
  error: 1,
};

describe('PortfolioBar', () => {
  it('renders capital deployed and KPI counts', () => {
    render(<PortfolioBar stats={stats} loading={false} onRefresh={() => {}} />);
    expect(screen.getByText('12,480.50')).toBeInTheDocument();
    expect(screen.getByText(/4\s*\/\s*9/)).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('calls onRefresh when the refresh button is clicked', () => {
    const onRefresh = vi.fn();
    render(
      <PortfolioBar stats={stats} loading={false} onRefresh={onRefresh} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('disables refresh while loading', () => {
    render(<PortfolioBar stats={stats} loading onRefresh={() => {}} />);
    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- PortfolioBar`
Expected: FAIL — `Cannot find module '../PortfolioBar'`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/features/bot-monitoring/PortfolioBar.tsx
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PortfolioStats } from './portfolio-stats';

interface PortfolioBarProps {
  stats: PortfolioStats;
  loading: boolean;
  onRefresh: () => void;
}

function Kpi({
  label,
  children,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  tone?: 'brand' | 'bearish';
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs uppercase tracking-widest text-fg-muted">
        {label}
      </span>
      <span
        className={cn(
          'font-mono text-lg font-semibold tabular-nums text-fg',
          tone === 'brand' && 'text-brand',
          tone === 'bearish' && 'text-bearish',
        )}
      >
        {children}
      </span>
    </div>
  );
}

export function PortfolioBar({ stats, loading, onRefresh }: PortfolioBarProps) {
  const capital = stats.capitalDeployed.toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

  return (
    <section
      aria-label="Portfolio summary"
      className="card-coin98-flat relative flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl px-6 py-5"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-2xs uppercase tracking-widest text-fg-muted">
          Capital deployed
        </span>
        <span
          className="font-mono text-3xl font-bold tabular-nums text-fg"
          style={{ textShadow: '0 0 28px rgba(240,185,11,0.18)' }}
        >
          {loading ? '—' : capital}{' '}
          <span className="text-base text-fg-muted">USDC</span>
        </span>
      </div>

      <div className="h-8 w-px bg-border-subtle" aria-hidden />

      <Kpi label="Active / Total">
        {stats.active}
        <span className="text-fg-muted"> / {stats.total}</span>
      </Kpi>
      <Kpi label="Open trades">{stats.openTrades}</Kpi>
      <Kpi label="Idle">{stats.idle}</Kpi>
      <Kpi
        label="Transitioning"
        tone={stats.transitioning > 0 ? 'brand' : undefined}
      >
        {stats.transitioning}
      </Kpi>
      <Kpi label="Errors" tone={stats.error > 0 ? 'bearish' : undefined}>
        {stats.error}
      </Kpi>

      <Button
        variant="ghost"
        size="md"
        className="ml-auto"
        onClick={onRefresh}
        disabled={loading}
        aria-label="Refresh bots"
        title="Refresh"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
      </Button>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- PortfolioBar`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/PortfolioBar.tsx src/features/bot-monitoring/__tests__/PortfolioBar.test.tsx
git commit -m "feat(dashboard): add portfolio KPI bar"
```

---

### Task 6: `StatusFilterChips.tsx` — filter chips

**Files:**

- Create: `src/features/bot-monitoring/StatusFilterChips.tsx`
- Test: `src/features/bot-monitoring/__tests__/StatusFilterChips.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/bot-monitoring/__tests__/StatusFilterChips.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusFilterChips } from '../StatusFilterChips';
import type { FilterCategory } from '../bot-filter';

const counts: Record<FilterCategory, number> = {
  all: 9,
  live: 3,
  'dry-run': 1,
  paused: 1,
  working: 2,
  attention: 2,
};

describe('StatusFilterChips', () => {
  it('renders every chip with its count', () => {
    render(
      <StatusFilterChips counts={counts} active="all" onChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /All\s*9/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Live\s*3/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Needs attention\s*2/ }),
    ).toBeInTheDocument();
  });

  it('fires onChange with the clicked category', () => {
    const onChange = vi.fn();
    render(
      <StatusFilterChips counts={counts} active="all" onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Working\s*2/ }));
    expect(onChange).toHaveBeenCalledWith('working');
  });

  it('disables a chip with zero count (except All)', () => {
    render(
      <StatusFilterChips
        counts={{ ...counts, attention: 0 }}
        active="all"
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: /Needs attention\s*0/ }),
    ).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- StatusFilterChips`
Expected: FAIL — `Cannot find module '../StatusFilterChips'`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/features/bot-monitoring/StatusFilterChips.tsx
import { cn } from '@/lib/utils';
import { FILTER_CHIPS, type FilterCategory } from './bot-filter';

interface StatusFilterChipsProps {
  counts: Record<FilterCategory, number>;
  active: FilterCategory;
  onChange: (cat: FilterCategory) => void;
}

export function StatusFilterChips({
  counts,
  active,
  onChange,
}: StatusFilterChipsProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Filter bots by status"
    >
      {FILTER_CHIPS.map((chip) => {
        const count = counts[chip.key];
        const isActive = active === chip.key;
        const disabled = chip.key !== 'all' && count === 0;
        return (
          <button
            key={chip.key}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => onChange(chip.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition',
              isActive
                ? 'border-brand bg-brand text-[#1a1300]'
                : 'border-border-subtle bg-surface-elevated text-fg-secondary hover:text-fg',
              disabled &&
                'cursor-not-allowed opacity-40 hover:text-fg-secondary',
            )}
          >
            {chip.label}
            <span
              className={cn(
                'font-mono tabular-nums',
                isActive ? 'text-[#1a1300]/70' : 'text-fg-muted',
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- StatusFilterChips`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/StatusFilterChips.tsx src/features/bot-monitoring/__tests__/StatusFilterChips.test.tsx
git commit -m "feat(dashboard): add status filter chips"
```

---

### Task 7: Wire it into `DashboardPage.tsx`

Replace the hero `<section>` with `<PortfolioBar>`, add filter state + `<StatusFilterChips>`, apply `sortCards` then category + search filters, widen the container, and gate the bar/toolbar off when the user has no bots.

**Files:**

- Modify: `src/pages/DashboardPage.tsx`
- Test: `src/pages/__tests__/DashboardPage.test.tsx` (keep green; add one filter test)

- [ ] **Step 1: Update imports**

In `src/pages/DashboardPage.tsx`, replace the `RefreshCw, Search` icon import with just `Search` (refresh now lives in `PortfolioBar`):

```tsx
import { ArrowRight, Search } from 'lucide-react';
```

Add these imports near the other `bot-monitoring` imports:

```tsx
import { PortfolioBar } from '@/features/bot-monitoring/PortfolioBar';
import { StatusFilterChips } from '@/features/bot-monitoring/StatusFilterChips';
import { sortCards } from '@/features/bot-monitoring/bot-sort';
import {
  filterByCategory,
  countByCategory,
  type FilterCategory,
} from '@/features/bot-monitoring/bot-filter';
```

- [ ] **Step 2: Add filter state**

Next to `const [search, setSearch] = useState('');` add:

```tsx
const [filter, setFilter] = useState<FilterCategory>('all');
```

- [ ] **Step 3: Replace the `filtered`/`capital` block with sort + filter pipeline**

Replace the current block:

```tsx
const filtered = search
  ? cards.filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.pair.toLowerCase().includes(search.toLowerCase()),
    )
  : cards;

const capital = stats.capitalDeployed.toLocaleString('en-US', {
  maximumFractionDigits: 2,
});
```

with (sort → category filter → search filter; counts from the unfiltered cards):

```tsx
const counts = useMemo(() => countByCategory(cards), [cards]);

const filtered = useMemo(() => {
  const sorted = sortCards(cards);
  const byCat = filterByCategory(sorted, filter);
  if (!search) return byCat;
  const q = search.toLowerCase();
  return byCat.filter(
    (c) => c.name.toLowerCase().includes(q) || c.pair.toLowerCase().includes(q),
  );
}, [cards, filter, search]);
```

(The `capital` const is removed — `PortfolioBar` formats its own number.)

- [ ] **Step 4: Replace the `<main>` body**

Replace the entire `<main …> … </main>` block (currently lines ~368–588) with:

```tsx
<main className="relative z-10 flex-1 overflow-y-auto">
  <div className="mx-auto flex max-w-7xl flex-col gap-5 px-8 py-7">
    {isEmptyReal ? (
      <DashboardEmptyState
        onCreate={() => requireWalletThen(() => navigate('/builder'))}
        onImport={() => requireWalletThen(() => setImportOpen(true))}
      />
    ) : (
      <>
        <PortfolioBar
          stats={stats}
          loading={loading}
          onRefresh={handleRefresh}
        />

        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xs font-semibold uppercase tracking-widest text-fg-muted">
                My bots · {stats.total}
              </h2>
              {isLoadedReal && (
                <StatusFilterChips
                  counts={counts}
                  active={filter}
                  onChange={setFilter}
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              {isLoadedReal && (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search bots…"
                    className="h-9 w-44 rounded-md border border-border bg-input pl-8 pr-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
                  />
                </div>
              )}
              <Button
                variant="secondary"
                size="md"
                className="min-w-[120px]"
                onClick={() => requireWalletThen(() => setImportOpen(true))}
              >
                Import
              </Button>
              <Button
                variant="primary"
                size="md"
                className="group min-w-[120px]"
                onClick={() => requireWalletThen(() => navigate('/builder'))}
              >
                New bot
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="card-coin98-flat min-h-[230px] animate-pulse rounded-2xl p-4"
                >
                  <div className="h-4 w-16 rounded bg-fg-muted/15" />
                  <div className="mt-3 h-6 w-3/4 rounded bg-fg-muted/15" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-fg-muted/15" />
                  <div className="mt-6 h-8 w-2/3 rounded bg-fg-muted/15" />
                </div>
              ))}
            </div>
          ) : fetchError ? (
            <div className="card-coin98-flat rounded-2xl p-10 text-center">
              <p className="text-sm font-semibold text-bearish">
                Couldn&apos;t load your bots
              </p>
              <p className="mt-1 text-xs text-fg-muted">{fetchError}</p>
              <Button
                variant="secondary"
                className="mt-4"
                onClick={handleRefresh}
              >
                Retry
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
                {filtered.map((card) => (
                  <BotCard
                    key={card.id}
                    bot={card}
                    onClick={() =>
                      navigate(`/bots/${card.id}`, {
                        state: { createdAt: card.createdAt, name: card.name },
                      })
                    }
                    onStart={() => {
                      const rb = realById.get(card.id);
                      if (rb) setLaunchBotTarget(toLaunchpadBot(rb));
                    }}
                    onStop={() =>
                      setConfirmState({
                        action: 'stop',
                        botId: card.id,
                        botName: card.name,
                      })
                    }
                    onRemove={() =>
                      setConfirmState({
                        action: 'remove',
                        botId: card.id,
                        botName: card.name,
                      })
                    }
                    onBacktest={() => {
                      const rb = realById.get(card.id);
                      if (rb)
                        setBacktestBot({
                          id: rb.id,
                          name: rb.name,
                          strategyName: rb.strategyName,
                          pair: rb.pair,
                          timeframe: rb.timeframe,
                        });
                    }}
                  />
                ))}
              </div>

              {filtered.length === 0 && (
                <div className="card-coin98-flat rounded-2xl p-10 text-center">
                  <p className="text-sm font-semibold text-fg">
                    No bots match your filter
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setFilter('all');
                    }}
                    className="mt-2 text-xs text-brand hover:underline"
                  >
                    Clear filter
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </>
    )}
  </div>
</main>
```

- [ ] **Step 5: Run typecheck + existing page tests**

Run: `pnpm typecheck && pnpm test -- DashboardPage`
Expected: typecheck clean; existing DashboardPage tests PASS. If a test queried the old hero copy "Capital deployed · live balance", update it to assert `Capital deployed` (now in `PortfolioBar`).

- [ ] **Step 6: Add a filter-interaction test**

This file uses `fireEvent` + `waitFor` + a `renderPage()` helper and mocks `botApi` in `beforeEach` (see the existing "shows capital deployed…" test at ~line 125 for the exact mocking shape). Mirror that style — do NOT introduce `userEvent`. Append inside the existing `describe`:

```tsx
it('filters the grid when a status chip is clicked', async () => {
  // One LIVE bot + one ERROR bot.
  vi.mocked(botApi.list).mockResolvedValueOnce([
    {
      id: 1,
      bot_name: 'Live bot',
      status: 'running',
      desired_status: null,
      error_message: null,
      strategy_name: 'S1',
    },
    {
      id: 2,
      bot_name: 'Broken bot',
      status: 'error',
      desired_status: null,
      error_message: 'boom',
      strategy_name: 'S2',
    },
  ]);
  vi.mocked(botApi.getConfig).mockResolvedValue({
    config: {
      dry_run: false,
      timeframe: '1h',
      exchange: { pair_whitelist: ['BTC/USDC:USDC'] },
      stake_amount: 100,
      max_open_trades: 5,
    },
  });
  vi.mocked(botApi.getPerformance).mockResolvedValue({
    balance: 100,
    openTrades: 1,
  });

  renderPage();
  await waitFor(() => expect(screen.getByText('Live bot')).toBeInTheDocument());
  expect(screen.getByText('Broken bot')).toBeInTheDocument();

  // "Needs attention" = ERROR/BACKTEST_FAILED/NEW → only the ERROR bot remains.
  fireEvent.click(screen.getByRole('button', { name: /Needs attention/ }));

  expect(screen.queryByText('Live bot')).not.toBeInTheDocument();
  expect(screen.getByText('Broken bot')).toBeInTheDocument();
});
```

Notes: `getConfig` uses `mockResolvedValue` (both bots share it); the running bot resolves to `LIVE` (dry_run false), the `status: 'error'` bot resolves to `ERROR` via `deriveMode` regardless of backtest history. If the suite's `beforeEach` doesn't already default-mock `botApi.getBacktestHistory`, add `vi.mocked(botApi.getBacktestHistory).mockResolvedValue({ items: [], total: 0 });` — `Promise.allSettled` tolerates it either way.

- [ ] **Step 7: Run the page tests**

Run: `pnpm test -- DashboardPage`
Expected: PASS (existing + new filter test).

- [ ] **Step 8: Commit**

```bash
git add src/pages/DashboardPage.tsx src/pages/__tests__/DashboardPage.test.tsx
git commit -m "feat(dashboard): wire card-grid layout — KPI bar, filter chips, sort"
```

---

### Task 8: Full verification

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: no errors. (Fix any `react-hooks/exhaustive-deps` warnings on the new `useMemo`s.)

- [ ] **Step 3: Full test run**

Run: `pnpm test`
Expected: all green, including `bot-sort`, `bot-filter`, `OpenTradesGauge`, `PortfolioBar`, `StatusFilterChips`, `BotCard`, `DashboardPage`, and the untouched `portfolio-stats` / `presentational-state` suites.

- [ ] **Step 4: Format**

Run: `pnpm format`
Expected: files formatted; re-stage if anything changed.

- [ ] **Step 5: Manual smoke (Tri)**

Run `pnpm dev`, open `/dashboard`. Verify against `public/dashboard-v2-cards.html`: KPI bar, chips filter + counts, card grid equal-height, every state renders per spec §6.3, sort order is triage-first, Start/Stop correct (incl. a LIVE bot mid-backtest still shows Stop), empty/loading/error states. Tri drives the browser.

- [ ] **Step 6: Final commit (if format changed anything)**

```bash
git add -A
git commit -m "chore(dashboard): format card-grid redesign"
```

---

## Self-review notes

- **Spec coverage:** layout §3 → Tasks 5/7; card anatomy §4 → Tasks 3/4; responsive §5 → grid arbitrary class + KPI flex-wrap (Task 7); page precedence §6.1 → Task 7 render tree; sort §6.2 → Task 1; state matrix §6.3 → Task 4; chips §6.4 → Tasks 2/6; badges §6.5 → Task 4; provenance §7 → no fake widgets added (sparkline omitted). ✓
- **Deferred (spec §2/§7):** sparkline, equity curve, 24h%, total P&L, allocation donut — intentionally NOT implemented (no BE data). ✓
- **Type consistency:** `BotCardData`, `PresentationalState`, `PortfolioStats`, `FilterCategory`, `sortCards`, `filterByCategory`, `countByCategory`, `FILTER_CHIPS` used identically across tasks. ✓
- **Open decisions:** D-1/D-2/D-3 each have a one-line flip note at their task. Confirm with Tri before executing if he wants non-default choices.
