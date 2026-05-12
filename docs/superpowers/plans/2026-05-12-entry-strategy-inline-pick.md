# Entry Strategy Inline Pick Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "Candlestick price data" chip selector and the "Indicators" picker section from `EntryStrategySetup`. Indicator + candle channel selection now happens **inline inside the condition row's existing dropdowns** — picking from the full registry auto-adds the metric to strategy state with default params. ConditionRow UX stays identical (`>`, `<`, `crosses above`, Number/Indicator on right side, etc.). Same auto-add applies to the close-method exit-conditions form, which reuses `ConditionBuilder`.

**Architecture:** A new hook `useConditionMetrics()` synthesizes the full metric catalog (5 candle channels + all 6 registry indicators with default params, merged with any custom-param indicators already in state from templates) and returns a `wrapOnChange()` helper. Both `EntryStrategySetup` and `IndicatorExitForm` call the hook and pass its synthesized lists down to `ConditionBuilder`. The hook intercepts each condition-group change, detects newly-referenced metrics, and patches them into `strategy.candlestick` / `strategy.indicators` additively (no GC on un-reference — safe, costs at most a few extra unused channels in the BE payload).

**Tech Stack:** React 18, TypeScript 5.7, Zustand 5, Vitest 2 + @testing-library/react.

**Approved design decisions** (Tri 2026-05-12):
- **GC**: additive only. Un-referenced indicators/channels stay in state until explicit clear (e.g. via JSON import overwrite or template apply).
- **Param edit retained via IndicatorChip**: the standalone "Add indicator" picker button goes away, but the existing chip strip listing added indicators **stays**. Each chip keeps its settings icon (popover with `timeperiod` / `price` / etc.) so users can still tune RSI-14 → RSI-21, MA-50 close → MA-200 high, etc. The strip auto-populates from condition picks (no more manual Add).
- **Backward compat with templates**: a template can ship `{name: MA, params: timeperiod 12}` → state has `MA-12`. The condition dropdown shows BOTH `MA-12` (from state) and `MA-50` (registry default) since `MA-50` isn't in state yet. User picks either. The chip strip shows `MA-12` because that's what state has — clicking its settings lets the user change `MA-12` → `MA-100` (or whatever).

---

## File Structure

**New files (2):**
| Path | Purpose |
|---|---|
| `src/features/conditions/useConditionMetrics.ts` | Hook returning `{ allCandle, fullIndicators, wrapOnChange }`. Single source of truth for the auto-add logic. |
| `src/features/conditions/useConditionMetrics.test.ts` | Pure-logic tests (synthesis + auto-add detection). |

**Modified files (2):**
| Path | Change |
|---|---|
| `src/features/bot-builder/steps/EntryStrategyStep.tsx` | Delete Candlestick FormField + Indicators FormField + `toggleCandle` helper + unused imports. Replace with hook call + augmented `ConditionBuilder` props. |
| `src/features/close-method/IndicatorExitForm.tsx` | Use the hook so exit conditions also get full catalog + auto-add. |

**Deleted files (1):**
| Path | Reason |
|---|---|
| `src/features/indicators/IndicatorPicker.tsx` | The "Add indicator" popover. No call sites after refactor — indicators auto-add from condition picks. |

**Kept** (formerly slated for deletion):
| Path | Reason |
|---|---|
| `src/features/indicators/IndicatorChip.tsx` | Per Tri's Q2 clarification: each chip's settings icon stays so users can edit params (RSI period 14→21, etc.). The chip strip itself stays in `EntryStrategySetup`, auto-populated from condition picks (no manual Add button). |

---

## Task 1: Create `useConditionMetrics` hook + tests

The hook is pure-ish (reads from store, returns memoized lists + a wrapper function). Tests cover the wrapper logic with stub state.

**Files:**
- Create: `src/features/conditions/useConditionMetrics.ts`
- Create: `src/features/conditions/useConditionMetrics.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/conditions/useConditionMetrics.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { indicatorOutputId } from '@/features/indicators/indicator-registry';
import { useConditionMetrics } from './useConditionMetrics';
import type { ConditionGroup } from '@/types/builder.types';

const emptyGroup: ConditionGroup = {
  logic: { type: 'AND', threshold: null },
  conditions: [],
};

describe('useConditionMetrics', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
  });

  it('exposes all 5 candle channels', () => {
    const { result } = renderHook(() => useConditionMetrics());
    expect(result.current.allCandle).toEqual([
      'open',
      'close',
      'high',
      'low',
      'volume',
    ]);
  });

  it('exposes all 6 registry indicators with default params', () => {
    const { result } = renderHook(() => useConditionMetrics());
    const ids = result.current.fullIndicators.map(indicatorOutputId).sort();
    expect(ids).toContain('RSI-14');
    expect(ids).toContain('MA-50');
    expect(ids).toContain('BB-20');
    expect(ids).toContain('ATR-14');
    expect(ids).toContain('Stochastic-14');
    expect(ids.some((id) => id.startsWith('MACD-'))).toBe(true);
  });

  it('merges custom-param indicators from state, preferring state version', () => {
    // Simulate a template that set MA period 12 instead of default 50
    useBuilderStore.setState((s) => ({
      strategy: {
        ...s.strategy,
        indicators: [
          {
            id: 'ma-template',
            name: 'MA',
            parameters: { timeperiod: 12, price: 'close' },
          },
        ],
      },
    }));

    const { result } = renderHook(() => useConditionMetrics());
    const ids = result.current.fullIndicators.map(indicatorOutputId);
    expect(ids).toContain('MA-12'); // from state
    expect(ids).toContain('MA-50'); // from registry default (coexists)
  });

  it('wrapOnChange auto-adds candle channel when condition references unselected candle', () => {
    const calls: ConditionGroup[] = [];
    const { result } = renderHook(() => useConditionMetrics());

    const wrapped = result.current.wrapOnChange((g) => calls.push(g));
    const newGroup: ConditionGroup = {
      ...emptyGroup,
      conditions: [
        {
          id: 'c1',
          left: 'candle.close',
          op: '>',
          right_type: 'number',
          right_number: 0,
          right_indicator: null,
          lookback: 0,
        },
      ],
    };
    wrapped(newGroup);

    // onChange forwarded
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(newGroup);
    // state patched
    expect(useBuilderStore.getState().strategy.candlestick).toContain('close');
  });

  it('wrapOnChange auto-adds indicator when condition references unselected indicator', () => {
    const { result } = renderHook(() => useConditionMetrics());
    const wrapped = result.current.wrapOnChange(() => {});

    const g: ConditionGroup = {
      ...emptyGroup,
      conditions: [
        {
          id: 'c1',
          left: 'RSI-14',
          op: '<',
          right_type: 'number',
          right_number: 30,
          right_indicator: null,
          lookback: 0,
        },
      ],
    };
    wrapped(g);

    const indicators = useBuilderStore.getState().strategy.indicators;
    const rsi = indicators.find((i) => indicatorOutputId(i) === 'RSI-14');
    expect(rsi).toBeDefined();
    expect(rsi?.parameters).toMatchObject({ timeperiod: 14 });
  });

  it('wrapOnChange auto-adds right-side indicator when right_type is indicator', () => {
    const { result } = renderHook(() => useConditionMetrics());
    const wrapped = result.current.wrapOnChange(() => {});

    const g: ConditionGroup = {
      ...emptyGroup,
      conditions: [
        {
          id: 'c1',
          left: 'candle.close',
          op: 'crosses_above',
          right_type: 'indicator',
          right_number: null,
          right_indicator: 'MA-50',
          lookback: 0,
        },
      ],
    };
    wrapped(g);

    const indicators = useBuilderStore.getState().strategy.indicators;
    expect(indicators.some((i) => indicatorOutputId(i) === 'MA-50')).toBe(true);
    expect(useBuilderStore.getState().strategy.candlestick).toContain('close');
  });

  it('wrapOnChange does NOT re-add metric already in state (idempotent)', () => {
    useBuilderStore.setState((s) => ({
      strategy: {
        ...s.strategy,
        candlestick: ['close'],
        indicators: [
          { id: 'rsi-1', name: 'RSI', parameters: { timeperiod: 14 } },
        ],
      },
    }));

    const { result } = renderHook(() => useConditionMetrics());
    const wrapped = result.current.wrapOnChange(() => {});
    const g: ConditionGroup = {
      ...emptyGroup,
      conditions: [
        {
          id: 'c1',
          left: 'candle.close',
          op: '<',
          right_type: 'indicator',
          right_number: null,
          right_indicator: 'RSI-14',
          lookback: 0,
        },
      ],
    };
    wrapped(g);

    expect(useBuilderStore.getState().strategy.candlestick).toEqual(['close']);
    expect(useBuilderStore.getState().strategy.indicators).toHaveLength(1);
  });

  it('wrapOnChange does NOT remove un-referenced metrics (additive only)', () => {
    useBuilderStore.setState((s) => ({
      strategy: {
        ...s.strategy,
        candlestick: ['open', 'close'],
        indicators: [
          { id: 'rsi-1', name: 'RSI', parameters: { timeperiod: 14 } },
        ],
      },
    }));

    const { result } = renderHook(() => useConditionMetrics());
    const wrapped = result.current.wrapOnChange(() => {});
    // New group references neither 'open' nor RSI
    wrapped({ ...emptyGroup, conditions: [] });

    expect(useBuilderStore.getState().strategy.candlestick).toEqual([
      'open',
      'close',
    ]);
    expect(useBuilderStore.getState().strategy.indicators).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (hook not yet defined)**

Run: `pnpm test -- --run src/features/conditions/useConditionMetrics.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the hook**

Create `src/features/conditions/useConditionMetrics.ts`:

```ts
import { useMemo } from 'react';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import {
  INDICATOR_REGISTRY,
  indicatorOutputId,
  makeIndicator,
} from '@/features/indicators/indicator-registry';
import type {
  Candlestick,
  ConditionGroup,
  IndicatorItem,
} from '@/types/builder.types';

const ALL_CANDLE: readonly Candlestick[] = [
  'open',
  'close',
  'high',
  'low',
  'volume',
];

/**
 * Catalog hook for condition rows: returns the full pickable metrics
 * (5 candle channels + all registry indicators with default params,
 * merged with template/import-provided custom-param indicators from
 * state) plus a `wrapOnChange` helper that additively patches newly
 * referenced metrics into `strategy.candlestick` / `strategy.indicators`.
 *
 * Used by both `EntryStrategySetup` (entry conditions) and
 * `IndicatorExitForm` (close-method exit conditions).
 */
export function useConditionMetrics() {
  const strategy = useBuilderStore((s) => s.strategy);
  const patchStrategy = useBuilderStore((s) => s.patchStrategy);

  const fullIndicators = useMemo<IndicatorItem[]>(() => {
    // Defaults from registry (one per name).
    const fromRegistry = Object.keys(INDICATOR_REGISTRY).map((name) =>
      makeIndicator(name),
    );
    // State indicators may have custom params (templates / imports).
    // Merge so both default and custom-param versions appear, dedupe by output id.
    const byId = new Map<string, IndicatorItem>();
    for (const i of fromRegistry) byId.set(indicatorOutputId(i), i);
    for (const i of strategy.indicators) byId.set(indicatorOutputId(i), i);
    return [...byId.values()];
  }, [strategy.indicators]);

  function wrapOnChange(
    onChange: (g: ConditionGroup) => void,
  ): (g: ConditionGroup) => void {
    return (g) => {
      const newCandle = new Set<Candlestick>();
      const newIndicators = new Map<string, IndicatorItem>();

      const considerRef = (ref: string | null) => {
        if (!ref) return;
        if (ref.startsWith('candle.')) {
          const ch = ref.slice('candle.'.length) as Candlestick;
          if (
            (ALL_CANDLE as readonly string[]).includes(ch) &&
            !strategy.candlestick.includes(ch)
          ) {
            newCandle.add(ch);
          }
        } else {
          const already = strategy.indicators.some(
            (i) => indicatorOutputId(i) === ref,
          );
          if (already) return;
          const match = fullIndicators.find(
            (i) => indicatorOutputId(i) === ref,
          );
          if (match) newIndicators.set(ref, match);
        }
      };

      for (const c of g.conditions) {
        considerRef(c.left);
        if (c.right_type === 'indicator') considerRef(c.right_indicator);
      }

      if (newCandle.size > 0 || newIndicators.size > 0) {
        patchStrategy({
          ...(newCandle.size > 0 && {
            candlestick: [...strategy.candlestick, ...newCandle],
          }),
          ...(newIndicators.size > 0 && {
            indicators: [...strategy.indicators, ...newIndicators.values()],
          }),
        });
      }

      onChange(g);
    };
  }

  return {
    allCandle: ALL_CANDLE,
    fullIndicators,
    wrapOnChange,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- --run src/features/conditions/useConditionMetrics.test.ts`
Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/conditions/useConditionMetrics.ts src/features/conditions/useConditionMetrics.test.ts
git commit -m "$(cat <<'EOF'
feat(conditions): add useConditionMetrics hook

Single source of truth for the full condition-row pickable catalog
(5 candle channels + all 6 registry indicators with default params,
merged with custom-param indicators from state). Returns a
wrapOnChange helper that additively patches newly referenced metrics
into strategy.candlestick / strategy.indicators when the user picks
something not yet in state. Used by both entry and exit condition
forms in the next two commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Refactor `EntryStrategySetup` to use the hook

Drop the Candlestick + Indicators FormFields. Strategy name + ConditionBuilder are the only two children. Pass the hook's synthesized lists and wrapped onChange to the existing `ConditionBuilder`.

**Files:**
- Modify: `src/features/bot-builder/steps/EntryStrategyStep.tsx`

- [ ] **Step 1: Replace the file contents**

Replace the entire file with:

```tsx
import { useBuilderStore } from '../store/builder.store';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { IndicatorChip } from '@/features/indicators/IndicatorChip';
import { ConditionBuilder } from '@/features/conditions/ConditionBuilder';
import { useConditionMetrics } from '@/features/conditions/useConditionMetrics';

export function EntryStrategySetup() {
  const strategy = useBuilderStore((s) => s.strategy);
  const patch = useBuilderStore((s) => s.patchStrategy);
  const { allCandle, fullIndicators, wrapOnChange } = useConditionMetrics();

  return (
    <>
      <FormField
        label="Strategy name"
        hint="Internal label — used as `name` in strategy.json."
      >
        <Input
          value={strategy.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Entry Strategy 1"
        />
      </FormField>

      {strategy.indicators.length > 0 ? (
        <FormField
          label="Indicators"
          hint="Click the settings icon on any chip to tune its parameters."
        >
          <div className="flex flex-wrap items-center gap-2">
            {strategy.indicators.map((ind) => (
              <IndicatorChip
                key={ind.id}
                item={ind}
                onChange={(next) =>
                  patch({
                    indicators: strategy.indicators.map((i) =>
                      i.id === next.id ? next : i,
                    ),
                  })
                }
                onRemove={() =>
                  patch({
                    indicators: strategy.indicators.filter(
                      (i) => i.id !== ind.id,
                    ),
                  })
                }
              />
            ))}
          </div>
        </FormField>
      ) : null}

      <ConditionBuilder
        group={strategy.entryConditions}
        indicators={fullIndicators}
        candlestickChannels={allCandle}
        onChange={wrapOnChange((g) => patch({ entryConditions: g }))}
      />
    </>
  );
}
```

Removed: `toggleCandle`, the `Candlestick price data` FormField, the `IndicatorPicker` import + Add-button section, the empty-state copy, imports for `Chip`, `CANDLESTICK_OPTIONS`, `IndicatorPicker`, `makeIndicator`, and the `Candlestick` type alias.

Kept: the `IndicatorChip` strip — now auto-populated (no Add button), hidden when `strategy.indicators` is empty. Each chip's settings popover remains the way users tune params (RSI period, MA source, etc.).

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: clean. If `candlestickChannels` prop's expected type is a mutable array but `allCandle` is `readonly`, change `ConditionBuilder`'s prop type to `readonly Candlestick[]` (or cast at the call site). Verify by inspecting `src/features/conditions/ConditionBuilder.tsx` — the prop is `candlestickChannels: ('open' | 'close' | 'high' | 'low' | 'volume')[]`. If TS complains about `readonly`, cast: `candlestickChannels={[...allCandle]}`.

- [ ] **Step 3: Run tests**

Run: `pnpm test`
Expected: all pass. Existing serializer round-trip tests still work because they go through `buildUnifiedPayload` which reads from `strategy.candlestick` and `strategy.indicators` — both still populated (now via auto-add).

- [ ] **Step 4: Commit**

```bash
git add src/features/bot-builder/steps/EntryStrategyStep.tsx
git commit -m "$(cat <<'EOF'
refactor(entry-strategy): pick indicators inline in condition rows

Remove the standalone "Candlestick price data" chip selector and
"Indicators" picker section. Both are now selected inline via the
existing left/right dropdowns in ConditionRow — the dropdowns show
the full registry (5 candle channels + 6 indicators with default
params) and useConditionMetrics auto-adds the pick to strategy
state. Saves the "pre-add then reference" two-step flow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Refactor `IndicatorExitForm` to use the hook

Exit conditions (close method indicator mode) should also benefit from the full catalog + auto-add.

**Files:**
- Modify: `src/features/close-method/IndicatorExitForm.tsx`

- [ ] **Step 1: Replace the file contents**

Replace the entire file with:

```tsx
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { ConditionBuilder } from '@/features/conditions/ConditionBuilder';
import { useConditionMetrics } from '@/features/conditions/useConditionMetrics';

export function IndicatorExitForm() {
  const close = useBuilderStore((s) => s.closeMethod);
  const patch = useBuilderStore((s) => s.patchCloseMethod);
  const { allCandle, fullIndicators, wrapOnChange } = useConditionMetrics();

  return (
    <ConditionBuilder
      group={close.exitConditions}
      indicators={fullIndicators}
      candlestickChannels={allCandle}
      onChange={wrapOnChange((g) => patch({ exitConditions: g }))}
      label="Exit conditions"
      emptyHint="Add a condition (e.g. RSI > 70) to exit when indicators signal."
    />
  );
}
```

If TS complains about `readonly`, cast: `candlestickChannels={[...allCandle]}`.

- [ ] **Step 2: Run typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/close-method/IndicatorExitForm.tsx
git commit -m "$(cat <<'EOF'
refactor(close-method): use useConditionMetrics in exit conditions

Same auto-add UX as entry conditions — exit-condition dropdowns
now show the full registry and pick auto-adds to strategy state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Delete `IndicatorPicker.tsx`

The "Add indicator" popover button has no remaining call sites after Task 2. `IndicatorChip.tsx` stays — it's used by the auto-populated chip strip for param editing.

**Files:**
- Delete: `src/features/indicators/IndicatorPicker.tsx`

- [ ] **Step 1: Verify zero remaining references**

Run: `grep -rn "IndicatorPicker" src --include="*.ts" --include="*.tsx"`
Expected: only `src/features/indicators/IndicatorPicker.tsx` itself. If anything else matches, STOP and investigate.

Also confirm `IndicatorChip` IS still referenced (it should be — by `EntryStrategyStep.tsx`):

Run: `grep -rn "IndicatorChip" src --include="*.ts" --include="*.tsx" | grep -v "IndicatorChip.tsx"`
Expected: `src/features/bot-builder/steps/EntryStrategyStep.tsx` matches (import + JSX). If nothing matches, the IndicatorChip strip in Task 2 was forgotten.

- [ ] **Step 2: Delete the file**

```bash
git rm src/features/indicators/IndicatorPicker.tsx
```

- [ ] **Step 3: Run typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore(indicators): delete IndicatorPicker (Add button)

No call sites remaining after entry/exit condition forms switched
to inline picking via useConditionMetrics. IndicatorChip stays —
the chip strip auto-populates from condition picks and each chip
keeps its settings popover for param tuning.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Browser smoke test

End-to-end check against the running app. Not a code commit unless an issue surfaces.

**Files:** none modified unless a defect is found.

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`
Wait until Vite reports `ready in <Xms>` on http://127.0.0.1:5173.

- [ ] **Step 2: Manual flow**

1. Log in (`trinm@coin98.finance` / `Coin98@123`).
2. Open the Strategy drawer.
3. Confirm: no "Candlestick price data" chip row. No "Add indicator" button. Only "Strategy name" + (empty) Indicators FormField + the conditions builder.
4. Click "Add condition".
5. In the LEFT dropdown, confirm all 5 candle channels (`candle.open`, `candle.close`, `candle.high`, `candle.low`, `candle.volume`) AND all 6 registry indicators (`RSI-14`, `MA-50`, `MACD-12-26-9`, `BB-20`, `ATR-14`, `Stochastic-14`) appear.
6. Pick `RSI-14`. Set operator to `<`. Set right type `Number`, value `30`.
7. Confirm the **Indicators chip strip now appears above the conditions** with one `RSI-14` chip. Click its settings icon — the popover should let you edit `Time period` from 14 to e.g. 21. After save, the chip label updates to `RSI-21`.
8. Set right type to `Indicator`. Confirm right dropdown also lists all 6 registry indicators. Pick `MA-50`.
9. Confirm the chip strip now shows `RSI-21` AND `MA-50`. Open DevTools → Application → Local Storage → confirm `strategy.indicators` has both entries.
10. Click `crosses_above` operator with left `candle.close`. Confirm `strategy.candlestick` (in localStorage) contains `'close'`.
11. Open the Close method step → switch to "Indicator exit" → confirm the same picker behavior in the exit-condition builder. The Entry strip should also show any new indicator picked here (since they share `strategy.indicators`).
12. Apply a template (e.g. `scalping-btc-1m`). Confirm template indicators (with custom params like `MA-12`) appear in the chip strip AND in the condition dropdown alongside the default `MA-50`. Click `MA-12` chip's settings — confirm you can edit its period.

- [ ] **Step 3: If any issue surfaces, fix and commit separately. Otherwise no commit.**

---

## Out of scope (do NOT do in this plan)

- In-UI indicator parameter customization (RSI period editor). Defer until users complain.
- Garbage collection of un-referenced indicators/channels on condition removal.
- Reintroducing IndicatorChip as a "click to edit params" affordance on the picked metric.
- Refactoring `ConditionRow` or `ConditionBuilder` internals — these stay identical.
- Changes to the BE payload shape. Same `strategy.indicators` + `strategy.candlestick` arrays go to BE.

If the implementer notices an unrelated bug while in these files, file a separate task via `mcp__ccd_session__spawn_task` rather than bundling.
