# FE Indicator Catalog — Phase 2B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let conditions reference a _specific output_ of a multi-output indicator (BBANDS upper/middle/lower, MACD macd/signal/hist, STOCH slowk/slowd, STOCHRSI fastk/fastd), and serialize each used `(indicator, output)` as its own `indicators[]` entry carrying `output` — plus emit `pandas_ta_func` / `requires_datetime_index` for pandas_ta indicators. This closes the `indicators[0].output` gap in the BE-format checklist and removes the "pick a multi-output indicator → silently broken bot" trap from 2A.

**Architecture:** Extend `IndicatorItem` with an optional `output`. `indicatorOutputId` appends `.{output}` ONLY for multi-output indicators, so single-output ids (`RSI-14`) are unchanged (backward-compatible with existing conditions/templates). `useConditionMetrics` expands each multi-output registry indicator into one pickable metric per output. `serializeIndicators` emits `output` (multi-output only), `pandas_ta_func`, and `requires_datetime_index` from the registry. The condition dropdown then shows "BBANDS · Upper band" rows.

**Tech Stack:** TypeScript, Vitest, React, Zustand.

**Spec:** `docs/superpowers/specs/2026-06-04-fe-indicator-catalog-phase2-design.md` §3.2-3.4

**Depends on:** Phase 2A (merged) — registry already carries `outputs[]`, `pandasTaFunc`, `requiresDatetimeIndex`.

**Scope note:** This plan covers the **indicator-side** `output` (the `indicators[]` array). The **condition-side** `right_indicator` descriptive string (`"BBANDS (Upper Band) - 2.0, 2.0, 14"`) is Phase **2C** and is BLOCKED pending a BE format confirmation — see the 2C plan. 2B keeps `right_indicator`/`left` using the FE id (`BBANDS-20-2-2.upperband`); Tuấn confirmed BE matches indicators by key (name+output), so this is internally consistent and unit-testable now, with the exact wire-string deferred to 2C.

---

## Output-id model (the key decision)

`indicatorOutputId(item)`:

- single-output indicator (registry `outputs.length === 1`): `buildId(params)` → `RSI-14` (unchanged).
- multi-output indicator (`outputs.length > 1`): `${buildId(params)}.${output}` → `BBANDS-20-2-2.upperband`. When `output` is unset, default to `outputs[0]`.

This guarantees existing single-output refs (`RSI-14`, `SMA-50`) are byte-identical to 2A, so no template/condition migration is needed.

`output` resolution for the `indicators[]` payload (`serializeIndicators`):

- emit `output` ONLY when `outputs.length > 1` (talib multi-output + pandas_ta multi-output). Single-output (RSI/SMA/EMA/ADX/OBV/SAR/VWAP/NATR) omit `output` — matches the BE source-of-truth convention.
- emit `pandas_ta_func` when `type === 'pandas_ta'`.
- emit `requires_datetime_index: true` when the registry flag is set (VWAP).

---

## File Structure

| File                                                  | Responsibility                                                                                      | Action |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------ |
| `src/types/builder.types.ts`                          | add `IndicatorItem.output?: string`                                                                 | Modify |
| `src/features/indicators/indicator-registry.ts`       | `indicatorOutputId` appends `.{output}` for multi-output; add `isMultiOutput` helper                | Modify |
| `src/features/indicators/indicator-registry.test.ts`  | cover multi-output id + output default                                                              | Modify |
| `src/features/conditions/useConditionMetrics.ts`      | expand multi-output indicators into per-output metrics; map ref→indicator (with output) on auto-add | Modify |
| `src/features/conditions/useConditionMetrics.test.ts` | cover per-output expansion + auto-add with output                                                   | Modify |
| `src/lib/serializer.ts`                               | `serializeIndicators` emits `output`/`pandas_ta_func`/`requires_datetime_index`                     | Modify |
| `src/lib/serializer.test.ts`                          | cover multi-output + pandas_ta serialize                                                            | Modify |
| `src/features/conditions/ConditionRow.tsx`            | per-output option label ("BBANDS · Upper band")                                                     | Modify |
| `src/features/indicators/IndicatorChip.tsx`           | show chosen output in chip summary                                                                  | Modify |
| `src/lib/serializer.be-format.test.ts`                | drop the `indicators[0].output` KNOWN_DEVIATION (now matches)                                       | Modify |

---

## Task 1: Add `output` to the IndicatorItem model

**Files:**

- Modify: `src/types/builder.types.ts` (the `IndicatorItem` interface)

- [ ] **Step 1: Add the field**

In `IndicatorItem`, add `output` next to the existing `timeframe?`:

```ts
export interface IndicatorItem {
  id: string;
  name: string; // "RSI", "BBANDS", "SMA", ...
  type: 'talib' | 'pandas_ta' | 'custom';
  parameters: Record<string, number | string>;
  /** Chosen output column for multi-output indicators (e.g. "upperband").
   *  Unset for single-output indicators. */
  output?: string;
  timeframe?: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (adding an optional field breaks nothing).

- [ ] **Step 3: Commit**

```bash
git add src/types/builder.types.ts
git commit -m "feat(indicators): add IndicatorItem.output for multi-output"
```

---

## Task 2: `indicatorOutputId` encodes output for multi-output indicators

**Files:**

- Modify: `src/features/indicators/indicator-registry.ts`
- Test: `src/features/indicators/indicator-registry.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `indicator-registry.test.ts`:

```ts
import { isMultiOutput } from './indicator-registry';

describe('multi-output ids', () => {
  it('single-output ids are unchanged (no output suffix)', () => {
    expect(indicatorOutputId(makeIndicator('RSI'))).toBe('RSI-14');
    expect(isMultiOutput('RSI')).toBe(false);
  });

  it('multi-output id appends .{output}, defaulting to first output', () => {
    expect(isMultiOutput('BBANDS')).toBe(true);
    const bb = makeIndicator('BBANDS'); // output unset → defaults to outputs[0]
    expect(indicatorOutputId(bb)).toBe('BBANDS-20-2-2.upperband');
    const lower = { ...makeIndicator('BBANDS'), output: 'lowerband' };
    expect(indicatorOutputId(lower)).toBe('BBANDS-20-2-2.lowerband');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/features/indicators/indicator-registry.test.ts`
Expected: FAIL (`isMultiOutput` not exported; id has no `.upperband`).

- [ ] **Step 3: Implement**

In `indicator-registry.ts`, add after `INDICATOR_REGISTRY`:

```ts
export function isMultiOutput(name: string): boolean {
  return (INDICATOR_REGISTRY[name]?.outputs.length ?? 0) > 1;
}
```

and replace `indicatorOutputId`:

```ts
export function indicatorOutputId(item: IndicatorItem): string {
  const def = INDICATOR_REGISTRY[item.name];
  if (!def) return item.name;
  const base = def.buildId(item.parameters);
  if (def.outputs.length <= 1) return base;
  const output = item.output ?? def.outputs[0];
  return `${base}.${output}`;
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm exec vitest run src/features/indicators/indicator-registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/indicators/indicator-registry.ts src/features/indicators/indicator-registry.test.ts
git commit -m "feat(indicators): encode output in id for multi-output indicators"
```

---

## Task 3: Expand multi-output indicators into per-output metrics

**Files:**

- Modify: `src/features/conditions/useConditionMetrics.ts`
- Test: `src/features/conditions/useConditionMetrics.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `useConditionMetrics.test.ts`:

```ts
it('expands a multi-output indicator into one metric per output', () => {
  const { result } = renderHook(() => useConditionMetrics());
  const ids = result.current.fullIndicators.map(indicatorOutputId);
  expect(ids).toContain('BBANDS-20-2-2.upperband');
  expect(ids).toContain('BBANDS-20-2-2.middleband');
  expect(ids).toContain('BBANDS-20-2-2.lowerband');
  // single-output stays single
  expect(ids.filter((id) => id.startsWith('RSI-14'))).toEqual(['RSI-14']);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/features/conditions/useConditionMetrics.test.ts`
Expected: FAIL (only one BBANDS entry, no per-output ids).

- [ ] **Step 3: Implement the expansion**

In `useConditionMetrics.ts`, replace the `fromRegistry` construction inside the `fullIndicators` useMemo:

```ts
import {
  INDICATOR_REGISTRY,
  indicatorOutputId,
  makeIndicator,
} from '@/features/indicators/indicator-registry';

// ...
const fullIndicators = useMemo<IndicatorItem[]>(() => {
  // Defaults from registry — multi-output indicators expand to one item
  // per output so each output is independently pickable.
  const fromRegistry: IndicatorItem[] = [];
  for (const name of Object.keys(INDICATOR_REGISTRY)) {
    const def = INDICATOR_REGISTRY[name];
    const base = makeIndicator(name);
    if (def.outputs.length <= 1) {
      fromRegistry.push(base);
    } else {
      for (const output of def.outputs) {
        fromRegistry.push({ ...base, id: `${base.id}-${output}`, output });
      }
    }
  }
  const byId = new Map<string, IndicatorItem>();
  for (const i of fromRegistry) byId.set(indicatorOutputId(i), i);
  for (const i of strategy.indicators) byId.set(indicatorOutputId(i), i);
  return [...byId.values()];
}, [strategy.indicators]);
```

- [ ] **Step 4: Run the test**

Run: `pnpm exec vitest run src/features/conditions/useConditionMetrics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/conditions/useConditionMetrics.ts src/features/conditions/useConditionMetrics.test.ts
git commit -m "feat(conditions): expose each multi-output indicator output as a metric"
```

---

## Task 4: Serialize `output` / `pandas_ta_func` / `requires_datetime_index`

**Files:**

- Modify: `src/lib/serializer.ts` (`serializeIndicators`, lines 48-54)
- Test: `src/lib/serializer.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `serializer.test.ts` (inside the `describe('serializer', ...)`):

```ts
it('serializes multi-output + pandas_ta indicator fields', () => {
  const store = useBuilderStore.getState();
  store.resetAll();
  const bb = { ...makeIndicator('BBANDS'), output: 'upperband' };
  const vwap = makeIndicator('VWAP');
  store.patchStrategy({ name: 'X', indicators: [bb, vwap] });
  const out = buildUnifiedPayload(useBuilderStore.getState());
  const inds = out.configurations!.signals.indicators as Array<
    Record<string, unknown>
  >;
  const bbOut = inds.find((i) => i.name === 'BBANDS')!;
  expect(bbOut.output).toBe('upperband');
  const vwapOut = inds.find((i) => i.name === 'VWAP')!;
  expect(vwapOut.pandas_ta_func).toBe('vwap');
  expect(vwapOut.requires_datetime_index).toBe(true);
  expect(vwapOut).not.toHaveProperty('output'); // VWAP is single-output
});
```

> `makeIndicator` is already imported in this test file.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run src/lib/serializer.test.ts`
Expected: FAIL (`output`/`pandas_ta_func` absent).

- [ ] **Step 3: Implement**

In `serializer.ts`, replace `serializeIndicators`:

```ts
function serializeIndicators(indicators: IndicatorItem[]) {
  return indicators.map((ind) => {
    const def = INDICATOR_REGISTRY[ind.name];
    const multi = (def?.outputs.length ?? 0) > 1;
    return {
      name: ind.name,
      type: ind.type,
      parameters: ind.parameters,
      ...(multi ? { output: ind.output ?? def!.outputs[0] } : {}),
      ...(def?.pandasTaFunc ? { pandas_ta_func: def.pandasTaFunc } : {}),
      ...(def?.requiresDatetimeIndex ? { requires_datetime_index: true } : {}),
    };
  });
}
```

> `INDICATOR_REGISTRY` is already imported at the top of `serializer.ts`.

- [ ] **Step 4: Run the test**

Run: `pnpm exec vitest run src/lib/serializer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/serializer.ts src/lib/serializer.test.ts
git commit -m "feat(serializer): emit output/pandas_ta_func/requires_datetime_index"
```

---

## Task 5: Dropdown + chip show the output

**Files:**

- Modify: `src/features/conditions/ConditionRow.tsx` (left + right indicator option labels)
- Modify: `src/features/indicators/IndicatorChip.tsx` (chip summary)
- Test: `src/features/indicators/IndicatorChip.test.tsx`

- [ ] **Step 1: Write the failing chip test**

Add to `IndicatorChip.test.tsx`:

```ts
it('shows the chosen output in the chip summary for multi-output', () => {
  const item = { ...makeIndicator('BBANDS'), output: 'upperband' };
  render(<IndicatorChip item={item} onChange={vi.fn()} onRemove={vi.fn()} />);
  expect(screen.getByText('BBANDS-20-2-2.upperband')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it to verify it fails / passes**

Run: `pnpm exec vitest run src/features/indicators/IndicatorChip.test.tsx`
Expected: PASS already if the chip uses `indicatorOutputId(item)` for its summary (it does — line `const summary = indicatorOutputId(item)`). If so, this test just locks the behavior; keep it. If the chip shows `def.name` instead, update the summary to `indicatorOutputId(item)`.

- [ ] **Step 3: Friendly option labels in ConditionRow**

In `ConditionRow.tsx`, the `leftOptions`/`indicatorOptions` currently use `label: id`. Make multi-output rows readable: replace the indicator `.map` label with a helper that splits the `.output` suffix:

```ts
function metricLabel(id: string): string {
  const dot = id.lastIndexOf('.');
  if (dot === -1) return id;
  return `${id.slice(0, dot)} · ${id.slice(dot + 1)}`;
}
```

and use `label: metricLabel(id)` in both the `leftOptions` indicator map and `indicatorOptions` map. (Keep `value: id` unchanged — only the display label changes.)

- [ ] **Step 4: Run the conditions tests**

Run: `pnpm exec vitest run src/features/conditions/ src/features/indicators/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/conditions/ConditionRow.tsx src/features/indicators/IndicatorChip.tsx src/features/indicators/IndicatorChip.test.tsx
git commit -m "feat(conditions): readable per-output metric labels"
```

---

## Task 6: Shrink the BE-format checklist + full verify

**Files:**

- Modify: `src/lib/serializer.be-format.test.ts`

- [ ] **Step 1: Update the sample-2 factory to pick the upper band**

In `serializer.be-format.test.ts` `applySample2Bbands()`, set the indicator output to match the sample (`upperband`):

```ts
const bb = makeIndicator('BBANDS');
bb.parameters = { timeperiod: 14, nbdevup: 2, nbdevdn: 2 };
bb.output = 'upperband';
const bbRef = indicatorOutputId(bb);
```

- [ ] **Step 2: Drop the now-fixed `output` deviation**

Delete this entry from `KNOWN_DEVIATIONS['sample-2-bbands']`:

```ts
    {
      path: 'configurations.signals.indicators[0].output',
      category: 'migration',
      note: 'Multi-output indicators must send `output` ...',
    },
```

(Leave the two `right_indicator` entries and the `entry_short`/`exit_short` entries — those are 2C / fe-limitation.)

- [ ] **Step 3: Run the be-format suite**

Run: `pnpm exec vitest run src/lib/serializer.be-format.test.ts`
Expected: PASS. The "no UNEXPECTED deviation" and "allowlist not stale" tests confirm `indicators[0].output` now matches Tuấn's sample.

- [ ] **Step 4: Full verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all PASS. Fix any test outside these files that referenced a single-output assumption.

- [ ] **Step 5: Commit**

```bash
git add src/lib/serializer.be-format.test.ts
git commit -m "test(indicators): output now matches BE sample; drop deviation"
```

---

## Self-Review Notes

- **Spec coverage:** §3.2 (`IndicatorItem.output`) → Task 1. §3.3 (dropdown per output) → Tasks 3,5. §3.4 (serializer multi-output + pandas_ta) → Task 4. §3.1 done in 2A.
- **Backward compat:** single-output ids unchanged (`RSI-14`), so 2A templates/conditions/tests keep passing.
- **Deferred to 2C:** the `right_indicator` _wire string_ (`"BBANDS (Upper Band) - 2.0, 2.0, 14"`). 2B leaves refs as FE ids; BE matches by key (Tuấn) so the indicator-side `output` is what makes multi-output bots resolve.
- **pandas*ta templated outputs (SUPERTREND `SUPERT*{length}\_{multiplier}`, CHANDELIER_EXIT):** the registry `outputs` are TEMPLATES, not resolved column names. Task 3/4 will surface them verbatim (e.g. `SUPERT_{length}_{multiplier}`) — **this is wrong for the wire.** See the review section in the 2C plan: SUPERTREND/CHANDELIER_EXIT output interpolation needs the exact BE column format (`SUPERT_7_3.0`) confirmed. **Mitigation in 2B:** Task 3 should SKIP expanding pandas_ta indicators whose output strings contain `{` (templated) — they stay single-pick and are flagged — until 2C/BE confirms the interpolation. (Add `&& !def.outputs.some((o) => o.includes('{'))` to the multi-output expansion branch, and `log`/comment it.)
