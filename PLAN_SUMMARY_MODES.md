# Summary Modes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply Variation **B (Hero Stack — visual)** and Variation **C (Narrative — prose)** from `public/board-redesign.html` to the live phase cards, with a header toggle so users can switch modes at any time. Default: `visual`.

**Architecture (verified against current code, 2026-05-13):**

The canvas already renders **2 phase cards**, not 4 step cards — this matches the mockup 1:1:

- **Phase 1** — rendered by `StepCard` (`src/features/bot-builder/components/StepCard.tsx`) with `stepId='bot-config'`. Body renders `<StepCardSummary stepId='bot-config' />` which dispatches to `BotConfigSummary`.
- **Phase 2** — rendered by `StrategyCard` (`src/features/bot-builder/components/StrategyCard.tsx`) as a composite. Body stacks 3 sub-summaries vertically: `<StepCardSummary stepId='entry-strategy' />`, `direction`, `close-method`.

Both cards already exist and are wired through `BotBuilderCanvas.tsx`. We do **NOT** restructure the canvas — we only refactor what's rendered **inside** the cards.

**Tech approach:**
- Add `summaryMode: 'visual' | 'narrative'` to `layout-prefs.store` (Zustand + persist), with version-2 migration so existing users default to `'visual'`.
- Add 1 icon-toggle button in `HeaderToolbar` next to the existing Eye visibility toggle (same UX pattern).
- `BotConfigSummary` gets **both modes inline** (it's rendered directly in Phase 1).
- Phase 2 narrative is **composite** — not 3 disjoint sentences. New `StrategyNarrativeSummary.tsx` reads from all 3 stores and emits ONE prose paragraph. `StrategyCard` switches between "render 3 sub-summaries" (visual mode) and "render composite narrative" (narrative mode).
- Phase 2 sub-summaries (`EntryStrategySummary` / `DirectionSummary` / `CloseMethodSummary`) only need their **visual** layout updated to mockup B style (hero rule code-block, action-row, TP/SL grid). No narrative branch in those 3 files.

**Confirmed decisions (asked & answered, 2026-05-13):**
1. **Scope** — only the 2 phase cards on the canvas (Phase 1 = Bot Basics, Phase 2 = Strategy composite). Architecture already matches the mockup.
2. **Visual mode REPLACES the current chip-row UI** — no 3-way "old/B/C" toggle. (User picked 2A.)
3. **Narrative mode for Phase 2 = ONE composite paragraph** via new `StrategyNarrativeSummary`, not 3 stacked sentences. (User picked 3B.)
4. Default mode: `visual`. Persisted via `layout-prefs.store`.

**Tech Stack:** React 18, TypeScript 5.7, Zustand 5 (with `persist`), Tailwind CSS 3, Lucide icons, Vitest + @testing-library/react.

**Reference mockup:** `public/board-redesign.html` — columns labeled "Variation B" (Hero Stack) and "Variation C" (Narrative).

---

## File Structure

**Create:**
- `src/features/layout-prefs/__tests__/layout-prefs.store.test.ts` — store unit tests (didn't exist before)
- `src/features/bot-builder/components/__tests__/HeaderToolbar.summary-mode.test.tsx` — toggle button render test
- `src/features/bot-builder/components/summaries/StrategyNarrativeSummary.tsx` — **NEW** composite narrative for Phase 2
- `src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx` — render tests for all summary components

**Modify:**
- `src/features/layout-prefs/layout-prefs.store.ts` — add `summaryMode`, action, version bump
- `src/features/bot-builder/components/HeaderToolbar.tsx` — add toggle button next to Eye toggle
- `src/i18n/en.ts` — add `layoutToggles.summaryMode*` strings + `strings.narrative.*` for composite paragraph
- `src/features/bot-builder/components/summaries/BotConfigSummary.tsx` — dual mode (visual + narrative branch inline)
- `src/features/bot-builder/components/summaries/EntryStrategySummary.tsx` — VISUAL ONLY update (mockup B rule code-block style)
- `src/features/bot-builder/components/summaries/DirectionSummary.tsx` — VISUAL ONLY update (action-row style)
- `src/features/bot-builder/components/summaries/CloseMethodSummary.tsx` — VISUAL ONLY update (TP/SL 2-cell grid style)
- `src/features/bot-builder/components/StrategyCard.tsx` — mode switch: render `<StrategyNarrativeSummary />` when narrative, else stack 3 sub-summaries (unchanged behaviour)

**Untouched:**
- `src/features/bot-builder/components/summaries/StepCardSummary.tsx` — dispatcher stays
- `src/features/bot-builder/components/summaries/shared/*` — `ReadOnlyChip`, `TokenIcon`, `ConditionPreview` reused
- `src/features/bot-builder/BotBuilderCanvas.tsx` — canvas layout unchanged

---

## Task 1: Extend `layout-prefs.store` with `summaryMode`

**Files:**
- Create: `src/features/layout-prefs/__tests__/layout-prefs.store.test.ts`
- Modify: `src/features/layout-prefs/layout-prefs.store.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/layout-prefs/__tests__/layout-prefs.store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useLayoutPrefsStore } from '../layout-prefs.store';

describe('layout-prefs.store · summaryMode', () => {
  beforeEach(() => {
    useLayoutPrefsStore.setState({
      leftPanelCollapsed: false,
      botSummaryHidden: false,
      summaryMode: 'visual',
    });
  });

  it('defaults summaryMode to "visual"', () => {
    expect(useLayoutPrefsStore.getState().summaryMode).toBe('visual');
  });

  it('toggleSummaryMode flips visual → narrative → visual', () => {
    const { toggleSummaryMode } = useLayoutPrefsStore.getState();
    toggleSummaryMode();
    expect(useLayoutPrefsStore.getState().summaryMode).toBe('narrative');
    toggleSummaryMode();
    expect(useLayoutPrefsStore.getState().summaryMode).toBe('visual');
  });

  it('setSummaryMode sets explicit value', () => {
    useLayoutPrefsStore.getState().setSummaryMode('narrative');
    expect(useLayoutPrefsStore.getState().summaryMode).toBe('narrative');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test -- src/features/layout-prefs/__tests__/layout-prefs.store.test.ts
```

Expected: 3 failures — `summaryMode is not defined`, `toggleSummaryMode is not a function`, etc.

- [ ] **Step 3: Implement `summaryMode`**

Replace the entire contents of `src/features/layout-prefs/layout-prefs.store.ts`:

```ts
/**
 * Persisted UI preferences that don't belong in the builder data model
 * but the user expects to survive a reload — current set:
 *   - leftPanelCollapsed: hide the Cypheus chat panel for more canvas room.
 *   - botSummaryHidden:   dismiss the "What this bot does" widget.
 *   - summaryMode:        toggle between hero-stack (visual) and prose
 *                         (narrative) rendering of the phase-card summaries.
 *                         Default 'visual'. See PLAN_SUMMARY_MODES.md.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SummaryMode = 'visual' | 'narrative';

interface LayoutPrefsStore {
  leftPanelCollapsed: boolean;
  botSummaryHidden: boolean;
  summaryMode: SummaryMode;
  toggleLeftPanel: () => void;
  setLeftPanelCollapsed: (v: boolean) => void;
  toggleBotSummary: () => void;
  setBotSummaryHidden: (v: boolean) => void;
  toggleSummaryMode: () => void;
  setSummaryMode: (m: SummaryMode) => void;
}

export const useLayoutPrefsStore = create<LayoutPrefsStore>()(
  persist(
    (set) => ({
      leftPanelCollapsed: false,
      botSummaryHidden: false,
      summaryMode: 'visual',
      toggleLeftPanel: () =>
        set((s) => ({ leftPanelCollapsed: !s.leftPanelCollapsed })),
      setLeftPanelCollapsed: (v) => set({ leftPanelCollapsed: v }),
      toggleBotSummary: () =>
        set((s) => ({ botSummaryHidden: !s.botSummaryHidden })),
      setBotSummaryHidden: (v) => set({ botSummaryHidden: v }),
      toggleSummaryMode: () =>
        set((s) => ({
          summaryMode: s.summaryMode === 'visual' ? 'narrative' : 'visual',
        })),
      setSummaryMode: (m) => set({ summaryMode: m }),
    }),
    {
      name: 'layout-prefs',
      version: 2,
      // v1 → v2: introduce summaryMode (default 'visual').
      migrate: (persisted: unknown, _version) => {
        const state = (persisted as Partial<LayoutPrefsStore>) ?? {};
        return { ...state, summaryMode: state.summaryMode ?? 'visual' };
      },
    },
  ),
);
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm test -- src/features/layout-prefs/__tests__/layout-prefs.store.test.ts
```

Expected: 3 passes.

- [ ] **Step 5: Commit**

```bash
git add src/features/layout-prefs/layout-prefs.store.ts src/features/layout-prefs/__tests__/layout-prefs.store.test.ts
git commit -m "feat(layout-prefs): add summaryMode toggle (visual | narrative)

Persists in localStorage with version bump + migration so existing
users default to 'visual' on first load post-upgrade.

PR-SM1"
```

---

## Task 2: Add i18n strings for the mode toggle

**Files:**
- Modify: `src/i18n/en.ts`

- [ ] **Step 1: Locate `layoutToggles` block**

```bash
grep -n "layoutToggles" src/i18n/en.ts
```

- [ ] **Step 2: Add the new keys inside `layoutToggles`**

Add the following keys to the `layoutToggles` object (preserve existing keys):

```ts
  summaryModeVisualAria: 'Switch to narrative summary',
  summaryModeNarrativeAria: 'Switch to visual summary',
  summaryModeVisualTooltip: 'Plain English (sentence form)',
  summaryModeNarrativeTooltip: 'Compact visual (chips & data)',
```

The `Aria` string describes what the click **does** (read aloud at click moment), `Tooltip` describes the state the click leads to. Same convention as existing `summaryShow*` / `summaryHide*`.

- [ ] **Step 3: Verify with typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/en.ts
git commit -m "i18n: add summary-mode toggle labels

PR-SM2"
```

---

## Task 3: Add the toggle button in `HeaderToolbar`

**Files:**
- Create: `src/features/bot-builder/components/__tests__/HeaderToolbar.summary-mode.test.tsx`
- Modify: `src/features/bot-builder/components/HeaderToolbar.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/bot-builder/components/__tests__/HeaderToolbar.summary-mode.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HeaderToolbar } from '../HeaderToolbar';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';

function renderToolbar() {
  return render(
    <MemoryRouter>
      <HeaderToolbar />
    </MemoryRouter>,
  );
}

describe('HeaderToolbar · summary mode toggle', () => {
  beforeEach(() => {
    useLayoutPrefsStore.setState({ summaryMode: 'visual' });
  });

  it('renders a button to switch to narrative mode when in visual mode', () => {
    renderToolbar();
    expect(
      screen.getByRole('button', { name: /switch to narrative summary/i }),
    ).toBeInTheDocument();
  });

  it('clicking the toggle flips the persisted mode', async () => {
    const user = userEvent.setup();
    renderToolbar();
    const btn = screen.getByRole('button', { name: /switch to narrative summary/i });
    await user.click(btn);
    expect(useLayoutPrefsStore.getState().summaryMode).toBe('narrative');
    expect(
      screen.getByRole('button', { name: /switch to visual summary/i }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test -- src/features/bot-builder/components/__tests__/HeaderToolbar.summary-mode.test.tsx
```

Expected: failure — "Unable to find role 'button' with name 'Switch to narrative summary'".

- [ ] **Step 3: Add the button + imports**

In `src/features/bot-builder/components/HeaderToolbar.tsx`, extend the Lucide import block with `AlignLeft` and `Layers`:

```ts
import {
  AlignLeft,
  BookOpen,
  Download,
  Eye,
  EyeOff,
  FlaskConical,
  Layers,
  List,
  LogOut,
  Pencil,
  Upload,
  User,
} from 'lucide-react';
```

In the component body, alongside `botSummaryHidden` / `toggleBotSummary`, read the new store slice:

```ts
const summaryMode = useLayoutPrefsStore((s) => s.summaryMode);
const toggleSummaryMode = useLayoutPrefsStore((s) => s.toggleSummaryMode);
```

Find the existing `<Tooltip>` block that wraps the `botSummaryHidden` Eye/EyeOff button (around line 174). Immediately AFTER that closing `</Tooltip>` and BEFORE the visual divider `<span ... mx-1 h-5 w-px ... />`, insert:

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleSummaryMode}
      className="rounded-full"
      aria-label={
        summaryMode === 'visual'
          ? strings.layoutToggles.summaryModeVisualAria
          : strings.layoutToggles.summaryModeNarrativeAria
      }
      aria-pressed={summaryMode === 'narrative'}
    >
      {summaryMode === 'visual' ? (
        <Layers className="h-3.5 w-3.5" />
      ) : (
        <AlignLeft className="h-3.5 w-3.5" />
      )}
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    {summaryMode === 'visual'
      ? strings.layoutToggles.summaryModeVisualTooltip
      : strings.layoutToggles.summaryModeNarrativeTooltip}
  </TooltipContent>
</Tooltip>
```

Icon mapping rationale: `Layers` = stacked data / visual (current = visual), `AlignLeft` = paragraph / prose (current = narrative). Icon shows CURRENT mode; click switches.

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm test -- src/features/bot-builder/components/__tests__/HeaderToolbar.summary-mode.test.tsx
```

Expected: 2 passes.

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-builder/components/HeaderToolbar.tsx src/features/bot-builder/components/__tests__/HeaderToolbar.summary-mode.test.tsx
git commit -m "feat(header): add summary-mode toggle button

PR-SM3"
```

---

## Task 4: `BotConfigSummary` — dual mode (Phase 1 card)

**Files:**
- Create: `src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx`
- Modify: `src/features/bot-builder/components/summaries/BotConfigSummary.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';
import { BotConfigSummary } from '../BotConfigSummary';

function seedBotConfig() {
  useBuilderStore.setState((s) => ({
    ...s,
    botConfig: {
      ...s.botConfig,
      pair: 'BTC-USDC',
      timeframe: '1h',
      leverage: 1,
      tradingMode: 'dry-run',
      stakeAmount: 100,
      stakeCurrency: 'USDT',
    },
  }));
}

describe('BotConfigSummary · visual mode', () => {
  beforeEach(() => {
    seedBotConfig();
    useLayoutPrefsStore.setState({ summaryMode: 'visual' });
  });

  it('renders BTC-USDC as a hero headline + inline stats', () => {
    render(<BotConfigSummary />);
    expect(screen.getByText('BTC-USDC')).toBeInTheDocument();
    expect(screen.getByText(/1h/i)).toBeInTheDocument();
    expect(screen.getByText(/1×/)).toBeInTheDocument();
    expect(screen.getByText(/\$100/)).toBeInTheDocument();
    expect(screen.getByText(/dry-run/i)).toBeInTheDocument();
  });
});

describe('BotConfigSummary · narrative mode', () => {
  beforeEach(() => {
    seedBotConfig();
    useLayoutPrefsStore.setState({ summaryMode: 'narrative' });
  });

  it('renders a prose sentence containing pair + tf + lev + mode + stake', () => {
    const { container } = render(<BotConfigSummary />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/BTC-USDC/);
    expect(text).toMatch(/1h/);
    expect(text).toMatch(/1×/);
    expect(text).toMatch(/Dry-run/i);
    expect(text).toMatch(/\$100/);
    expect(text.toLowerCase()).toMatch(/trade|with|on/);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm test -- src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx
```

Expected: narrative test fails (no prose yet); visual test may partially pass with old chip-row but new structure is different so likely fails.

- [ ] **Step 3: Replace `BotConfigSummary.tsx`**

Full replacement:

```tsx
import { AlertTriangle } from 'lucide-react';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';
import { ReadOnlyChip } from './shared/ReadOnlyChip';
import { TokenIcon } from './shared/TokenIcon';
import { parseUiPair } from '@/lib/pair-format';

const HIGH_LEVERAGE_THRESHOLD = 10;

export function BotConfigSummary() {
  const botConfig = useBuilderStore((s) => s.botConfig);
  const mode = useLayoutPrefsStore((s) => s.summaryMode);
  const { pair, timeframe, leverage, tradingMode, stakeAmount, stakeCurrency } =
    botConfig;

  if (!pair) {
    return (
      <span className="text-xs italic text-fg-muted">No bot config yet</span>
    );
  }

  const parts = parseUiPair(pair);
  const baseSymbol = parts?.base ?? pair;
  const isHighLev = leverage > HIGH_LEVERAGE_THRESHOLD;
  const isLive = tradingMode === 'live';
  const formattedStake = `${stakeAmount.toLocaleString()} ${stakeCurrency}`;

  if (mode === 'narrative') {
    return (
      <p className="text-sm leading-relaxed text-fg-secondary">
        Trade{' '}
        <span className="inline-flex items-center gap-1 align-baseline">
          <TokenIcon symbol={baseSymbol} />
          <span className="font-semibold text-fg">{pair}</span>
        </span>{' '}
        on <span className="font-mono font-medium text-fg">{timeframe}</span>{' '}
        candles with{' '}
        <span
          className={
            isHighLev
              ? 'font-mono font-medium text-brand'
              : 'font-mono font-medium text-fg'
          }
        >
          {leverage}×
        </span>{' '}
        leverage in{' '}
        <span
          className={isLive ? 'font-medium text-bearish' : 'font-medium text-bullish'}
        >
          {isLive ? 'Live' : 'Dry-run'}
        </span>{' '}
        mode · stake{' '}
        <span className="font-mono font-medium text-fg">{formattedStake}</span>{' '}
        per position.
      </p>
    );
  }

  // Visual mode — hero stack (mockup B).
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-md font-bold text-fg">
          <TokenIcon symbol={baseSymbol} />
          <span className="truncate">{pair}</span>
        </span>
        <ReadOnlyChip
          tone={isLive ? 'bearish' : 'bullish'}
          title={isLive ? 'Live trading — real money' : 'Dry-run — paper trading'}
        >
          {isLive ? 'Live' : 'Dry-run'}
        </ReadOnlyChip>
      </div>
      <div className="flex items-center gap-3 rounded-md border border-border-subtle bg-black/30 px-3 py-2">
        <Stat label="Timeframe" value={timeframe} />
        <Divider />
        <Stat
          label="Leverage"
          value={`${leverage}×`}
          warn={isHighLev}
          warnIcon={isHighLev}
        />
        <Divider />
        <Stat
          label="Stake / pos"
          value={`$${stakeAmount.toLocaleString()}`}
          unit={stakeCurrency}
        />
      </div>
    </div>
  );
}

function Stat({
  label, value, unit, warn, warnIcon,
}: {
  label: string;
  value: string;
  unit?: string;
  warn?: boolean;
  warnIcon?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span
        className={
          warn
            ? 'flex items-center gap-1 font-mono text-sm font-semibold text-brand'
            : 'font-mono text-sm font-semibold text-fg'
        }
      >
        {warnIcon ? <AlertTriangle className="h-3 w-3" aria-hidden="true" /> : null}
        {value}
        {unit ? <span className="ml-1 text-xs font-medium text-fg-muted">{unit}</span> : null}
      </span>
      <span className="text-2xs font-semibold uppercase tracking-wide text-fg-muted">
        {label}
      </span>
    </div>
  );
}

function Divider() {
  return <span aria-hidden="true" className="h-6 w-px bg-border-default" />;
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm test -- src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx
```

Expected: 2 passes.

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-builder/components/summaries/BotConfigSummary.tsx src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx
git commit -m "feat(summary): BotConfigSummary dual-mode (hero stack + prose)

PR-SM4"
```

---

## Task 5: `EntryStrategySummary` — visual update only (mockup B)

**Files:**
- Modify: `src/features/bot-builder/components/summaries/EntryStrategySummary.tsx`
- Modify: `src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx`

Note: this summary is rendered inside `StrategyCard` (Phase 2 composite). When `summaryMode === 'narrative'`, `StrategyCard` will render `<StrategyNarrativeSummary />` instead (added in Task 8) — so we don't need a narrative branch here. Only the **visual** layout needs upgrading to the mockup-B "rule code-block" hero style.

- [ ] **Step 1: Append tests to `summary-modes.test.tsx`**

Append below existing BotConfigSummary tests:

```tsx
import { EntryStrategySummary } from '../EntryStrategySummary';

function seedEntryStrategy() {
  useBuilderStore.setState((s) => ({
    ...s,
    strategy: {
      ...s.strategy,
      candlestick: ['close'],
      indicators: [
        // Minimal valid Indicator shape — adjust if builder.types.ts requires more.
        { id: 'rsi-1', name: 'RSI', period: 14 } as never,
      ],
      entryConditions: {
        ...s.strategy.entryConditions,
        conditions: [
          {
            id: 'cond-1',
            left: { kind: 'indicator', id: 'RSI-14' },
            op: '<',
            right: { kind: 'value', value: 40 },
          } as never,
        ],
        logic: { type: 'AND' },
      },
    },
  }));
}

describe('EntryStrategySummary · visual mode (mockup B)', () => {
  beforeEach(() => {
    seedEntryStrategy();
    useLayoutPrefsStore.setState({ summaryMode: 'visual' });
  });

  it('renders the rule expression in a code-styled block', () => {
    const { container } = render(<EntryStrategySummary />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/RSI-14/);
    expect(text).toMatch(/<\s*40/);
  });

  it('shows the Close candle channel as selected', () => {
    render(<EntryStrategySummary />);
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('shows indicator pill', () => {
    const { container } = render(<EntryStrategySummary />);
    expect(container.textContent ?? '').toMatch(/RSI-14/);
  });
});
```

> **Note:** `as never` casts are test-time shortcuts. If `builder.store.setState` rejects them at runtime (zod validation, etc.), import real types from `src/types/builder.types.ts` and tighten.

- [ ] **Step 2: Run to verify they fail (current layout is chip-row, not code-block)**

```bash
pnpm test -- src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx
```

Expected: 1 or 2 of the 3 visual-mode tests pass with the legacy chip-row UI (text content overlaps); but the "code-styled block" expectation drives a structural change. After Step 3 all 3 should pass cleanly.

- [ ] **Step 3: Replace `EntryStrategySummary.tsx`**

```tsx
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { indicatorOutputId } from '@/features/indicators/indicator-registry';
import { ReadOnlyChip } from './shared/ReadOnlyChip';
import { ConditionPreview } from './shared/ConditionPreview';
import { cn } from '@/lib/utils';
import type { Candlestick } from '@/types/builder.types';

const CANDLE_CHANNELS: { key: Candlestick; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'close', label: 'Close' },
  { key: 'high', label: 'High' },
  { key: 'low', label: 'Low' },
  { key: 'volume', label: 'Volume' },
];

const MAX_INLINE_CONDITIONS = 2;

export function EntryStrategySummary() {
  const strategy = useBuilderStore((s) => s.strategy);
  const { candlestick, indicators, entryConditions } = strategy;
  const conditions = entryConditions.conditions;

  const isEmpty =
    candlestick.length === 0 && indicators.length === 0 && conditions.length === 0;
  if (isEmpty) {
    return <span className="text-xs italic text-fg-muted">No entry rules yet</span>;
  }

  const inlineConditions = conditions.slice(0, MAX_INLINE_CONDITIONS);
  const moreCount = conditions.length - inlineConditions.length;

  return (
    <div className="flex flex-col gap-2">
      {/* Rule code block — hero of the strategy card (mockup B) */}
      {conditions.length > 0 ? (
        <div className="rounded-md border border-border-subtle border-l-2 border-l-brand bg-black/30 px-3 py-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-2xs uppercase tracking-wide text-fg-muted">
              Entry rule
            </span>
            <span className="text-2xs text-fg-muted">
              {conditions.length} condition{conditions.length === 1 ? '' : 's'}
              {entryConditions.logic.type === 'OR' ? ' · OR' : ''}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 font-mono text-sm text-fg">
            {inlineConditions.map((row, idx) => (
              <ConditionPreview key={row.id} row={row} showOperator={idx > 0} />
            ))}
            {moreCount > 0 ? (
              <span className="text-2xs text-fg-muted">+ {moreCount} more</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Candle channel chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-2xs uppercase tracking-wide text-fg-muted">Candle</span>
        {CANDLE_CHANNELS.map(({ key, label }) => {
          const on = candlestick.includes(key);
          return (
            <span
              key={key}
              title={`${label} channel ${on ? 'enabled' : 'disabled'}`}
              className={cn(
                'inline-flex h-5 items-center rounded-full border px-1.5 text-2xs font-medium leading-none pointer-events-none select-none',
                on
                  ? 'border-brand/40 bg-brand-subtle text-fg'
                  : 'border-border bg-canvas text-fg-disabled opacity-60',
              )}
            >
              {label}
            </span>
          );
        })}
      </div>

      {/* Indicator pills */}
      {indicators.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-2xs uppercase tracking-wide text-fg-muted">
            Indicators
          </span>
          {indicators.map((ind) => (
            <ReadOnlyChip key={ind.id} tone="brand" title={`${ind.name} • ${indicatorOutputId(ind)}`}>
              {indicatorOutputId(ind)}
            </ReadOnlyChip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
pnpm test -- src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx
```

Expected: all 5 tests so far pass (BotConfig × 2 + Entry × 3).

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-builder/components/summaries/EntryStrategySummary.tsx src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx
git commit -m "feat(summary): EntryStrategySummary visual update — rule code block hero

Rule expression now sits in a brand-bordered code block as the visual
focal point. Candle chips and indicator pills follow below.
Narrative mode is handled by StrategyNarrativeSummary at the card level.

PR-SM5"
```

---

## Task 6: `DirectionSummary` — visual update only (mockup B)

**Files:**
- Modify: `src/features/bot-builder/components/summaries/DirectionSummary.tsx`
- Modify: `src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx`

- [ ] **Step 1: Append tests**

```tsx
import { DirectionSummary } from '../DirectionSummary';

function seedDirection() {
  useBuilderStore.setState((s) => ({
    ...s,
    directionForm: {
      ...s.directionForm,
      direction: 'long',
      orderType: 'market',
      limitOffsetPct: null,
    },
  }));
}

describe('DirectionSummary · visual mode (mockup B)', () => {
  beforeEach(() => {
    seedDirection();
    useLayoutPrefsStore.setState({ summaryMode: 'visual' });
  });

  it('shows a Long pill and a Market pill connected by an arrow', () => {
    render(<DirectionSummary />);
    expect(screen.getByText('Long')).toBeInTheDocument();
    expect(screen.getByText('Market')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify** (likely passes with existing impl)

```bash
pnpm test -- src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx
```

- [ ] **Step 3: Replace `DirectionSummary.tsx`**

```tsx
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { ReadOnlyChip } from './shared/ReadOnlyChip';

export function DirectionSummary() {
  const directionForm = useBuilderStore((s) => s.directionForm);
  const { direction, orderType, limitOffsetPct } = directionForm;

  const isLong = direction === 'long';
  const isLimit = orderType === 'limit';

  const orderLabel = isLimit
    ? `Limit${limitOffsetPct !== null && limitOffsetPct !== undefined ? ` ${limitOffsetPct > 0 ? '+' : ''}${limitOffsetPct}%` : ''}`
    : 'Market';

  // Visual mode — bullish/bearish pill + arrow + order-type pill (mockup B action row).
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ReadOnlyChip
        tone={isLong ? 'bullish' : 'bearish'}
        icon={
          isLong ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )
        }
      >
        {isLong ? 'Long' : 'Short'}
      </ReadOnlyChip>
      <ArrowRight className="h-3 w-3 text-fg-muted" aria-hidden="true" />
      <ReadOnlyChip tone="neutral" title={`Order type: ${orderLabel}`}>
        {orderLabel}
      </ReadOnlyChip>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm test -- src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-builder/components/summaries/DirectionSummary.tsx src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx
git commit -m "feat(summary): DirectionSummary action-row style (mockup B)

Bullish/bearish pill + arrow + order-type pill — flows like a mini action.
Narrative handled by StrategyNarrativeSummary.

PR-SM6"
```

---

## Task 7: `CloseMethodSummary` — visual update only (mockup B)

**Files:**
- Modify: `src/features/bot-builder/components/summaries/CloseMethodSummary.tsx`
- Modify: `src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx`

- [ ] **Step 1: Append tests**

```tsx
import { CloseMethodSummary } from '../CloseMethodSummary';

function seedTpSl() {
  useBuilderStore.setState((s) => ({
    ...s,
    closeMethod: {
      ...s.closeMethod,
      type: 'tp_sl',
      tpEnabled: true,
      tpLevels: [{ profit: 1.5, amount: 100 }],
      slEnabled: true,
      slValue: -10,
      trailingEnabled: false,
    },
  }));
}

describe('CloseMethodSummary · visual mode (mockup B)', () => {
  beforeEach(() => {
    seedTpSl();
    useLayoutPrefsStore.setState({ summaryMode: 'visual' });
  });

  it('renders TP and SL as a 2-cell grid with values', () => {
    const { container } = render(<CloseMethodSummary />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/take profit/i);
    expect(text).toMatch(/stop loss/i);
    expect(text).toMatch(/\+?1\.5%/);
    expect(text).toMatch(/-?−?10%/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test -- src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx
```

Expected: the "Take profit" / "Stop loss" full-word labels are absent from current chip-row impl.

- [ ] **Step 3: Replace `CloseMethodSummary.tsx`**

```tsx
import {
  Hand, Target, LineChart, Clock, AlertTriangle, type LucideIcon,
} from 'lucide-react';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { ReadOnlyChip } from './shared/ReadOnlyChip';
import { ConditionPreview } from './shared/ConditionPreview';
import type { CloseMethodType } from '@/types/builder.types';

const METHOD_META: Record<
  CloseMethodType,
  { label: string; icon: LucideIcon }
> = {
  manual: { label: 'Manual', icon: Hand },
  tp_sl: { label: 'TP / SL', icon: Target },
  indicator: { label: 'Indicator exit', icon: LineChart },
  roi: { label: 'ROI table', icon: Clock },
};

export function CloseMethodSummary() {
  const closeMethod = useBuilderStore((s) => s.closeMethod);
  const {
    type, tpEnabled, tpLevels, slEnabled, slValue, trailingEnabled,
    roiSteps, exitConditions,
  } = closeMethod;

  const meta = METHOD_META[type];
  const Icon = meta.icon;
  const totalTpAmount = tpLevels.reduce((sum, l) => sum + (l.amount ?? 0), 0);
  const tpOver100 = totalTpAmount > 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ReadOnlyChip
          tone="brand"
          icon={<Icon className="h-3 w-3" />}
          title={`Close method: ${meta.label}`}
        >
          {meta.label}
        </ReadOnlyChip>
        {type === 'manual' ? (
          <span className="text-xs text-fg-muted">Close trades by hand</span>
        ) : null}
        {type === 'tp_sl' && trailingEnabled ? (
          <ReadOnlyChip tone="info">Trailing</ReadOnlyChip>
        ) : null}
        {type === 'roi' ? (
          <ReadOnlyChip tone="neutral">
            {roiSteps.length} step{roiSteps.length === 1 ? '' : 's'}
          </ReadOnlyChip>
        ) : null}
        {type === 'indicator' ? (
          <ReadOnlyChip tone="neutral">
            {exitConditions.conditions.length} rule
            {exitConditions.conditions.length === 1 ? '' : 's'}
          </ReadOnlyChip>
        ) : null}
      </div>

      {/* TP/SL 2-cell grid — hero exit visualization (mockup B) */}
      {type === 'tp_sl' ? (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border-subtle bg-border-subtle">
          <div className="flex flex-col gap-0.5 bg-black/30 px-3 py-2">
            <span className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-bullish">
              Take profit
              {tpOver100 ? <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" /> : null}
            </span>
            <span className="font-mono text-sm font-semibold text-fg">
              {tpEnabled && tpLevels[0] ? `+${tpLevels[0].profit}%` : 'off'}
            </span>
            {tpEnabled && tpLevels.length > 0 ? (
              <span className="text-2xs text-fg-muted">
                {tpLevels.length} level{tpLevels.length === 1 ? '' : 's'} ·{' '}
                {totalTpAmount}% total
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-0.5 bg-black/30 px-3 py-2">
            <span className="text-2xs font-semibold uppercase tracking-wide text-bearish">
              Stop loss
            </span>
            <span className="font-mono text-sm font-semibold text-fg">
              {slEnabled ? `${slValue}%` : 'off'}
            </span>
            <span className="text-2xs text-fg-muted">
              {slEnabled ? (trailingEnabled ? 'trailing' : 'hard stop') : 'disabled'}
            </span>
          </div>
        </div>
      ) : null}

      {/* ROI preview */}
      {type === 'roi' && roiSteps.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 pl-1">
          <span className="text-2xs uppercase tracking-wide text-fg-muted">Schedule</span>
          {roiSteps.slice(0, 3).map((step, idx) => (
            <span
              key={idx}
              title={`${step.minutes}min @ ${step.roi}%`}
              className="font-mono text-2xs tabular-nums text-fg-secondary"
            >
              {step.minutes}m@{step.roi}%
            </span>
          ))}
          {roiSteps.length > 3 ? (
            <span className="text-2xs text-fg-muted">+{roiSteps.length - 3} more</span>
          ) : null}
        </div>
      ) : null}

      {/* Indicator exit preview */}
      {type === 'indicator' && exitConditions.conditions.length > 0 ? (
        <div className="pl-1">
          <ConditionPreview row={exitConditions.conditions[0]} />
          {exitConditions.conditions.length > 1 ? (
            <span className="ml-2 text-2xs text-fg-muted">
              + {exitConditions.conditions.length - 1} more
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify they pass**

```bash
pnpm test -- src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/features/bot-builder/components/summaries/CloseMethodSummary.tsx src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx
git commit -m "feat(summary): CloseMethodSummary TP/SL grid (mockup B)

Method chip + 2-cell TP / SL grid with bullish/bearish coloring.
Narrative handled by StrategyNarrativeSummary.

PR-SM7"
```

---

## Task 8: NEW `StrategyNarrativeSummary` + `StrategyCard` mode switch

**Files:**
- Create: `src/features/bot-builder/components/summaries/StrategyNarrativeSummary.tsx`
- Modify: `src/features/bot-builder/components/StrategyCard.tsx`
- Modify: `src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx`

This is the **composite narrative** for Phase 2 — one prose paragraph that reads naturally instead of 3 disjoint sentences.

- [ ] **Step 1: Write the failing test**

Append to `summary-modes.test.tsx`:

```tsx
import { StrategyNarrativeSummary } from '../StrategyNarrativeSummary';

function seedFullStrategy() {
  // Bot config supplies timeframe; strategy supplies rules; direction
  // supplies side+order; closeMethod supplies TP/SL.
  useBuilderStore.setState((s) => ({
    ...s,
    botConfig: { ...s.botConfig, pair: 'BTC-USDC', timeframe: '1h' },
    strategy: {
      ...s.strategy,
      candlestick: ['close'],
      indicators: [{ id: 'rsi-1', name: 'RSI', period: 14 } as never],
      entryConditions: {
        ...s.strategy.entryConditions,
        conditions: [
          {
            id: 'cond-1',
            left: { kind: 'indicator', id: 'RSI-14' },
            op: '<',
            right: { kind: 'value', value: 40 },
          } as never,
        ],
        logic: { type: 'AND' },
      },
    },
    directionForm: {
      ...s.directionForm,
      direction: 'long',
      orderType: 'market',
      limitOffsetPct: null,
    },
    closeMethod: {
      ...s.closeMethod,
      type: 'tp_sl',
      tpEnabled: true,
      tpLevels: [{ profit: 1.5, amount: 100 }],
      slEnabled: true,
      slValue: -10,
      trailingEnabled: false,
    },
  }));
}

describe('StrategyNarrativeSummary (Phase 2 composite)', () => {
  beforeEach(() => {
    seedFullStrategy();
    useLayoutPrefsStore.setState({ summaryMode: 'narrative' });
  });

  it('renders a single prose paragraph covering trigger + direction + exit', () => {
    const { container } = render(<StrategyNarrativeSummary />);
    const text = container.textContent ?? '';
    // Trigger
    expect(text).toMatch(/RSI-14/);
    expect(text).toMatch(/40/);
    expect(text).toMatch(/Close/);
    expect(text).toMatch(/1h/);
    // Direction
    expect(text).toMatch(/Long/i);
    expect(text).toMatch(/Market/i);
    // Exit
    expect(text).toMatch(/take profit/i);
    expect(text).toMatch(/1\.5/);
    expect(text).toMatch(/stop loss|cut loss/i);
    expect(text).toMatch(/10/);
    // Sentence connectors so the prose reads naturally
    expect(text.toLowerCase()).toMatch(/when/);
    expect(text.toLowerCase()).toMatch(/enter|then/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
pnpm test -- src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx
```

Expected: import error — file doesn't exist yet.

- [ ] **Step 3: Create `StrategyNarrativeSummary.tsx`**

```tsx
/**
 * Composite narrative for Phase 2 — Strategy.
 *
 * Reads from 3 slices (strategy, directionForm, closeMethod) + botConfig
 * (for timeframe) and emits ONE prose paragraph that flows naturally:
 *
 *   "When RSI-14 < 40 on Close of a 1h candle, enter a Long position
 *    at Market price. Take profit at +1.5% (100% of size). Stop loss
 *    at −10%."
 *
 * Rendered by StrategyCard when summaryMode === 'narrative' (replaces
 * the 3 stacked sub-summaries).
 */
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { indicatorOutputId } from '@/features/indicators/indicator-registry';

const CANDLE_LABEL: Record<string, string> = {
  open: 'Open', close: 'Close', high: 'High', low: 'Low', volume: 'Volume',
};

export function StrategyNarrativeSummary() {
  const strategy = useBuilderStore((s) => s.strategy);
  const directionForm = useBuilderStore((s) => s.directionForm);
  const closeMethod = useBuilderStore((s) => s.closeMethod);
  const timeframe = useBuilderStore((s) => s.botConfig.timeframe);

  const conditions = strategy.entryConditions.conditions;
  const isLong = directionForm.direction === 'long';
  const isLimit = directionForm.orderType === 'limit';
  const orderLabel = isLimit ? 'Limit' : 'Market';

  // Choose the most representative candle channel — prefer Close, fall back
  // to the first one enabled. If nothing's enabled we say "the candle".
  const candleSource =
    strategy.candlestick.find((c) => c === 'close') ??
    strategy.candlestick[0] ??
    null;
  const candleText = candleSource ? CANDLE_LABEL[candleSource] : 'the candle';

  // First entry condition as the headline trigger; mention additional ones
  // as a count.
  const firstCond = conditions[0];
  const moreCount = Math.max(0, conditions.length - 1);
  const logicWord = strategy.entryConditions.logic.type === 'OR' ? 'or' : 'and';

  const triggerText = firstCond
    ? `${describeSide(firstCond.left)} ${firstCond.op} ${describeSide(firstCond.right)}`
    : 'no rule yet';

  const indicatorList = strategy.indicators
    .map((ind) => indicatorOutputId(ind))
    .join(', ');

  // Exit phrasing depends on close-method type.
  const exitNode = renderExitNarrative(closeMethod);

  return (
    <p className="text-sm leading-relaxed text-fg-secondary">
      When{' '}
      <span className="font-mono font-medium text-fg">{triggerText}</span>
      {moreCount > 0 ? (
        <span className="text-fg-muted">
          {' '}
          ({logicWord} {moreCount} more)
        </span>
      ) : null}{' '}
      on <span className="font-medium text-fg">{candleText}</span> of a{' '}
      <span className="font-mono font-medium text-fg">{timeframe}</span>{' '}
      candle, enter a{' '}
      <span className={isLong ? 'font-semibold text-bullish' : 'font-semibold text-bearish'}>
        {isLong ? 'Long' : 'Short'}
      </span>{' '}
      position at <span className="font-medium text-fg">{orderLabel}</span>{' '}
      price.{indicatorList ? (
        <>
          {' '}
          <span className="text-fg-muted">
            Indicators: <span className="font-mono text-brand">{indicatorList}</span>.
          </span>
        </>
      ) : null}{' '}
      {exitNode}
    </p>
  );
}

/** Render one side of a condition (left/right) as readable text. */
function describeSide(side: { kind: string; id?: string; value?: number }): string {
  if (side.kind === 'value') return String(side.value ?? '');
  return side.id ?? '?';
}

/** Exit-clause text varies by close-method shape. Returned as a fragment so
 * the caller can splice it into the paragraph. */
function renderExitNarrative(
  closeMethod: ReturnType<typeof useBuilderStore.getState>['closeMethod'],
) {
  const { type, tpEnabled, tpLevels, slEnabled, slValue, trailingEnabled, roiSteps, exitConditions } = closeMethod;

  if (type === 'manual') {
    return (
      <span>
        Close trades <span className="font-medium text-fg">manually</span> —
        bot won't auto-exit.
      </span>
    );
  }

  if (type === 'tp_sl') {
    const firstTp = tpLevels[0];
    const totalTp = tpLevels.reduce((s, l) => s + (l.amount ?? 0), 0);
    return (
      <>
        {tpEnabled && firstTp ? (
          <>
            Take profit at{' '}
            <span className="font-mono font-medium text-bullish">
              +{firstTp.profit}%
            </span>{' '}
            ({firstTp.amount}% of size)
            {tpLevels.length > 1 ? (
              <span className="text-fg-muted">
                {' '}
                with {tpLevels.length - 1} more level
                {tpLevels.length - 1 === 1 ? '' : 's'} ({totalTp}% total)
              </span>
            ) : null}
            .
          </>
        ) : (
          <>Take profit is off.</>
        )}{' '}
        {slEnabled ? (
          <>
            Stop loss at{' '}
            <span className="font-mono font-medium text-bearish">{slValue}%</span>
            {trailingEnabled ? <span className="text-fg-muted"> (trailing)</span> : null}
            .
          </>
        ) : (
          <>Stop loss is off.</>
        )}
      </>
    );
  }

  if (type === 'indicator') {
    return (
      <>
        Exit when{' '}
        <span className="font-mono font-medium text-fg">
          {exitConditions.conditions.length} indicator rule
          {exitConditions.conditions.length === 1 ? '' : 's'}
        </span>{' '}
        fire.
      </>
    );
  }

  // roi
  return (
    <>
      Exit by ROI table with{' '}
      <span className="font-mono font-medium text-fg">{roiSteps.length}</span>{' '}
      step{roiSteps.length === 1 ? '' : 's'}.
    </>
  );
}
```

- [ ] **Step 4: Wire the mode switch into `StrategyCard.tsx`**

Open `src/features/bot-builder/components/StrategyCard.tsx`. Add imports near the top:

```ts
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';
import { StrategyNarrativeSummary } from './summaries/StrategyNarrativeSummary';
```

In the component body, near the existing `useBuilderStore` calls, add:

```ts
const summaryMode = useLayoutPrefsStore((s) => s.summaryMode);
```

Find the existing block (around line 185):

```tsx
{(visualStatus === 'configured' || visualStatus === 'error') && (
  <div
    className="w-full space-y-3 border-t border-border-subtle px-5 py-3 cursor-default"
    onClick={(e) => e.stopPropagation()}
  >
    <StepCardSummary stepId="entry-strategy" />
    <StepCardSummary stepId="direction" />
    <StepCardSummary stepId="close-method" />
  </div>
)}
```

Replace its inner content with the mode switch:

```tsx
{(visualStatus === 'configured' || visualStatus === 'error') && (
  <div
    className="w-full space-y-3 border-t border-border-subtle px-5 py-3 cursor-default"
    onClick={(e) => e.stopPropagation()}
  >
    {summaryMode === 'narrative' ? (
      <StrategyNarrativeSummary />
    ) : (
      <>
        <StepCardSummary stepId="entry-strategy" />
        <StepCardSummary stepId="direction" />
        <StepCardSummary stepId="close-method" />
      </>
    )}
  </div>
)}
```

- [ ] **Step 5: Run to verify all tests pass**

```bash
pnpm test -- src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx
```

Expected: all tests pass — BotConfig (2) + Entry (3) + Direction (1) + CloseMethod (1) + StrategyNarrative (1) = 8.

- [ ] **Step 6: Commit**

```bash
git add src/features/bot-builder/components/summaries/StrategyNarrativeSummary.tsx src/features/bot-builder/components/StrategyCard.tsx src/features/bot-builder/components/summaries/__tests__/summary-modes.test.tsx
git commit -m "feat(strategy-card): composite narrative for Phase 2

When summaryMode === 'narrative', StrategyCard renders a single prose
paragraph (StrategyNarrativeSummary) that flows trigger → direction → exit.
Visual mode keeps the existing 3-stack of sub-summaries.

PR-SM8"
```

---

## Task 9: Whole-app verification

**Files:**
- Run only — no code changes

- [ ] **Step 1: Run the entire test suite**

```bash
pnpm test
```

Expected: 0 failures. New tests added: 3 (store) + 2 (header) + 8 (summaries) = **13 total**.

- [ ] **Step 2: Run typecheck + lint + format**

```bash
pnpm typecheck && pnpm lint && pnpm format
```

Expected: 0 errors. If `format` changed files, stage them.

- [ ] **Step 3: Manual smoke test in dev**

```bash
pnpm dev
```

Then in browser at `http://127.0.0.1:5173/builder`:

1. Log in with `trinm@coin98.finance` / `Coin98@123`.
2. Click "Create new bot" or load a template so both phase cards become configured.
3. **Locate the new toggle button** in the header — between the Eye visibility toggle and the Templates button. Default icon = `Layers` (visual mode).
4. Verify **Phase 1 card (Bot Basics)** shows the **visual** layout: pair as bold headline + Dry-run pill on the right, then a horizontal row of 3 metric stats (Timeframe / Leverage / Stake) separated by vertical dividers.
5. Verify **Phase 2 card (Strategy)** shows the **3 visual sub-summaries** stacked:
   - Entry: rule code-block (brand left border) + candle chips + indicator pills.
   - Direction: Long pill → arrow → Market pill.
   - CloseMethod: method chip + TP/SL 2-cell grid.
6. Click the toggle. Icon flips to `AlignLeft`.
7. Verify **Phase 1 card** now shows a prose sentence: "Trade BTC-USDC on 1h candles with 1× leverage in Dry-run mode · stake $100 USDT per position."
8. Verify **Phase 2 card** now shows ONE composite paragraph: "When RSI-14 < 40 on Close of a 1h candle, enter a Long position at Market price. Take profit at +1.5% (100% of size). Stop loss at −10%."
9. **Reload the page.** Verify the mode persisted (still narrative after reload).
10. Toggle back to visual. Reload. Confirm persistence the other direction.
11. Edit one of the strategy sub-steps (e.g. change SL to −5%, add a 2nd TP level, change direction to Short). Verify both modes reflect the change live.

- [ ] **Step 4: Visual diff against mockup**

Open `public/board-redesign.html` in a second browser tab. Compare:
- Phase 1 visual mode ↔ Variation B "Bot Basics" card.
- Phase 2 visual mode (composed) ↔ Variation B "Strategy" card.
- Phase 1 narrative ↔ Variation C "Bot Basics" card.
- Phase 2 narrative ↔ Variation C "Strategy" card.

Pixel-perfect not required — confirm the **information architecture** matches.

- [ ] **Step 5: Take screenshots for the PR**

Capture 4 screenshots (visual mode × 2 cards + narrative mode × 2 cards). Stage locally; attach to the PR description.

- [ ] **Step 6: Commit any format sweep**

```bash
git status
# if dirty from `pnpm format`:
git add -p
git commit -m "chore: prettier sweep after summary-mode merge

PR-SM9"
```

---

## Task 10: Open PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin <branch-name>
```

> **Branch question is still open** — see "Open question" at the bottom of this plan. Bundle on current `feat/auth-and-submit` (which has unrelated work) or branch off `main` into `feat/summary-modes`?

- [ ] **Step 2: Open PR via `gh`**

```bash
gh pr create --title "feat: summary visual/narrative mode toggle" --body "$(cat <<'EOF'
## Summary
- Add `summaryMode` (`'visual' | 'narrative'`) to `layout-prefs.store` with v1→v2 migration
- New icon toggle in `HeaderToolbar` (next to existing summary visibility eye)
- `BotConfigSummary` now dual-mode (hero stack ↔ prose sentence)
- 3 sub-summaries (Entry / Direction / CloseMethod) upgraded to mockup-B visual:
  - rule code-block hero
  - action-row direction
  - TP/SL 2-cell grid
- New `StrategyNarrativeSummary` — Phase 2 narrative = ONE composite paragraph (not 3 disjoint sentences)
- `StrategyCard` switches between 3-stack (visual) and composite paragraph (narrative)
- Default mode: `visual`. Persisted across reloads.

## Test plan
- [x] Store unit tests (3 cases) + Header toggle (2) + 4 summaries × visual + 1 composite narrative = 13 new tests
- [x] `pnpm typecheck && pnpm lint && pnpm test` all pass
- [x] Manual smoke test in dev with logged-in account: both modes, persistence, live edits

## Screenshots
[Attach 4 screenshots: visual ×2 cards, narrative ×2 cards]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review checklist

**Spec coverage:**
- [x] `summaryMode` state added (Task 1)
- [x] Toggle button in header with a11y (Task 3)
- [x] Default `visual` (Task 1, default value in store + v1→v2 migration)
- [x] Persistence across reloads (Task 1, `persist` middleware)
- [x] Variation B visual applied to Phase 1 (Task 4) and to all 3 sub-summaries inside Phase 2 (Tasks 5–7)
- [x] Variation C narrative applied to Phase 1 (Task 4) and as 1 composite paragraph to Phase 2 (Task 8)

**Placeholder scan:** No "TBD", no "implement later", no "add appropriate handling". Every code block is complete.

**Type consistency:**
- `SummaryMode` type defined in store (Task 1), implicitly imported by header (Task 3) and summaries via `useLayoutPrefsStore` selector return type.
- Method names `toggleSummaryMode` / `setSummaryMode` consistent across store and all call sites.
- `ConditionRow` shape used in `describeSide` (Task 8) approximated inline — flagged for verification against `src/types/builder.types.ts`.

**Known soft spots for the implementer:**
1. The `as never` test fixtures (`Indicator`, `ConditionRow`) are placeholder shapes. If the live builder store has zod or class-style validation, replace with real type imports. Step 1 of Task 5 / 8 will catch this immediately if it fails.
2. `StrategyNarrativeSummary` picks `Close` as the candle source by default, falling back to whatever's first. If `candlestick: []` is rare in real data, this is fine; otherwise extend with a friendlier fallback.
3. Narrative phrasing of multi-condition entries says "(and 2 more)" — verify this reads OK with 3+ conditions in real data.
4. The Phase 2 narrative omits ROI and indicator-exit close-methods from the hero sentence — they're handled by `renderExitNarrative` but with less rich phrasing. If the user uses these methods often, refine in v2.

---

## Open question — needs sếp answer before Task 10

The current branch (`feat/auth-and-submit`) has unrelated in-flight work (`DrawerProgressGlow.test.tsx`, `AUDIT_REPORT.md`, etc.). Two paths:

- **(a) Bundle on `feat/auth-and-submit`** — 1 PR mixes 2 scopes (login/submit + summary modes). Faster, but reviewer has to parse 2 concerns.
- **(b) Branch off `main` into `feat/summary-modes`** — clean scope, easy review. Cherry-pick SM1–SM9 commits or branch first then start coding.

**Recommendation: (b)** — summary modes is independent feature, easier to review and revert if needed.

---

**Plan complete and saved to `PLAN_SUMMARY_MODES.md`.**
