# Backtest Per-Trade Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-trade breakdown table to the BacktestDialog result step, toggled by a "Tổng quan ↔ Lệnh (N)" tab strip.
**Architecture:** New pure helpers `extractTrades`, `formatTradeDuration`, `formatTradeTime` added to `backtest-helpers.ts`; the dialog gains a `resultTab` state (`'summary' | 'trades'`) and renders a scrollable table using the `BacktestTrade[]` extracted from `results.strategy.<StrategyName>.trades`; no new dependencies — styling mirrors existing `ResultMetric` card and tone convention.
**Tech Stack:** React 18, TS 5.7, Tailwind 3, Vitest + @testing-library/react.
**Spec:** docs/superpowers/specs/2026-06-03-backtest-trades-table-design.md (WS3) — committed on branch `feat/backtest-trades-table` (commit `be8cb11`).
**Branch:** off **C1** (`fix/backtest-stake-currency`, PR #20) — NOT plain `main`.

---

> ## ⚠️ Dependency & correction (read first)
> **Builds on C1 (PR #20).** `quoteCurrencyFromPair` + its tests **already exist** in `backtest-helpers.ts`/`.test.ts` from C1. **Do NOT re-add or re-test `quoteCurrencyFromPair`** — just `import`/reuse it. Branch this work off `fix/backtest-stake-currency` (or off `main` after PR #20 merges), not plain `main`. Any step below that implements/tests `quoteCurrencyFromPair` is superseded by this note — skip it; only add `BacktestTrade`, `extractTrades`, `formatTradeDuration`, `formatTradeTime`. `BacktestDialog` already derives `currency` from `quoteCurrencyFromPair(bot.pair)` (also from C1) — reuse that `currency` for the P/L column.

---

## File Structure

| File | Action |
|------|--------|
| `src/features/backtest/backtest-helpers.ts` | Extend — add `BacktestTrade`, `extractTrades`, `formatTradeDuration`, `formatTradeTime` (NOT `quoteCurrencyFromPair` — already exists from C1) |
| `src/features/backtest/backtest-helpers.test.ts` | Extend — new `describe` blocks for every new helper |
| `src/features/backtest/BacktestDialog.tsx` | Extend — `resultTab` state + toggle strip + trades table (6 cols) + empty state |
| `src/features/backtest/BacktestDialog.test.tsx` | Extend — toggle tests, table render tests, empty-state test |

---

## Task 1 — `BacktestTrade` type + `extractTrades` helper (TDD)

**Files:** `src/features/backtest/backtest-helpers.ts`, `src/features/backtest/backtest-helpers.test.ts`

### Context

`BE/backtest_200.json` confirms the path `results.strategy.<StrategyName>.trades[]` with per-trade fields (confirmed field names in §Self-Review). The strategy name is a dynamic key — use `strategy_name` from the top-level `BacktestHistoryItem`, then fall back to the first key of `results.strategy`. Return `[]` when the path is absent or `trades` is not an array.

`quoteCurrencyFromPair` extracts the quote from a Freqtrade JSON pair like `"BTC/USDC:USDC"` (returns `"USDC"`) or a UI dash pair like `"BTC-USDT"` (returns `"USDT"`). It is needed both by the trades table (column header for P/L) and by `BacktestDialog` (already derives `currency` from `bot.pair`).

### Steps

- [ ] **Step 1.1** — Write failing tests in `backtest-helpers.test.ts`:

  ```ts
  import { extractTrades } from './backtest-helpers';
  import type { BacktestHistoryItem } from '@/types/api-helpers';

  // Minimal trade fixture matching real backtest_200.json fields
  const TRADE_FIXTURE = {
    pair: 'BTC/USDC:USDC',
    open_timestamp: 1777251300000,
    close_timestamp: 1777272900000,
    open_rate: 78938.0,
    close_rate: 79088.0,
    profit_abs: 0.97893036,
    profit_ratio: 0.009791214945164765,
    exit_reason: 'duration_6.0_hours',
    enter_tag: 'ui_enter_long',
    trade_duration: 360,
    is_short: false,
    leverage: 10,
  };

  describe('extractTrades', () => {
    const base: BacktestHistoryItem = {
      id: 200,
      bot_id: 86,
      user_id: 10,
      strategy_name: 'Gamma',
      timeframe: '5m',
      timerange: '20260427-20260527',
      status: 'completed',
      trade_count: 104,
      total_profit: -36.5898,
      win_rate: 44.23,
      started_at: '2026-05-27T07:27:25.027324',
      completed_at: '2026-05-27T07:28:05.224419',
      results: {
        strategy: { Gamma: { trades: [TRADE_FIXTURE] } },
        strategy_comparison: [],
      },
    };

    it('returns trades array for the named strategy', () => {
      const trades = extractTrades(base);
      expect(trades).toHaveLength(1);
      expect(trades[0].open_rate).toBe(78938.0);
      expect(trades[0].profit_abs).toBeCloseTo(0.97893036);
    });
    it('falls back to first key when strategy_name does not match', () => {
      const item = { ...base, strategy_name: 'Unknown' };
      expect(extractTrades(item)).toHaveLength(1);
    });
    it('returns [] when results is null', () => {
      expect(extractTrades({ ...base, results: null })).toEqual([]);
    });
    it('returns [] when results.strategy is missing', () => {
      expect(extractTrades({ ...base, results: {} })).toEqual([]);
    });
    it('returns [] when trades array is empty', () => {
      const item = {
        ...base,
        results: { strategy: { Gamma: { trades: [] } } },
      };
      expect(extractTrades(item)).toEqual([]);
    });
    it('returns [] when trades field is not an array', () => {
      const item = {
        ...base,
        results: { strategy: { Gamma: { trades: null } } },
      };
      expect(extractTrades(item)).toEqual([]);
    });
  });
  ```

- [ ] **Step 1.2** — Run tests to confirm failures: `pnpm test backtest-helpers`

- [ ] **Step 1.3** — Implement in `backtest-helpers.ts`:

  > `quoteCurrencyFromPair` already exists from C1 — do NOT re-add it. Only add `BacktestTrade` + `extractTrades` here. Import `quoteCurrencyFromPair` from `'./backtest-helpers'` wherever it's needed later (it's already exported by C1).

  ```ts
  /** Shape of one trade entry inside
   * `results.strategy.<StrategyName>.trades[]` in BE/backtest_200.json.
   * Field names match Freqtrade's backtest output exactly. */
  export interface BacktestTrade {
    pair: string;
    open_timestamp: number;   // epoch ms
    close_timestamp: number;  // epoch ms
    open_rate: number;
    close_rate: number;
    profit_abs: number;       // absolute P/L in stake currency
    profit_ratio: number;     // fraction (0.01 = 1%)
    exit_reason: string;
    enter_tag: string;
    trade_duration: number;   // minutes
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
    return Array.isArray(trades) ? (trades as BacktestTrade[]) : [];
  }
  ```

- [ ] **Step 1.4** — Run tests to confirm green: `pnpm test backtest-helpers`

- [ ] **Step 1.5** — Commit: `feat(backtest): add BacktestTrade type + extractTrades helper`

---

## Task 2 — `formatTradeDuration` and `formatTradeTime` helpers (TDD)

**Files:** `src/features/backtest/backtest-helpers.ts`, `src/features/backtest/backtest-helpers.test.ts`

### Context

`formatTradeDuration(minutes: number): string` — converts a trade duration in minutes (the `trade_duration` field in backtest_200.json is always in minutes, e.g. `360` = 6 hours) to a human-readable string. Convention: `"6h 0m"`, `"2d 3h"`, `"45m"`.

`formatTradeTime(epochMs: number): string` — converts an epoch-ms timestamp (`open_timestamp` or `close_timestamp`) to a short UTC date string for display in the table. Convention: `"Apr 27 00:55"` (month abbreviation + day + HH:MM UTC).

### Steps

- [ ] **Step 2.1** — Write failing tests in `backtest-helpers.test.ts`. First extend the existing import at the top of the file to add the two new helpers (Task 1 imported only `extractTrades`):

  ```ts
  import {
    extractTrades,
    formatTradeDuration,
    formatTradeTime,
  } from './backtest-helpers';
  ```

  Then add these `describe` blocks:

  ```ts
  describe('formatTradeDuration', () => {
    it('formats minutes < 60 as "Xm"', () => {
      expect(formatTradeDuration(45)).toBe('45m');
    });
    it('formats exactly 60 minutes as "1h 0m"', () => {
      expect(formatTradeDuration(60)).toBe('1h 0m');
    });
    it('formats 360 minutes (6h) as "6h 0m"', () => {
      expect(formatTradeDuration(360)).toBe('6h 0m');
    });
    it('formats 125 minutes as "2h 5m"', () => {
      expect(formatTradeDuration(125)).toBe('2h 5m');
    });
    it('formats 1440 minutes (1 day) as "1d 0h"', () => {
      expect(formatTradeDuration(1440)).toBe('1d 0h');
    });
    it('formats 2955 minutes as "2d 1h"', () => {
      // 2955 / 1440 = 2d remainder 75min = 1h 15m → "2d 1h"
      expect(formatTradeDuration(2955)).toBe('2d 1h');
    });
    it('formats 0 minutes as "0m"', () => {
      expect(formatTradeDuration(0)).toBe('0m');
    });
  });

  describe('formatTradeTime', () => {
    it('formats epoch ms to "MMM DD HH:MM" in UTC', () => {
      // 1777251300000 = 2026-04-27 00:55:00 UTC (confirmed from backtest_200.json open_date)
      expect(formatTradeTime(1777251300000)).toBe('Apr 27 00:55');
    });
    it('formats close_timestamp correctly', () => {
      // 1777272900000 = 2026-04-27 06:55:00 UTC
      expect(formatTradeTime(1777272900000)).toBe('Apr 27 06:55');
    });
  });
  ```

- [ ] **Step 2.2** — Run tests to confirm failures: `pnpm test backtest-helpers`

- [ ] **Step 2.3** — Implement in `backtest-helpers.ts`:

  ```ts
  const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
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
  ```

- [ ] **Step 2.4** — Run tests to confirm green: `pnpm test backtest-helpers`

- [ ] **Step 2.5** — Commit: `feat(backtest): add formatTradeDuration + formatTradeTime helpers`

---

## Task 3 — `resultTab` state + "Tổng quan ↔ Lệnh (N)" toggle (TDD)

**Files:** `src/features/backtest/BacktestDialog.tsx`, `src/features/backtest/BacktestDialog.test.tsx`

### Context

The result step currently renders 6 `ResultMetric` cards unconditionally. Add a `resultTab` state (`'summary' | 'trades'`, default `'summary'`) that is reset to `'summary'` whenever the dialog re-opens (add to the existing `useEffect([open, initialBacktestId])`). Render a two-button toggle strip above the metrics grid. The label for the trades tab must show the live count: `Lệnh (${trades.length})`.

### Steps

- [ ] **Step 3.1** — Write failing tests in `BacktestDialog.test.tsx`:

  ```ts
  // Add to the existing describe('BacktestDialog') block.

  it('shows "Tổng quan" and "Lệnh (N)" tabs in the result step', () => {
    mockPoll.mockReturnValue({
      item: {
        id: 99,
        bot_id: 42,
        user_id: 7,
        strategy_name: 'Gamma',
        timeframe: '5m',
        timerange: '20260514-20260521',
        status: 'completed',
        trade_count: 2,
        total_profit: 1.0,
        win_rate: 50.0,
        started_at: '2026-05-21T00:00:00Z',
        completed_at: '2026-05-21T00:01:00Z',
        results: {
          strategy: {
            Gamma: {
              trades: [
                {
                  pair: 'BTC/USDC:USDC',
                  open_timestamp: 1777251300000,
                  close_timestamp: 1777272900000,
                  open_rate: 78938,
                  close_rate: 79088,
                  profit_abs: 0.97,
                  profit_ratio: 0.0097,
                  exit_reason: 'duration_6.0_hours',
                  enter_tag: 'ui_enter_long',
                  trade_duration: 360,
                  is_short: false,
                  leverage: 10,
                },
                {
                  pair: 'BTC/USDC:USDC',
                  open_timestamp: 1777288200000,
                  close_timestamp: 1777309800000,
                  open_rate: 77716,
                  close_rate: 76662,
                  profit_abs: 12.7,
                  profit_ratio: 0.127,
                  exit_reason: 'duration_6.0_hours',
                  enter_tag: 'ui_enter_short',
                  trade_duration: 360,
                  is_short: true,
                  leverage: 10,
                },
              ],
            },
          },
          strategy_comparison: [],
        },
      },
      done: true,
      error: null,
    });
    render(
      <BacktestDialog
        open
        bot={bot}
        onOpenChange={() => {}}
        initialBacktestId={99}
      />,
    );
    expect(screen.getByRole('button', { name: /Tổng quan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lệnh \(2\)/i })).toBeInTheDocument();
  });

  it('defaults to summary tab — ResultMetric cards visible', () => {
    mockPoll.mockReturnValue({
      item: {
        id: 99,
        bot_id: 42,
        user_id: 7,
        strategy_name: 'Gamma',
        timeframe: '5m',
        timerange: '20260514-20260521',
        status: 'completed',
        trade_count: 1,
        total_profit: 1.0,
        win_rate: 100.0,
        started_at: '2026-05-21T00:00:00Z',
        completed_at: '2026-05-21T00:01:00Z',
        results: {
          strategy: { Gamma: { trades: [] } },
          strategy_comparison: [],
        },
      },
      done: true,
      error: null,
    });
    render(
      <BacktestDialog
        open
        bot={bot}
        onOpenChange={() => {}}
        initialBacktestId={99}
      />,
    );
    // Summary metrics are visible by default.
    expect(screen.getByText('Trades')).toBeInTheDocument();
    expect(screen.getByText('Win rate')).toBeInTheDocument();
  });

  it('resultTab resets to summary when dialog re-opens', async () => {
    const { rerender } = render(
      <BacktestDialog open={false} bot={bot} onOpenChange={() => {}} />,
    );
    // Re-open — should land on summary.
    rerender(<BacktestDialog open bot={bot} onOpenChange={() => {}} />);
    // setup step visible (no initialBacktestId) — toggle not present yet, but no crash.
    expect(screen.getByRole('button', { name: /run backtest/i })).toBeInTheDocument();
  });
  ```

- [ ] **Step 3.2** — Run tests to confirm failures: `pnpm test BacktestDialog`

- [ ] **Step 3.3** — Implement in `BacktestDialog.tsx`:

  1. Import only `extractTrades` from `'./backtest-helpers'` (do NOT re-import `quoteCurrencyFromPair` — C1's `BacktestDialog` already imports and uses it at line 13 and derives `const currency` at line 94).
  2. Add state: `const [resultTab, setResultTab] = useState<'summary' | 'trades'>('summary');`
  3. Derive trades: `const trades = useMemo(() => (poll.item ? extractTrades(poll.item) : []), [poll.item]);`
  4. Reuse the existing `currency` variable (already derived from `quoteCurrencyFromPair(bot.pair)` by C1 — do NOT redeclare it).
  5. In the existing `useEffect([open, initialBacktestId])` reset block, add `setResultTab('summary');`.
  6. In the result step render (inside `{step === 'result' && metrics && (...)}`) add the toggle strip above the grid:

  ```tsx
  {/* Tab toggle */}
  <div className="flex gap-1 rounded-lg bg-surface p-0.5">
    <button
      type="button"
      onClick={() => setResultTab('summary')}
      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        resultTab === 'summary'
          ? 'bg-surface-elevated text-fg shadow-sm'
          : 'text-fg-muted hover:text-fg'
      }`}
    >
      Tổng quan
    </button>
    <button
      type="button"
      onClick={() => setResultTab('trades')}
      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        resultTab === 'trades'
          ? 'bg-surface-elevated text-fg shadow-sm'
          : 'text-fg-muted hover:text-fg'
      }`}
    >
      {`Lệnh (${trades.length})`}
    </button>
  </div>
  ```

  7. Wrap the existing 6-card metrics grid in `{resultTab === 'summary' && (...)}`.

- [ ] **Step 3.4** — Run tests to confirm green: `pnpm test BacktestDialog`

- [ ] **Step 3.5** — Commit: `feat(backtest): add resultTab toggle — Tổng quan / Lệnh (N)`

---

## Task 4 — Trades table (6 columns) + empty state (TDD)

**Files:** `src/features/backtest/BacktestDialog.tsx`, `src/features/backtest/BacktestDialog.test.tsx`

### Context

The 6 columns (from spec WS3):

| # | Header | Data field | Notes |
|---|--------|-----------|-------|
| 1 | Open | `open_timestamp` | `formatTradeTime(open_timestamp)` |
| 2 | Close | `close_timestamp` | `formatTradeTime(close_timestamp)` |
| 3 | Dir | `is_short` | Badge: `SHORT` (bearish tone) or `LONG` (bullish tone) |
| 4 | P/L ({currency}) | `profit_abs` | Colored: positive = `text-bullish`, negative = `text-bearish`; display with 2 dp and sign |
| 5 | P/L % | `profit_ratio` | `(ratio * 100).toFixed(2) + '%'` with sign and color |
| 6 | Exit | `exit_reason` | Plain text; no icon required |

Empty state: when `trades.length === 0` and tab is `'trades'`, render a centered muted message `"Không có lệnh nào trong khoảng thời gian này."`.

Table scroll: wrap in a `div` with `max-h-[320px] overflow-y-auto` so it doesn't blow the dialog height.

### Steps

- [ ] **Step 4.1** — Write failing tests in `BacktestDialog.test.tsx`:

  ```ts
  // Reuse the 2-trade fixture from Task 3 tests. Factor into a shared const
  // RESULT_ITEM_WITH_TRADES at the top of the describe block for reuse.

  it('clicking "Lệnh (N)" tab renders the trades table headers', () => {
    mockPoll.mockReturnValue({ item: RESULT_ITEM_WITH_TRADES, done: true, error: null });
    render(
      <BacktestDialog open bot={bot} onOpenChange={() => {}} initialBacktestId={99} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Lệnh \(2\)/i }));
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
    expect(screen.getByText('Dir')).toBeInTheDocument();
    // Column 4 header uses currency from bot.pair "BTC/USDT" → "USDT"
    expect(screen.getByText(/P\/L \(USDT\)/i)).toBeInTheDocument();
    expect(screen.getByText('P/L %')).toBeInTheDocument();
    expect(screen.getByText('Exit')).toBeInTheDocument();
  });

  it('renders trade rows with correct Dir badge and P/L values', () => {
    mockPoll.mockReturnValue({ item: RESULT_ITEM_WITH_TRADES, done: true, error: null });
    render(
      <BacktestDialog open bot={bot} onOpenChange={() => {}} initialBacktestId={99} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Lệnh \(2\)/i }));
    // Trade 1: is_short=false → LONG badge
    expect(screen.getByText('LONG')).toBeInTheDocument();
    // Trade 2: is_short=true → SHORT badge
    expect(screen.getByText('SHORT')).toBeInTheDocument();
    // Trade 1 profit_abs = 0.97 → "+0.97"
    expect(screen.getByText('+0.97')).toBeInTheDocument();
    // Trade 2 profit_abs = 12.70 → "+12.70"
    expect(screen.getByText('+12.70')).toBeInTheDocument();
    // Exit reasons
    expect(screen.getAllByText('duration_6.0_hours')).toHaveLength(2);
  });

  it('shows empty state message when trades array is empty', () => {
    mockPoll.mockReturnValue({
      item: {
        ...RESULT_ITEM_WITH_TRADES,
        results: { strategy: { Gamma: { trades: [] } }, strategy_comparison: [] },
      },
      done: true,
      error: null,
    });
    render(
      <BacktestDialog open bot={bot} onOpenChange={() => {}} initialBacktestId={99} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Lệnh \(0\)/i }));
    expect(
      screen.getByText(/Không có lệnh nào trong khoảng thời gian này\./i),
    ).toBeInTheDocument();
  });

  it('summary tab is still accessible and shows metric cards', () => {
    mockPoll.mockReturnValue({ item: RESULT_ITEM_WITH_TRADES, done: true, error: null });
    render(
      <BacktestDialog open bot={bot} onOpenChange={() => {}} initialBacktestId={99} />,
    );
    // Switch to trades.
    fireEvent.click(screen.getByRole('button', { name: /Lệnh \(2\)/i }));
    // Switch back to summary.
    fireEvent.click(screen.getByRole('button', { name: /Tổng quan/i }));
    // Metric cards reappear.
    expect(screen.getByText('Trades')).toBeInTheDocument();
    expect(screen.getByText('Win rate')).toBeInTheDocument();
  });
  ```

- [ ] **Step 4.2** — Run tests to confirm failures: `pnpm test BacktestDialog`

- [ ] **Step 4.3** — Implement the trades table in `BacktestDialog.tsx`.

  Add the following below the existing summary grid section (still inside `{step === 'result' && metrics && (...)}`):

  ```tsx
  {resultTab === 'trades' && (
    <>
      {trades.length === 0 ? (
        <p className="py-10 text-center text-sm text-fg-muted">
          Không có lệnh nào trong khoảng thời gian này.
        </p>
      ) : (
        <div className="max-h-[320px] overflow-y-auto rounded-xl border border-border-subtle">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-elevated">
              <tr className="border-b border-border-subtle text-left text-fg-muted">
                <th className="px-3 py-2 font-medium">Open</th>
                <th className="px-3 py-2 font-medium">Close</th>
                <th className="px-3 py-2 font-medium">Dir</th>
                <th className="px-3 py-2 font-medium text-right">{`P/L (${currency})`}</th>
                <th className="px-3 py-2 font-medium text-right">P/L %</th>
                <th className="px-3 py-2 font-medium">Exit</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => {
                const plSign = t.profit_abs >= 0 ? '+' : '';
                const plCls = t.profit_abs >= 0 ? 'text-bullish' : 'text-bearish';
                const pctSign = t.profit_ratio >= 0 ? '+' : '';
                return (
                  <tr
                    key={i}
                    className="border-b border-border-subtle/50 last:border-0 hover:bg-surface-hover/40"
                  >
                    <td className="px-3 py-2 tabular-nums text-fg-secondary">
                      {formatTradeTime(t.open_timestamp)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-fg-secondary">
                      {formatTradeTime(t.close_timestamp)}
                    </td>
                    <td className="px-3 py-2">
                      {t.is_short ? (
                        <span className="rounded px-1.5 py-0.5 text-2xs font-semibold bg-bearish/15 text-bearish">
                          SHORT
                        </span>
                      ) : (
                        <span className="rounded px-1.5 py-0.5 text-2xs font-semibold bg-bullish/15 text-bullish">
                          LONG
                        </span>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono tabular-nums ${plCls}`}>
                      {`${plSign}${t.profit_abs.toFixed(2)}`}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono tabular-nums ${plCls}`}>
                      {`${pctSign}${(t.profit_ratio * 100).toFixed(2)}%`}
                    </td>
                    <td className="px-3 py-2 text-fg-muted">
                      {t.exit_reason}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )}
  ```

  Import `formatTradeTime` (already added in Task 2) and ensure `currency` is already derived from `quoteCurrencyFromPair(bot.pair)`.

- [ ] **Step 4.4** — Run tests to confirm green: `pnpm test BacktestDialog`

- [ ] **Step 4.5** — Commit: `feat(backtest): trades table — 6 columns, empty state, P/L color`

---

## Task 5 — Final sweep: typecheck + lint + full test suite green

**Files:** all modified files

### Steps

- [ ] **Step 5.1** — Run `pnpm typecheck`. Fix any TS errors (likely: ensure `BacktestTrade` is exported and imported; ensure `resultTab` state type is explicit; ensure `trades` useMemo has correct return type; check `currency` variable is in scope inside JSX).

- [ ] **Step 5.2** — Run `pnpm lint`. Fix any ESLint warnings (likely: unused imports, `key` prop on table rows already covered by index `i`).

- [ ] **Step 5.3** — Run `pnpm test backtest`. All tests in `backtest-helpers.test.ts` and `BacktestDialog.test.tsx` must be green. Count should increase by approximately 12-15 new tests.

- [ ] **Step 5.4** — Run `pnpm format` to sort Tailwind classes and ensure consistent formatting.

- [ ] **Step 5.5** — Commit: `chore(backtest): typecheck + lint + format sweep`

---

## Self-Review — WS3 Spec Requirements Mapped to Tasks

| WS3 Requirement | Covered by |
|-----------------|-----------|
| `BacktestTrade` interface with real field names from `BE/backtest_200.json` | Task 1 — Step 1.3 |
| `extractTrades(item)` — strategy_name key lookup + first-key fallback + `[]` guard | Task 1 — Step 1.3 |
| `quoteCurrencyFromPair` for P/L column header currency | Already exists from C1 — reuse via `import { quoteCurrencyFromPair } from './backtest-helpers'` |
| `formatTradeDuration(minutes)` — "6h 0m", "2d 1h", "45m" patterns | Task 2 — Step 2.3 |
| `formatTradeTime(epochMs)` — "Apr 27 00:55" UTC display | Task 2 — Step 2.3 |
| `resultTab` state reset on dialog re-open | Task 3 — Step 3.3 (useEffect) |
| "Tổng quan ↔ Lệnh (N)" toggle strip with live count | Task 3 — Step 3.3 |
| Default tab is "Tổng quan" (existing metrics undisturbed) | Task 3 — Step 3.3 |
| 6-column table: Open, Close, Dir, P/L (currency), P/L %, Exit | Task 4 — Step 4.3 |
| Dir badge: SHORT (bearish) / LONG (bullish) | Task 4 — Step 4.3 |
| P/L colored: bullish for positive, bearish for negative | Task 4 — Step 4.3 |
| Empty state message when trades = [] | Task 4 — Step 4.3 |
| Table scroll capped at max-h-[320px] overflow-y-auto | Task 4 — Step 4.3 |
| All helpers TDD (failing test → implement → green) | Tasks 1-4 each have TDD steps |
| `pnpm typecheck && pnpm lint && pnpm test backtest` green | Task 5 |
| Reuses `BacktestComparisonItem` local-type pattern | Task 1 — mirrors existing pattern |
| No new external dependencies | All tasks — Tailwind + React only |

### Confirmed `trades[]` field names from `BE/backtest_200.json`

The following fields exist on every trade object in `results.strategy.Gamma.trades[]`:
- `pair` — string, e.g. `"BTC/USDC:USDC"`
- `open_timestamp` — number (epoch ms), e.g. `1777251300000`
- `close_timestamp` — number (epoch ms), e.g. `1777272900000`
- `open_date` — string (human-readable), e.g. `"2026-04-27 00:55:00+00:00"` (not used in table — use `open_timestamp` instead)
- `close_date` — string (human-readable), e.g. `"2026-04-27 06:55:00+00:00"` (not used — use `close_timestamp`)
- `open_rate` — number
- `close_rate` — number
- `profit_abs` — number (absolute P/L in stake currency)
- `profit_ratio` — number (fraction, not percent)
- `exit_reason` — string, e.g. `"duration_6.0_hours"`, `"exit_signal"`
- `enter_tag` — string, e.g. `"ui_enter_long"`, `"ui_enter_short"`
- `trade_duration` — number (minutes)
- `is_short` — boolean
- `leverage` — number

Additional fields present but not used in the table: `amount`, `stake_amount`, `max_stake_amount`, `fee_open`, `fee_close`, `initial_stop_loss_abs`, `initial_stop_loss_ratio`, `stop_loss_abs`, `stop_loss_ratio`, `min_rate`, `max_rate`, `is_open`, `funding_fees`, `weekday`, `orders[]`.
