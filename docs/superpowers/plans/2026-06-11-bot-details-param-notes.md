# Bot Details — Parameter Notes (Help Tooltips) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `?`-icon help tooltips to the non-obvious parameters on the bot details screen (`BotMonitoringPage`), reusing the existing builder pattern.

**Architecture:** Extract the help-icon + tooltip currently inlined in `FormField` into a standalone `InfoHint` component, refactor `FormField` to consume it, then thread an optional `hint` prop through the three label primitives the detail screen uses (`KV`, `Kpi`, Performance metric cells). All copy lives in a new `strings.helpText.monitoring` block; risk-config fields reuse existing `botConfig` strings.

**Tech Stack:** React 18 + TypeScript, Radix UI Tooltip (`@/components/ui/tooltip`), `lucide-react` (`HelpCircle`), Vitest + Testing Library, Tailwind. Strings in `src/i18n/en.ts`.

**Spec:** `docs/superpowers/specs/2026-06-11-bot-details-param-notes-design.md`

---

## File Structure

- **Create** `src/components/ui/info-hint.tsx` — reusable help-icon + tooltip. One responsibility: show explanatory copy on hover/focus.
- **Create** `src/components/ui/info-hint.test.tsx` — unit test for the above.
- **Modify** `src/components/ui/form-field.tsx` — replace inlined help block with `<InfoHint>` (DRY, zero visual change).
- **Modify** `src/i18n/en.ts` — add `helpText.monitoring` copy block.
- **Modify** `src/features/bot-monitoring/detail/panel-kit.tsx` — `KV` gains optional `hint`.
- **Modify** `src/features/bot-monitoring/detail/StatusPanel.tsx` — wire 4 hints.
- **Modify** `src/features/bot-monitoring/detail/ConfigPanel.tsx` — per-row hint lookup.
- **Modify** `src/features/bot-monitoring/detail/DetailHero.tsx` — `Kpi` gains optional `hint`; wire 3 KPIs.
- **Modify** `src/features/bot-monitoring/detail/PerformancePanel.tsx` — metric cells gain hints.

---

## Task 1: `InfoHint` reusable component

**Files:**

- Create: `src/components/ui/info-hint.tsx`
- Test: `src/components/ui/info-hint.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ui/info-hint.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InfoHint } from './info-hint';

describe('InfoHint', () => {
  it('renders a trigger button with the default aria-label', () => {
    render(<InfoHint text="Some explanatory note" />);
    expect(
      screen.getByRole('button', { name: 'More info' }),
    ).toBeInTheDocument();
  });

  it('uses a custom aria-label when provided', () => {
    render(<InfoHint text="x" label="Win rate help" />);
    expect(
      screen.getByRole('button', { name: 'Win rate help' }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/components/ui/info-hint.test.tsx`
Expected: FAIL — cannot resolve `./info-hint` (module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/components/ui/info-hint.tsx` (lifted verbatim from `form-field.tsx:52-72`):

```tsx
import { type ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';

export interface InfoHintProps {
  /** The explanatory copy shown in the tooltip. */
  text: ReactNode;
  /** Tooltip placement relative to the icon. */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Accessible name for the trigger button. */
  label?: string;
}

/**
 * A small `?` icon that reveals explanatory copy on hover/focus. Shared by
 * `FormField` (builder forms) and the bot-detail panels so help affordances
 * look and behave identically everywhere.
 */
export function InfoHint({
  text,
  side = 'top',
  label = 'More info',
}: InfoHintProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-xs leading-snug">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/components/ui/info-hint.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/info-hint.tsx src/components/ui/info-hint.test.tsx
git commit -m "feat(ui): add reusable InfoHint help-icon tooltip"
```

---

## Task 2: Refactor `FormField` to use `InfoHint`

**Files:**

- Modify: `src/components/ui/form-field.tsx`

This is a behaviour-preserving refactor. The regression guard is the existing builder test suite — it must stay green.

- [ ] **Step 1: Replace the inlined help block**

In `src/components/ui/form-field.tsx`, change the imports — remove the now-unused tooltip/icon imports and add `InfoHint`:

```tsx
import { type ReactNode } from 'react';
import { Label } from './label';
import { InfoHint } from './info-hint';
import { cn } from '@/lib/utils';
```

(Delete the old `import { HelpCircle } from 'lucide-react';` and the `import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';` lines.)

Then replace the entire `help ? ( ... ) : null` block (currently `form-field.tsx:52-72`) with:

```tsx
{
  help ? <InfoHint text={help} /> : null;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors (no unused-import or missing-symbol complaints).

- [ ] **Step 3: Run the full test suite (regression)**

Run: `pnpm test`
Expected: PASS — all existing builder/FormField tests stay green, proving the extraction is behaviour-preserving.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/form-field.tsx
git commit -m "refactor(ui): FormField consumes InfoHint (single source of truth)"
```

---

## Task 3: Add `helpText.monitoring` copy to `en.ts`

**Files:**

- Modify: `src/i18n/en.ts`

No test — this is static data consumed by later tasks. The type system (and `pnpm typecheck` in later tasks) verifies the keys exist.

- [ ] **Step 1: Insert the `monitoring` block**

In `src/i18n/en.ts`, inside `helpText`, immediately after the closing `},` of the `strategy:` block (currently ends at en.ts:289) and before the `}` that closes `helpText`, add:

```ts
    monitoring: {
      // Status & process
      state:
        'The bot’s live process state as last reported by the backend (running, stopped, error, …).',
      desiredStatus:
        'The state you asked for. The bot converges to this — a mismatch with State means it’s still transitioning.',
      process:
        'Whether the backend Freqtrade process is actually up. "down" while State is running means the process died.',
      lastHeartbeat:
        'Time since the bot last reported in. Stale heartbeats suggest the process is stuck or dead.',
      // Mode / config not covered by builder copy
      mode: 'Dry-run trades on a virtual wallet (no real funds). Live places real orders on the exchange.',
      tradingMode:
        'Spot trades the asset directly; Futures trades perpetual contracts with leverage.',
      // Backtest performance metrics
      netProfit:
        'Total profit/loss across all backtest trades, in stake currency. Negative = the strategy lost money.',
      trades:
        'Total number of trades the strategy opened and closed during the backtest window.',
      winRate:
        'Share of backtest trades that closed in profit. High win rate alone doesn’t guarantee net profit.',
      profitFactor:
        'Gross profit ÷ gross loss. Above 1 means winners outweigh losers; below 1 is a losing strategy.',
      sharpe:
        'Risk-adjusted return — return per unit of total volatility. Higher is better; below 0 is poor.',
      sortino:
        'Like Sharpe but only penalises downside volatility. Higher is better.',
      maxDrawdown:
        'Largest peak-to-trough drop in equity during the backtest. Lower is safer.',
      tradesPerDay:
        'Average number of trades opened per day over the backtest window.',
      // Hero KPIs
      openTrades:
        'Positions the bot holds right now, against its max-open-trades cap.',
      winRateBt:
        'Win rate from the selected backtest run — historical, not live performance.',
      netBt:
        'Net profit from the selected backtest run — historical, not live performance.',
    },
```

> **IMPORTANT:** every apostrophe above is a curly `’` (U+2019), not a straight `'`. These are single-quoted strings; a straight apostrophe would terminate the string and break the build. Matches house style at en.ts:266. The `process` string uses straight double-quotes `"down"` inside a single-quoted string, which is safe.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. (`strings` is `as const`; the new keys become typed members.)

- [ ] **Step 3: Commit**

```bash
git add src/i18n/en.ts
git commit -m "feat(i18n): add helpText.monitoring copy for bot-detail params"
```

---

## Task 4: `KV` gains `hint` + wire `StatusPanel`

**Files:**

- Modify: `src/features/bot-monitoring/detail/panel-kit.tsx`
- Modify: `src/features/bot-monitoring/detail/StatusPanel.tsx`

- [ ] **Step 1: Add `hint` to `KV`**

In `src/features/bot-monitoring/detail/panel-kit.tsx`, add the import at the top (after the existing `import type { ReactNode } from 'react';`):

```tsx
import { InfoHint } from '@/components/ui/info-hint';
```

Replace the entire `KV` function with:

```tsx
export function KV({
  k,
  v,
  accent,
  hint,
}: {
  k: string;
  v: string;
  accent?: 'bull' | 'bear';
  hint?: ReactNode;
}) {
  const cls =
    accent === 'bull'
      ? 'text-bullish'
      : accent === 'bear'
        ? 'text-bearish'
        : 'text-fg';
  return (
    <div className="flex items-center justify-between border-b border-border-subtle py-2 text-xs last:border-0">
      <span className="flex items-center gap-1 text-fg-secondary">
        {k}
        {hint ? <InfoHint text={hint} /> : null}
      </span>
      <span className={`font-mono font-semibold ${cls}`}>{v}</span>
    </div>
  );
}
```

- [ ] **Step 2: Wire `StatusPanel` hints**

In `src/features/bot-monitoring/detail/StatusPanel.tsx`, add the strings import after the existing imports:

```tsx
import { strings } from '@/i18n/en';
```

Add a local alias just inside the component body (right after `const running = ...`):

```tsx
const H = strings.helpText.monitoring;
```

Then add `hint` props to the State / Desired status / Process / Last heartbeat rows (leave the Error row as-is — self-evident):

```tsx
      <KV
        k="State"
        v={v(status?.status)}
        accent={running ? 'bull' : undefined}
        hint={H.state}
      />
      <KV k="Desired status" v={v(status?.desired_status)} hint={H.desiredStatus} />
      <KV
        k="Process"
        v={status?.is_process_running ? 'up' : 'down'}
        accent={status?.is_process_running ? 'bull' : undefined}
        hint={H.process}
      />
      <KV
        k="Last heartbeat"
        v={status?.last_heartbeat ? relTime(status.last_heartbeat) : '—'}
        hint={H.lastHeartbeat}
      />
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Run the test suite**

Run: `pnpm test`
Expected: PASS (no regressions).

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/detail/panel-kit.tsx src/features/bot-monitoring/detail/StatusPanel.tsx
git commit -m "feat(monitoring): help tooltips on Status panel + KV hint support"
```

---

## Task 5: Wire `ConfigPanel` hints

**Files:**

- Modify: `src/features/bot-monitoring/detail/ConfigPanel.tsx`

- [ ] **Step 1: Add a label→hint map and pass it to `KV`**

In `src/features/bot-monitoring/detail/ConfigPanel.tsx`, add the strings import after the existing `import { Panel, KV } from './panel-kit';`:

```tsx
import { strings } from '@/i18n/en';
```

Add this module-level constant just below the imports (above `type Cfg = ...`). It reuses the existing `botConfig` copy where available and the new `monitoring` copy otherwise; labels not present in the map (Exchange, Stake currency, Timeframe) simply get no icon:

```tsx
const HINTS: Record<string, string> = {
  'Stake amount': strings.helpText.botConfig.stakeAmount,
  'Max open trades': strings.helpText.botConfig.maxOpenTrades,
  'Trading mode': strings.helpText.monitoring.tradingMode,
  'Margin mode': strings.helpText.botConfig.marginMode,
  Mode: strings.helpText.monitoring.mode,
  Leverage: strings.helpText.botConfig.leverage,
  'Dry-run wallet': strings.helpText.botConfig.dryRunWallet,
};
```

Then change the row render (currently `rows.map((r) => <KV key={r.k} k={r.k} v={r.v} />)`) to:

```tsx
rows.map((r) => <KV key={r.k} k={r.k} v={r.v} hint={HINTS[r.k]} />);
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Run the test suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/bot-monitoring/detail/ConfigPanel.tsx
git commit -m "feat(monitoring): help tooltips on Configuration panel"
```

---

## Task 6: `Kpi` gains `hint` + wire `DetailHero`

**Files:**

- Modify: `src/features/bot-monitoring/detail/DetailHero.tsx`

- [ ] **Step 1: Add `hint` to the `Kpi` component**

In `src/features/bot-monitoring/detail/DetailHero.tsx`, ensure these imports exist at the top (add whichever is missing):

```tsx
import type { ReactNode } from 'react';
import { strings } from '@/i18n/en';
import { InfoHint } from '@/components/ui/info-hint';
```

Replace the `Kpi` function (currently `DetailHero.tsx:143-171`) with:

```tsx
function Kpi({
  label,
  value,
  unit,
  tone,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'bull' | 'bear';
  hint?: ReactNode;
}) {
  const cls =
    tone === 'bull'
      ? 'text-bullish'
      : tone === 'bear'
        ? 'text-bearish'
        : 'text-fg';
  return (
    <div>
      <div className="flex items-center gap-1 text-2xs uppercase tracking-widest text-fg-muted">
        {label}
        {hint ? <InfoHint text={hint} /> : null}
      </div>
      <div className={`mt-1 font-mono text-2xl font-bold tabular-nums ${cls}`}>
        {value}
        {unit && <span className="ml-1 text-sm text-fg-muted">{unit}</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the three backtest KPIs**

In the KPI grid (currently `DetailHero.tsx:108-138`), add `hint` props to the Open trades / Win rate (bt) / Net (bt) tiles (leave Balance as-is). The Open trades, Win rate, and Net tiles become:

```tsx
        <Kpi
          label="Open trades"
          value={`${bot.openTrades ?? '—'}`}
          unit={
            bot.openTrades != null && bot.maxOpenTrades != null
              ? `/ ${bot.maxOpenTrades}`
              : undefined
          }
          hint={strings.helpText.monitoring.openTrades}
        />
        <Kpi
          label="Win rate (bt)"
          value={bt?.winRate == null ? '—' : `${bt.winRate.toFixed(1)}%`}
          hint={strings.helpText.monitoring.winRateBt}
        />
        <Kpi
          label="Net (bt)"
          value={
            bt?.netAbs == null
              ? '—'
              : `${bt.netAbs >= 0 ? '+' : ''}${bt.netAbs.toFixed(2)}`
          }
          tone={
            bt?.netAbs == null ? undefined : bt.netAbs >= 0 ? 'bull' : 'bear'
          }
          hint={strings.helpText.monitoring.netBt}
        />
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. (If `ReactNode` was already imported, the duplicate import will fail typecheck — merge into the existing `react` import line instead.)

- [ ] **Step 4: Run the test suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/detail/DetailHero.tsx
git commit -m "feat(monitoring): help tooltips on hero backtest KPIs"
```

---

## Task 7: `PerformancePanel` metric-cell hints

**Files:**

- Modify: `src/features/bot-monitoring/detail/PerformancePanel.tsx`

- [ ] **Step 1: Add imports and extend the `cells` tuple**

In `src/features/bot-monitoring/detail/PerformancePanel.tsx`, add these imports after the existing imports at the top:

```tsx
import { strings } from '@/i18n/en';
import { InfoHint } from '@/components/ui/info-hint';
```

Replace the `cells` declaration (currently `PerformancePanel.tsx:52-65`) with the version below — the tuple gains an optional 4th element for the hint, and `'Trades'` is included:

```tsx
const H = strings.helpText.monitoring;
const cells: Array<[string, string, boolean?, string?]> = [
  ['Net profit', f(m.netAbs), (m.netAbs ?? 0) < 0, H.netProfit],
  ['Win rate', f(m.winRatePct, 1, '%'), false, H.winRate],
  ['Trades', String(m.trades ?? '—'), false, H.trades],
  [
    'Profit factor',
    f(m.profitFactor),
    (m.profitFactor ?? 1) < 1,
    H.profitFactor,
  ],
  ['Sharpe', f(m.sharpe), (m.sharpe ?? 0) < 0, H.sharpe],
  ['Sortino', f(m.sortino), (m.sortino ?? 0) < 0, H.sortino],
  [
    'Max drawdown',
    `${f(m.maxDrawdownAbs)} (${f(m.maxDrawdownPct, 1)}%)`,
    true,
    H.maxDrawdown,
  ],
  ['Trades/day', f(m.tradesPerDay), false, H.tradesPerDay],
];
```

> Note: the original had `'Trades'` as a cell already (`['Trades', String(m.trades ?? '—')]`). This keeps it and only adds the hint — no cell is added or removed; still 8 cells.

- [ ] **Step 2: Render the hint in each cell's label**

Replace the cell-render block (currently `PerformancePanel.tsx:118-130`) with:

```tsx
{
  cells.map(([l, v, neg, hint]) => (
    <div
      key={l}
      className="rounded-lg border border-border-subtle bg-black/20 p-3"
    >
      <div className="flex items-center gap-1 text-2xs text-fg-muted">
        {l}
        {hint ? <InfoHint text={hint} /> : null}
      </div>
      <div
        className={`mt-1 font-mono text-lg font-bold ${neg ? 'text-bearish' : 'text-fg'}`}
      >
        {v}
      </div>
    </div>
  ));
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Run the test suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-monitoring/detail/PerformancePanel.tsx
git commit -m "feat(monitoring): help tooltips on Performance metric cells"
```

---

## Task 8: Final full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full gate**

Run each and confirm clean output:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm format
```

Expected: typecheck no errors; lint no errors; test all green; format writes (commit any formatting changes).

- [ ] **Step 2: Commit any formatting changes**

```bash
git add -u src/
git commit -m "chore: prettier format bot-details param-notes" || echo "nothing to format"
```

> Use `git add -u src/` (scoped to `src/`), **never** `git add -A` — the working tree carries a local `vite.config.ts` proxy override that must not be committed.

- [ ] **Step 3: Manual check (Tri)**

Open a bot's detail screen in the running app. Hover each annotated field (Status: State / Desired status / Process / Last heartbeat; Config: Stake amount / Max open trades / Trading mode / Margin mode / Mode / Leverage / Dry-run wallet; Performance: all 8 metric cells; Hero: Open trades / Win rate (bt) / Net (bt)). Confirm:

- Each shows the correct copy.
- Tooltips don't clip at panel edges (especially right-edge KPIs and top-row cells — adjust `side` per-call if any clip).
- Obvious labels (Pair, Exchange, Timeframe, Balance, Error, Pills) have **no** icon.

---

## Self-Review

**Spec coverage:**

- Reusable `InfoHint` + `FormField` refactor → Tasks 1–2. ✓
- `KV` / `Kpi` / metric-cell `hint` threading → Tasks 4, 6, 7. ✓
- `helpText.monitoring` copy (curly apostrophes) → Task 3. ✓
- Field→copy mapping (21 fields, reuse `botConfig` for risk config) → Tasks 4–7 cover every mapping-table row. ✓
- Pills left un-annotated (resolved decision) → not wired anywhere. ✓
- Testing: new InfoHint unit test + regression suite → Tasks 1, 2, 8. ✓

**Type consistency:** `hint?: ReactNode` prop name is identical across `InfoHint` (prop `text`), `KV`, `Kpi`, and the cell tuple. `strings.helpText.monitoring.*` keys referenced in Tasks 4–7 all exist in the Task 3 block (state, desiredStatus, process, lastHeartbeat, mode, tradingMode, netProfit, trades, winRate, profitFactor, sharpe, sortino, maxDrawdown, tradesPerDay, openTrades, winRateBt, netBt). `botConfig.*` reused keys (stakeAmount, maxOpenTrades, marginMode, leverage, dryRunWallet) all exist today (en.ts:259-274). ✓

**Placeholder scan:** no TBD/TODO; every code step shows complete code. ✓
