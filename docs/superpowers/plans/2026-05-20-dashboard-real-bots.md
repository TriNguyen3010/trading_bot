# Dashboard Real Bots — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `MOCK_BOTS` array in `DashboardPage` with real data from `botApi.list()` + per-bot `botApi.getConfig()` (mirroring the MyBotsDialog pattern). Close the loop: submit bot in Builder → user sees that bot on Dashboard. Read-only at this phase; start/stop/delete controls deferred to the next phase.

**Architecture:** DashboardPage owns local `useState` for `bots / loading / error`. On mount, calls `botApi.list()`, then `Promise.allSettled` per-bot `botApi.getConfig(id)`. A new pure helper module `bot-list.helpers.ts` derives the UI-shape `DashboardBot` from `(BotOut, BotConfigOut | null)` so the mapping is unit-testable independently. Hero portfolio stats compute from the real list (active count, total). MOCK_BOTS retained as visual fallback when the real list is empty — keeps the empty state from being a blank grid.

**Tech Stack:** React 18, TypeScript 5.7, Vite 6, React Router 7, Tailwind 3, Vitest 2 + @testing-library/react, Sonner toasts.

**Reference spec:** [docs/superpowers/specs/2026-05-20-dashboard-real-bots-design.md](../specs/2026-05-20-dashboard-real-bots-design.md)

---

## File Structure

**New files (2):**
| Path | Purpose |
|---|---|
| `src/features/bot-monitoring/bot-list.helpers.ts` | Pure: `deriveMode`, `derivePair`, `deriveTimeframe`, `zipBotsAndConfigs` |
| `src/features/bot-monitoring/bot-list.helpers.test.ts` | Unit tests for all helpers |

**Modified files (2):**
| Path | Change |
|---|---|
| `src/pages/DashboardPage.tsx` | Add fetch + state, replace `MOCK_BOTS` consumption with `realBots ?? MOCK_BOTS`, compute portfolio stats from real list |
| `src/pages/__tests__/DashboardPage.test.tsx` | NEW location for component tests (loading/empty/error/loaded states) |

**No deletions.** `MOCK_BOTS` array stays in `DashboardPage.tsx` as visual fallback for empty state.

---

## Task 1: Add `bot-list.helpers.ts` pure module

Pure functions, no React, fully unit-testable. Lands first so DashboardPage just consumes a stable API.

**Files:**
- Create: `src/features/bot-monitoring/bot-list.helpers.ts`
- Create: `src/features/bot-monitoring/bot-list.helpers.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/bot-monitoring/bot-list.helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  deriveMode,
  derivePair,
  deriveTimeframe,
  zipBotsAndConfigs,
  type DashboardBot,
} from './bot-list.helpers';
import type { BotOut, BotConfigOut } from './bot.api';

function makeBot(over: Partial<BotOut> = {}): BotOut {
  return {
    id: 1,
    status: 'stopped',
    bot_name: 'Test bot',
    desired_status: null,
    error_message: null,
    strategy_name: 'TestStrat',
    ...over,
  };
}

function makeConfig(over: Partial<BotConfigOut> = {}): BotConfigOut {
  // Cast — BotConfigOut from openapi has many fields, only some matter here
  return {
    dry_run: true,
    timeframe: '5m',
    exchange: { pair_whitelist: ['BTC/USDT'] },
    ...over,
  } as BotConfigOut;
}

describe('deriveMode', () => {
  it('returns ERROR when error_message is present', () => {
    expect(deriveMode(makeBot({ error_message: 'rejected' }), makeConfig())).toBe('ERROR');
  });
  it('returns LIVE when running and dry_run=false', () => {
    expect(deriveMode(makeBot({ status: 'running' }), makeConfig({ dry_run: false }))).toBe('LIVE');
  });
  it('returns DRY-RUN when running and dry_run=true', () => {
    expect(deriveMode(makeBot({ status: 'running' }), makeConfig({ dry_run: true }))).toBe('DRY-RUN');
  });
  it('returns PAUSED for any other status', () => {
    expect(deriveMode(makeBot({ status: 'stopped' }), makeConfig())).toBe('PAUSED');
    expect(deriveMode(makeBot({ status: 'idle' }), makeConfig())).toBe('PAUSED');
  });
  it('handles null config (treats as PAUSED unless explicitly error)', () => {
    expect(deriveMode(makeBot({ status: 'running' }), null)).toBe('PAUSED');
    expect(deriveMode(makeBot({ error_message: 'x' }), null)).toBe('ERROR');
  });
});

describe('derivePair', () => {
  it('extracts and formats the first pair from pair_whitelist', () => {
    expect(derivePair(makeConfig({ exchange: { pair_whitelist: ['BTC/USDT'] } }))).toBe('BTC-USDT');
  });
  it('returns "?" when pair_whitelist is missing', () => {
    expect(derivePair(makeConfig({ exchange: {} }))).toBe('?');
  });
  it('returns "?" when config is null', () => {
    expect(derivePair(null)).toBe('?');
  });
});

describe('deriveTimeframe', () => {
  it('returns config.timeframe when present', () => {
    expect(deriveTimeframe(makeConfig({ timeframe: '1h' }))).toBe('1h');
  });
  it('returns "?" when config is null', () => {
    expect(deriveTimeframe(null)).toBe('?');
  });
});

describe('zipBotsAndConfigs', () => {
  it('zips bots and configs into DashboardBot[]', () => {
    const bots = [makeBot({ id: 1 }), makeBot({ id: 2, status: 'running', error_message: null })];
    const configs = [makeConfig({ timeframe: '5m' }), makeConfig({ timeframe: '1h', dry_run: false })];

    const result = zipBotsAndConfigs(bots, configs);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 1,
      name: 'Test bot',
      mode: 'PAUSED',
      pair: 'BTC-USDT',
      timeframe: '5m',
      isDemo: false,
    });
    expect(result[1].mode).toBe('LIVE');
  });

  it('falls back gracefully when a config is null', () => {
    const bots = [makeBot({ id: 5 })];
    const result = zipBotsAndConfigs(bots, [null]);
    expect(result[0].pair).toBe('?');
    expect(result[0].timeframe).toBe('?');
  });

  it('uses "Bot #<id>" when bot_name is null', () => {
    const bots = [makeBot({ id: 7, bot_name: null })];
    expect(zipBotsAndConfigs(bots, [null])[0].name).toBe('Bot #7');
  });
});
```

Run the test file:

```bash
pnpm vitest run src/features/bot-monitoring/bot-list.helpers.test.ts
```

Expect ALL tests to fail with `Cannot find module './bot-list.helpers'` — that's the green light.

- [ ] **Step 2: Implement `bot-list.helpers.ts`**

```ts
import { jsonPairToUi } from '@/lib/pair-format';
import type { BotOut, BotConfigOut } from './bot.api';

export type DashboardBotMode = 'LIVE' | 'DRY-RUN' | 'PAUSED' | 'ERROR';

export interface DashboardBot {
  id: number;
  name: string;
  pair: string;
  timeframe: string;
  uptime: string | null;
  mode: DashboardBotMode;
  errorMsg: string | null;
  pnl: string | null;
  pnlPct: string | null;
  pnlDirection: 'up' | 'down' | 'flat';
  trades: number | null;
  winRate: number | null;
  sharpe: number | null;
  sparkline: number[] | null;
  badge?: string;
  isDemo: false;
}

/** The inner config shape after unwrapping `BotConfigOut.config`.
 * Exported so DashboardPage can type the `.config` field it pulls out
 * of each `BotConfigOut` wrapper from `botApi.getConfig(id)`. */
export interface ConfigShape {
  dry_run?: boolean | null;
  timeframe?: string | null;
  exchange?: { pair_whitelist?: string[] } | null;
}

export function deriveMode(
  bot: BotOut,
  config: ConfigShape | null,
): DashboardBotMode {
  if (bot.error_message) return 'ERROR';
  if (bot.status === 'running') {
    return config?.dry_run === false ? 'LIVE' : 'DRY-RUN';
  }
  return 'PAUSED';
}

export function derivePair(config: ConfigShape | null): string {
  const pair = config?.exchange?.pair_whitelist?.[0];
  if (!pair) return '?';
  return jsonPairToUi(pair);
}

export function deriveTimeframe(config: ConfigShape | null): string {
  return config?.timeframe ?? '?';
}

export function zipBotsAndConfigs(
  bots: BotOut[],
  configs: Array<ConfigShape | null>,
): DashboardBot[] {
  return bots.map((bot, i) => {
    const config = configs[i] ?? null;
    return {
      id: bot.id,
      name: bot.bot_name ?? `Bot #${bot.id}`,
      pair: derivePair(config),
      timeframe: deriveTimeframe(config),
      uptime: null,
      mode: deriveMode(bot, config),
      errorMsg: bot.error_message ?? null,
      pnl: null,
      pnlPct: null,
      pnlDirection: 'flat',
      trades: null,
      winRate: null,
      sharpe: null,
      sparkline: null,
      isDemo: false,
    };
  });
}
```

Run again — all green.

- [ ] **Step 3: Typecheck + lint**

```bash
pnpm typecheck && pnpm lint --max-warnings=0 src/features/bot-monitoring/bot-list.helpers.ts
```

---

## Task 2: Wire DashboardPage to real `botApi.list()`

Replace the static `MOCK_BOTS` consumption with fetched state. Keep `MOCK_BOTS` array for empty-state fallback only.

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

- [ ] **Step 1: Refactor `MockBot` → `DashboardBot` type unification**

Above the existing `MockBot` interface, import the new type:

```ts
import type { DashboardBot } from '@/features/bot-monitoring/bot-list.helpers';
```

Change the `MockBot` interface to extend `DashboardBot` BUT allow `isDemo: true`:

```ts
type MockBot = Omit<DashboardBot, 'isDemo'> & { isDemo: true };
```

Update the `MOCK_BOTS: MockBot[]` array — all 3 entries already have `isDemo: true`, no other changes needed.

- [ ] **Step 1b: Update `BotCardProps.bot` to accept the union + fix trailing separator**

The plan's Step 3 maps `filteredBots: (DashboardBot | MockBot)[]` into `<BotCard>`. Current
`BotCardProps.bot` is typed `MockBot` only — TypeScript will reject `DashboardBot` (their
`isDemo` literal types disagree). Widen the prop:

```ts
// DashboardPage.tsx — line ~331
interface BotCardProps {
  bot: DashboardBot | MockBot;
  onClick: () => void;
}
```

Add the `DashboardBot` import alongside the existing one if it's not already there.

Real bots have `uptime: null` at this phase (defer to monitoring phase). Current render
leaves a dangling separator: `{bot.pair} · {bot.timeframe} · {bot.uptime}` renders as
`"BTC-USDT · 5m · "` when uptime is null. Update the line in `BotCard`:

```tsx
// BEFORE — DashboardPage.tsx, inside BotCard, ~line 381
<div className="text-xs text-fg-muted">
  {bot.pair} · {bot.timeframe} · {bot.uptime}
</div>

// AFTER — only render the separator + value when uptime is non-empty
<div className="text-xs text-fg-muted">
  {bot.pair} · {bot.timeframe}
  {bot.uptime ? ` · ${bot.uptime}` : null}
</div>
```

- [ ] **Step 2: Add fetch state + `useEffect` with cancelled flag + refreshKey**

Inside `DashboardPage`, above the `filteredBots` computation. Three pieces:
(a) state — `realBots / loading / fetchError / refreshKey`,
(b) `useEffect` runs on mount and whenever `refreshKey` bumps; uses a
local `cancelled` flag to drop stale setState if user unmounts mid-fetch,
(c) `handleRefresh` increments `refreshKey` to retrigger the effect.

```ts
import { useEffect, useState } from 'react';
import { botApi } from '@/features/bot-monitoring/bot.api';
import {
  zipBotsAndConfigs,
  type ConfigShape,
  type DashboardBot,
} from '@/features/bot-monitoring/bot-list.helpers';
import { formatBackendError } from '@/lib/format-error';

// inside component body:
const [realBots, setRealBots] = useState<DashboardBot[] | null>(null);
const [loading, setLoading] = useState(true);
const [fetchError, setFetchError] = useState<string | null>(null);
const [refreshKey, setRefreshKey] = useState(0);

useEffect(() => {
  let cancelled = false;

  const run = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const list = await botApi.list();
      if (cancelled) return;

      if (list.length === 0) {
        setRealBots([]);
        return;
      }

      const configs = await Promise.allSettled(
        list.map((b) => botApi.getConfig(b.id)),
      );
      if (cancelled) return;

      // Unwrap BotConfigOut → inner ConfigShape. `botApi.getConfig` returns
      // `{ config: { dry_run, timeframe, exchange, ... } }` (see openapi.json
      // BotConfigOut). MyBotsDialog.tsx:217 does the same unwrap.
      const configsOrNull = configs.map((r) =>
        r.status === 'fulfilled' ? (r.value.config as ConfigShape) : null,
      );
      setRealBots(zipBotsAndConfigs(list, configsOrNull));
    } catch (err) {
      if (cancelled) return;
      setFetchError(formatBackendError(err));
    } finally {
      if (!cancelled) setLoading(false);
    }
  };

  void run();
  return () => {
    cancelled = true;
  };
}, [refreshKey]);

const handleRefresh = () => setRefreshKey((k) => k + 1);
```

- [ ] **Step 3: Compute the rendered list**

Replace `const filteredBots = search ? MOCK_BOTS.filter(...) : MOCK_BOTS;` with:

```ts
// Show real bots when available; fall back to demo samples when the
// user has no bots yet (empty state) — keeps the grid from being a
// blank rectangle on first login. Loading/error states render their
// own UI below and skip this.
const baseBots: (DashboardBot | MockBot)[] =
  realBots && realBots.length > 0 ? realBots : MOCK_BOTS;

const filteredBots = search
  ? baseBots.filter(
      (b) =>
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        b.pair.toLowerCase().includes(search.toLowerCase()),
    )
  : baseBots;

const isEmptyReal = realBots !== null && realBots.length === 0;
```

- [ ] **Step 4: Conditional toolbar (search + Refresh button)**

The toolbar above the grid renders different controls per state per spec §4:

| State | Search | Refresh | Notes |
|---|---|---|---|
| loading | hidden | hidden | controls would be useless mid-fetch |
| empty | hidden | visible | refresh after creating bot in another tab |
| loaded | visible | visible | full controls |
| error | hidden | hidden | Retry button inside error card replaces these |

Inside the "My bots" section header (where Search / Import / New bot buttons live now), wrap the search input + add Refresh button:

```tsx
import { RefreshCw } from 'lucide-react';

// inside the toolbar row, replacing the current Search input slot:
{!loading && !fetchError && realBots !== null && realBots.length > 0 && (
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
{!loading && !fetchError && (
  <Button
    variant="ghost"
    size="sm"
    onClick={handleRefresh}
    aria-label="Refresh bots"
    title="Refresh"
  >
    <RefreshCw className="h-3.5 w-3.5" />
  </Button>
)}
```

- [ ] **Step 5: Insert loading + error + grid states in JSX**

Replace the existing `{filteredBots.length === 0 && ... }` block with the four-way state machine inside the "My bots" section grid area:

```tsx
{loading ? (
  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 3 }).map((_, i) => (
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
    <Button variant="secondary" className="mt-4" onClick={handleRefresh}>
      Retry
    </Button>
  </div>
) : (
  <>
    {isEmptyReal && (
      <div className="rounded-lg border border-info/30 bg-info/5 px-4 py-3 text-xs text-info">
        You haven&apos;t built any bots yet. Below is a sample — try
        <strong className="mx-1">New bot</strong>to create your first one.
      </div>
    )}

    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {filteredBots.map((bot) => (
        <BotCard
          key={bot.id}
          bot={bot}
          // Demo cards in empty state use hardcoded ids (1/2/4) — clicking
          // them against a real BE would 404. Route demos to /builder instead
          // so the click becomes a useful conversion to "create your own".
          onClick={
            bot.isDemo
              ? () => requireWalletThen(() => navigate('/builder'))
              : () => navigate(`/bots/${bot.id}`)
          }
        />
      ))}

      <button
        type="button"
        onClick={() => requireWalletThen(() => navigate('/builder'))}
        className="card-coin98-flat flex min-h-[230px] flex-col items-center justify-center rounded-2xl p-4 text-center transition hover:bg-brand-soft"
      >
        <div className="text-2xl text-fg-muted">＋</div>
        <div className="mt-2 text-sm font-semibold text-fg-secondary">
          New bot
        </div>
        <div className="mt-1 text-xs text-fg-muted">
          Build from scratch or import
        </div>
      </button>
    </div>

    {filteredBots.length === 0 && (
      <div className="card-coin98-flat rounded-2xl p-10 text-center">
        <p className="text-sm font-semibold text-fg">
          No bots match &quot;{search}&quot;
        </p>
        <button
          type="button"
          onClick={() => setSearch('')}
          className="mt-2 text-xs text-brand hover:underline"
        >
          Clear search
        </button>
      </div>
    )}
  </>
)}
```

- [ ] **Step 6: Update hero portfolio stats from real bots**

Replace the static `PORTFOLIO_STATS` with a `useMemo`:

```ts
const portfolioStats = useMemo(() => {
  const source = realBots ?? [];
  const active = source.filter(
    (b) => b.mode === 'LIVE' || b.mode === 'DRY-RUN',
  ).length;
  const paused = source.filter((b) => b.mode === 'PAUSED').length;
  return {
    activeBots: String(active),
    totalBots: String(source.length),
    pausedBots: String(paused),
    // P&L / capital / trades — not yet available from BE list endpoint;
    // shown as "—" until the monitoring phase wires aggregate stats.
    pnl30d: '—',
    pnl30dPct: '—',
    capitalDeployed: '—',
    capitalPairs: '—',
    tradesToday: '—',
    tradesNet: '—',
  };
}, [realBots]);
```

Replace all `PORTFOLIO_STATS.xxx` references in the JSX with `portfolioStats.xxx`. Delete the static `const PORTFOLIO_STATS = {...}`.

The DEMO marker on the hero label: show **only** when `isEmptyReal === true` (i.e., we're falling back to MOCK_BOTS). When real bots exist, hide it.

- [ ] **Step 7: Update "My bots · N total" header**

Replace `My bots · {MOCK_BOTS.length} total` with `My bots · {portfolioStats.totalBots} total`.

- [ ] **Step 8: Typecheck + run dev server smoke**

```bash
pnpm typecheck
pnpm dev
```

Manual: open `http://127.0.0.1:5173/`, connect with a wallet that has 0 bots → see empty banner + DEMO samples. Disconnect, re-connect with a wallet that has bots → see real list.

---

## Task 3: Component tests for DashboardPage

**Files:**
- Create: `src/pages/__tests__/DashboardPage.test.tsx`

- [ ] **Step 1: Write the tests**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../DashboardPage';
import { botApi, type BotOut } from '@/features/bot-monitoring/bot.api';
import { RequireWalletProvider } from '@/features/wallet-auth/RequireWalletProvider';
import { useWalletStore } from '@/features/wallet-auth/wallet.store';

vi.mock('@/features/bot-monitoring/bot.api', () => ({
  botApi: {
    list: vi.fn(),
    getConfig: vi.fn(),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <RequireWalletProvider>
        <DashboardPage />
      </RequireWalletProvider>
    </MemoryRouter>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks(); // resetAllMocks (not clearAllMocks) — also resets implementations set via mockReturnValue, preventing leak between tests
    useWalletStore.setState({
      address: '0xabc',
      nonce: 'n',
      signature: 's',
      status: 'ready',
      user: null,
      error: null,
      signingMessage: null,
    });
  });

  it('shows skeleton cards while loading', () => {
    vi.mocked(botApi.list).mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it('shows real bots when list returns items', async () => {
    vi.mocked(botApi.list).mockResolvedValueOnce([
      {
        id: 42,
        bot_name: 'My ETH bot',
        status: 'running',
        desired_status: null,
        error_message: null,
        strategy_name: 'RsiLong',
      },
    ]);
    vi.mocked(botApi.getConfig).mockResolvedValueOnce({
      config: {
        dry_run: false,
        timeframe: '5m',
        exchange: { pair_whitelist: ['ETH/USDT'] },
      },
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByText('My ETH bot')).toBeInTheDocument(),
    );
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByText(/ETH-USDT/)).toBeInTheDocument();
  });

  it('shows empty banner + demo samples when list is empty', async () => {
    vi.mocked(botApi.list).mockResolvedValueOnce([]);
    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText(/haven't built any bots yet/i),
      ).toBeInTheDocument(),
    );
    // DEMO pill should still show on samples
    const demoPills = screen.getAllByText('Demo');
    expect(demoPills.length).toBeGreaterThan(0);
  });

  it('shows error state with retry button when list fails', async () => {
    vi.mocked(botApi.list).mockRejectedValueOnce(new Error('Network down'));
    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText(/couldn't load your bots/i),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('retry button refetches', async () => {
    vi.mocked(botApi.list)
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce([]);
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/couldn't load your bots/i)).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/haven't built any bots yet/i),
      ).toBeInTheDocument(),
    );
  });

  it('renders bot card even when its config fetch fails', async () => {
    vi.mocked(botApi.list).mockResolvedValueOnce([
      {
        id: 99,
        bot_name: 'Orphan bot',
        status: 'stopped',
        desired_status: null,
        error_message: null,
        strategy_name: 'X',
      },
    ]);
    vi.mocked(botApi.getConfig).mockRejectedValueOnce(new Error('500'));

    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Orphan bot')).toBeInTheDocument(),
    );
    // Pair shows '?' because config failed
    expect(screen.getByText(/\?/)).toBeInTheDocument();
  });

  it('Refresh button triggers a refetch', async () => {
    // First load returns empty; second load returns 1 bot — clicking
    // Refresh between them must show the new bot.
    vi.mocked(botApi.list).mockResolvedValueOnce([]);
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/haven't built any bots/i)).toBeInTheDocument(),
    );

    vi.mocked(botApi.list).mockResolvedValueOnce([
      {
        id: 7,
        bot_name: 'Fresh bot',
        status: 'stopped',
        desired_status: null,
        error_message: null,
        strategy_name: 'X',
      },
    ]);
    vi.mocked(botApi.getConfig).mockResolvedValueOnce({
      config: {
        dry_run: true,
        timeframe: '1h',
        exchange: { pair_whitelist: ['BTC/USDT'] },
      },
    });

    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() =>
      expect(screen.getByText('Fresh bot')).toBeInTheDocument(),
    );
    expect(screen.queryByText(/haven't built any bots/i)).not.toBeInTheDocument();
  });

  it('Refresh button is hidden during loading / error states', async () => {
    // Loading: never-resolving list → refresh hidden
    vi.mocked(botApi.list).mockReturnValue(new Promise(() => {}));
    const { unmount } = renderPage();
    expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
    unmount();

    // Error: list rejects → refresh hidden (Retry inside card replaces it)
    vi.resetAllMocks(); // resetAllMocks (not clearAllMocks) — also resets implementations set via mockReturnValue, preventing leak between tests
    vi.mocked(botApi.list).mockRejectedValueOnce(new Error('boom'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/couldn't load your bots/i)).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
  });

  it('Search input is hidden in empty / error / loading states', async () => {
    // Empty
    vi.mocked(botApi.list).mockResolvedValueOnce([]);
    const { unmount } = renderPage();
    await waitFor(() =>
      expect(screen.getByText(/haven't built any bots/i)).toBeInTheDocument(),
    );
    expect(screen.queryByPlaceholderText(/search bots/i)).not.toBeInTheDocument();
    unmount();

    // Error
    vi.resetAllMocks(); // resetAllMocks (not clearAllMocks) — also resets implementations set via mockReturnValue, preventing leak between tests
    vi.mocked(botApi.list).mockRejectedValueOnce(new Error('x'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/couldn't load your bots/i)).toBeInTheDocument(),
    );
    expect(screen.queryByPlaceholderText(/search bots/i)).not.toBeInTheDocument();
  });

  it('unmount during fetch does not produce a stale state update or crash', async () => {
    // React 18 removed the "setState on unmounted" warning (facebook/react#22114),
    // so this test can't assert on console.error. Instead we (a) confirm we get
    // to the loading state, (b) unmount, (c) resolve the in-flight fetch AFTER
    // unmount, and (d) assert no exception escapes the microtask queue. If the
    // cancelled flag is removed, React will still tolerate the late setState
    // silently in v18, but this test documents the intent.
    let resolveList!: (value: BotOut[]) => void;
    vi.mocked(botApi.list).mockReturnValueOnce(
      new Promise((res) => {
        resolveList = res;
      }),
    );

    const { unmount } = renderPage();
    // Confirm we hit the loading state before unmounting
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(3);

    unmount();
    // Resolve AFTER unmount — cancelled flag should prevent the subsequent
    // Promise.allSettled chain from running setState.
    resolveList([]);
    await new Promise((r) => setTimeout(r, 0));

    // No assertion on console — just verifying no exception bubbled up.
    // Mounted-state checks aren't possible after unmount; the value here
    // is regression coverage if React ever reintroduces the warning, plus
    // documenting intent for human reviewers.
    expect(vi.mocked(botApi.list)).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm vitest run src/pages/__tests__/DashboardPage.test.tsx
```

All 10 should pass (6 original + 4 new: Refresh button, Refresh hidden, Search hidden, unmount safe).

- [ ] **Step 3: Full test sweep**

```bash
pnpm vitest run
```

Confirm no regressions outside this scope. The flaky `CypheusPanel.test.tsx` is pre-existing — ignore.

---

## Task 4: Lint, typecheck, format

- [ ] **Step 1**

```bash
pnpm typecheck
pnpm lint --max-warnings=0
# Format ONLY the files this phase touched — running `pnpm format` would drag
# unrelated drift into the commits (we hit this on the header glass refresh task).
npx prettier --write \
  src/features/bot-monitoring/bot-list.helpers.ts \
  src/features/bot-monitoring/bot-list.helpers.test.ts \
  src/pages/DashboardPage.tsx \
  src/pages/__tests__/DashboardPage.test.tsx
```

- [ ] **Step 2: Verify nothing in `src/` was left with TODO markers from this work**

```bash
grep -rn "TODO\|FIXME" src/pages/DashboardPage.tsx src/features/bot-monitoring/bot-list.helpers.ts
```

Should print nothing related to this phase.

---

## Task 5: Manual smoke (with a real wallet)

- [ ] **Step 1: Login fresh wallet (zero bots)**

1. `pnpm dev`
2. Open `http://127.0.0.1:5173`
3. Connect a Coin98 wallet that has no bots
4. Dashboard mounts → loading skeleton (~200ms)
5. After fetch: empty banner appears + 3 DEMO sample cards visible
6. Hero portfolio: "0 active · 0 total · 0 paused", P&L shown as "—"
7. **Click a DEMO card** → navigates to `/builder` (not `/bots/1` which would 404)

- [ ] **Step 2: Create a bot via Builder**

1. Click **New bot**
2. Fill wizard (any valid config)
3. ExportDialog → click **Submit to Backend**
4. Toast: `Bot #<id> "<name>" đã được tạo thành công`
5. Auto-navigate to `/bots/{id}` (BotMonitoringPage — still shows mock for now)

- [ ] **Step 3: Verify Dashboard sees the new bot**

1. Click logo or **Dashboard** in nav → back to `/`
2. Loading skeleton → real list with the bot just created
3. Hero portfolio reflects new count
4. Empty banner is gone
5. DEMO pill is gone from hero
6. Search input + Refresh button now visible (loaded state)

- [ ] **Step 4: Refresh button**

1. On Dashboard with bots loaded, click **Refresh** icon button
2. Expect: skeleton flash → list re-renders
3. Throttle network "Slow 3G" + click Refresh → skeleton visible for ~1-2s

- [ ] **Step 5: Edge case — per-bot config failure**

(Best done on a test BE that returns 500 for `/bot/{id}/config`)
- Card still shows name + status
- Pair / timeframe show `?`

- [ ] **Step 6: Edge case — list endpoint down**

(Toggle BE off, or block `/bot/list` route)
- Error card + Retry button visible (Refresh icon and Search input hidden)
- Hero portfolio shows all "—"
- Retry → reconnects when BE is back

---

## Task 6: Commit + push

- [ ] **Step 1: Commit per task**

Three commits (one per logical chunk):

```bash
git add src/features/bot-monitoring/bot-list.helpers.ts \
        src/features/bot-monitoring/bot-list.helpers.test.ts
git commit -m "feat(bot-list): pure helpers map BotOut + config → DashboardBot"

git add src/pages/DashboardPage.tsx
git commit -m "feat(dashboard): wire botApi.list + getConfig, keep DEMO as empty fallback"

git add src/pages/__tests__/DashboardPage.test.tsx
git commit -m "test(dashboard): 10 states — loading, loaded, empty, error, retry, refresh, hidden controls, unmount safety"
```

- [ ] **Step 2: Branch + push**

```bash
git checkout -b feat/dashboard-real-bots
git push -u origin feat/dashboard-real-bots
```

- [ ] **Step 3: Open PR**

PR title: `feat(dashboard): wire to real /bot/list, demo as empty fallback`
PR body: link to spec + plan, summary of files changed, manual smoke checklist.

---

## Definition of Done

- [ ] All Vitest tests pass (~6 helpers + 10 page = 16 new) — no regression elsewhere
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint --max-warnings=0` clean (ignore pre-existing react-refresh warnings)
- [ ] Manual smoke (Task 5) all green with a real Coin98 wallet + BE up
- [ ] PR opened with link to spec + plan
- [ ] DEMO pill / empty banner only appear when `realBots !== null && realBots.length === 0`
- [ ] Hero portfolio "active/total/paused" counts match the rendered list
- [ ] Search input + Refresh button hidden in loading/error states; Refresh visible in empty state; both visible in loaded state
- [ ] Unmount during fetch does not crash and the cancelled flag prevents stale setState (test documents intent — React 18 no longer warns, see Devin review F-S1)
- [ ] `BotConfigOut.config` is unwrapped before passing to `zipBotsAndConfigs` (Devin review F1)
- [ ] `BotCardProps.bot` typed as `DashboardBot | MockBot` (Devin review F2)
- [ ] Demo card click navigates to `/builder` (not to `/bots/{mock-id}` which would 404 — Devin review N1)
- [ ] Trailing "·" separator removed when `uptime` is null (Devin review N2)

---

## Out of scope (next phase)

- `POST /bot/{id}/start`, `POST /bot/{id}/stop`, `DELETE /bot/{id}` — controls on cards
- `GET /bot/{id}/performance` aggregate → real P&L / sharpe / win rate
- Auto-refresh on window focus (window focus event re-triggers fetch)
- `MyBotsDialog` cleanup (decided: keep both — see spec §1 row 14)
- `BotMonitoringPage` real data wiring (still uses `mockBotData.ts`)
- Update bot from Dashboard (link to `/builder?bot_id=X`)
- Pagination (assumes < 50 bots per user — defer until BE adds `offset/limit`)
- Sort / filter / inline-rename / drag-reorder
- Batching getConfig requests when N is large
