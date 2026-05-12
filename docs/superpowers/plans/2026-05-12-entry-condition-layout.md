# Entry Condition Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three UI-only tweaks to the condition builder: (1) auto-render one default row when entry conditions are empty, (2) move the AND/OR toggle out of each row into a side-by-side pill rendered BETWEEN rows, (3) wrap consecutive OR-joined rows in a shared bordered sub-container so OR-groups are visually distinct from surrounding AND-joined rows.

**Architecture:** Data model unchanged — `entryConditions: ConditionGroup` with `conditions: ConditionRow[]` and each row carrying an `operator?: 'AND' | 'OR'` field. Grouping is a pure render-time computation: walk the rows and bundle every row whose `operator === 'OR'` into the preceding group. Single-row groups render plain; multi-row groups render inside a bordered sub-container. A new `ConditionConnector` component owns the AND/OR toggle and writes back to `row.operator`. The IF prefix stays inline on the first row only.

**Tech Stack:** React 18, TypeScript 5.7, Vitest 2 + @testing-library/react, Tailwind 3.

**Spec:** `docs/superpowers/specs/2026-05-12-entry-condition-layout-design.md`

---

## File Structure

**New (2):**
| Path | Purpose |
|---|---|
| `src/features/conditions/groupConsecutiveOr.ts` | Pure function. Walks `ConditionRow[]`, returns `ConditionRow[][]` where each inner array is a run of consecutive rows with `operator === 'OR'` chained back to the first non-OR row. |
| `src/features/conditions/ConditionConnector.tsx` | Side-by-side `[AND \| OR]` toggle pill rendered between adjacent rows. Active variant uses brand-yellow background; inactive is muted text on transparent background. |

**Modified (3):**
| Path | Change |
|---|---|
| `src/features/conditions/ConditionRow.tsx` | Drop the `<ToggleGroup>` AND/OR block that currently lives at the top of non-first rows. The IF static label stays for `isFirst === true` only. Row body padding (`pl-12` on the second sub-row) becomes conditional on `isFirst`. |
| `src/features/conditions/ConditionBuilder.tsx` | Add optional prop `defaultRowOnMount?: boolean`. On mount, if `defaultRowOnMount === true` and `group.conditions.length === 0`, fire `addRow()` once via `useEffect`. Replace the existing flat `<ol>` with a grouped render: compute groups via `groupConsecutiveOr`, render each group either plain (single row) or inside a bordered `<div>` (multi row). Render `<ConditionConnector>` between adjacent rows (within and between groups). |
| `src/features/bot-builder/steps/EntryStrategyStep.tsx` | Pass `defaultRowOnMount` to `<ConditionBuilder>`. |

**Unchanged:**
- Data model: `builder.types.ts` (`ConditionRow`, `ConditionGroup` shapes stay).
- Serializer: `lib/serializer.ts`.
- Zod schemas: `schemas/strategy.schema.ts`, `schemas/unified-bot-strategy.schema.ts`.
- BE payload shape: still flat `signals.entry_long.conditions: ConditionRow[]`.
- `IndicatorExitForm.tsx`: does NOT pass `defaultRowOnMount` (exit conditions can legitimately be empty).

---

## Task 1: `groupConsecutiveOr` pure function + tests

**Files:**
- Create: `src/features/conditions/groupConsecutiveOr.ts`
- Create: `src/features/conditions/groupConsecutiveOr.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/conditions/groupConsecutiveOr.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { groupConsecutiveOr } from './groupConsecutiveOr';
import type { ConditionRow } from '@/types/builder.types';

function row(id: string, operator?: 'AND' | 'OR'): ConditionRow {
  return {
    id,
    left: 'candle.close',
    op: '>',
    right_type: 'number',
    right_number: 0,
    right_indicator: null,
    lookback: 0,
    operator,
  };
}

describe('groupConsecutiveOr', () => {
  it('returns empty array for empty input', () => {
    expect(groupConsecutiveOr([])).toEqual([]);
  });

  it('returns a single one-row group for one row', () => {
    const r = row('a');
    expect(groupConsecutiveOr([r])).toEqual([[r]]);
  });

  it('returns one group per row when all joins are AND', () => {
    const rows = [row('a'), row('b', 'AND'), row('c', 'AND')];
    const groups = groupConsecutiveOr(rows);
    expect(groups).toHaveLength(3);
    expect(groups[0]).toEqual([rows[0]]);
    expect(groups[1]).toEqual([rows[1]]);
    expect(groups[2]).toEqual([rows[2]]);
  });

  it('bundles a chain of OR joins into one group', () => {
    const rows = [row('a'), row('b', 'OR'), row('c', 'OR'), row('d', 'OR')];
    const groups = groupConsecutiveOr(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual(rows);
  });

  it('splits OR runs whenever an AND appears', () => {
    // r1 AND r2 OR r3 AND r4 OR r5  →  [r1] [r2,r3] [r4,r5]
    const rows = [
      row('r1'),
      row('r2', 'AND'),
      row('r3', 'OR'),
      row('r4', 'AND'),
      row('r5', 'OR'),
    ];
    const groups = groupConsecutiveOr(rows);
    expect(groups).toHaveLength(3);
    expect(groups[0].map((r) => r.id)).toEqual(['r1']);
    expect(groups[1].map((r) => r.id)).toEqual(['r2', 'r3']);
    expect(groups[2].map((r) => r.id)).toEqual(['r4', 'r5']);
  });

  it('treats undefined operator on row 0 like AND (always starts a new group)', () => {
    // First row has no operator. It always starts the first group.
    const rows = [row('a'), row('b', 'OR')];
    const groups = groupConsecutiveOr(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual(rows);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (module-not-found)**

Run: `pnpm test -- --run src/features/conditions/groupConsecutiveOr.test.ts`
Expected: FAIL with "Failed to resolve import './groupConsecutiveOr'".

- [ ] **Step 3: Implement the function**

Create `src/features/conditions/groupConsecutiveOr.ts`:

```ts
import type { ConditionRow } from '@/types/builder.types';

/**
 * Bundle a flat list of conditions into visual groups based on the
 * `operator` field of each row (the join with the PREVIOUS row).
 *
 * - The first row always starts a new group.
 * - Each subsequent row with `operator === 'OR'` appends to the current
 *   group (continuing the OR chain).
 * - Each subsequent row with `operator === 'AND'` (or missing) starts a
 *   new group.
 *
 * The data model stays flat — this is a render-time view computation
 * used by `ConditionBuilder` to decide which rows share a sub-container
 * border (OR-group emphasis) and which stand alone.
 */
export function groupConsecutiveOr(rows: ConditionRow[]): ConditionRow[][] {
  if (rows.length === 0) return [];
  const groups: ConditionRow[][] = [[rows[0]]];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].operator === 'OR') {
      groups[groups.length - 1].push(rows[i]);
    } else {
      groups.push([rows[i]]);
    }
  }
  return groups;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- --run src/features/conditions/groupConsecutiveOr.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/conditions/groupConsecutiveOr.ts src/features/conditions/groupConsecutiveOr.test.ts
git commit -m "$(cat <<'EOF'
feat(conditions): add groupConsecutiveOr pure helper

Walk a flat ConditionRow[] and bundle every row whose operator === 'OR'
into the preceding group. First row always starts a new group; AND
joins always break the chain. Used by the upcoming ConditionBuilder
layout to draw a shared border around multi-row OR groups while keeping
the data model flat.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `ConditionConnector` component + tests

**Files:**
- Create: `src/features/conditions/ConditionConnector.tsx`
- Create: `src/features/conditions/ConditionConnector.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/features/conditions/ConditionConnector.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConditionConnector } from './ConditionConnector';

describe('ConditionConnector', () => {
  it('renders both AND and OR labels', () => {
    render(<ConditionConnector operator="AND" onChange={() => {}} />);
    expect(screen.getByText('AND')).toBeInTheDocument();
    expect(screen.getByText('OR')).toBeInTheDocument();
  });

  it('highlights AND when operator is AND', () => {
    render(<ConditionConnector operator="AND" onChange={() => {}} />);
    const andBtn = screen.getByRole('button', { name: 'AND' });
    expect(andBtn).toHaveAttribute('data-active', 'true');
    const orBtn = screen.getByRole('button', { name: 'OR' });
    expect(orBtn).toHaveAttribute('data-active', 'false');
  });

  it('highlights OR when operator is OR', () => {
    render(<ConditionConnector operator="OR" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'OR' })).toHaveAttribute(
      'data-active',
      'true',
    );
    expect(screen.getByRole('button', { name: 'AND' })).toHaveAttribute(
      'data-active',
      'false',
    );
  });

  it('calls onChange with OR when AND-active and user clicks OR', () => {
    const onChange = vi.fn();
    render(<ConditionConnector operator="AND" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'OR' }));
    expect(onChange).toHaveBeenCalledWith('OR');
  });

  it('calls onChange with AND when OR-active and user clicks AND', () => {
    const onChange = vi.fn();
    render(<ConditionConnector operator="OR" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'AND' }));
    expect(onChange).toHaveBeenCalledWith('AND');
  });

  it('does not fire onChange when the already-active button is clicked', () => {
    const onChange = vi.fn();
    render(<ConditionConnector operator="AND" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'AND' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --run src/features/conditions/ConditionConnector.test.tsx`
Expected: FAIL with "Failed to resolve import './ConditionConnector'".

- [ ] **Step 3: Implement the component**

Create `src/features/conditions/ConditionConnector.tsx`:

```tsx
import { cn } from '@/lib/utils';

export interface ConditionConnectorProps {
  operator: 'AND' | 'OR';
  onChange: (next: 'AND' | 'OR') => void;
}

/**
 * Side-by-side AND/OR toggle pill rendered between adjacent condition
 * rows. The active operator gets a brand-yellow background; the inactive
 * one is muted text on transparent. Clicking the inactive button flips
 * the row's `operator` field.
 *
 * Sized to be visually unobtrusive — should not dominate the row
 * spacing.
 */
export function ConditionConnector({ operator, onChange }: ConditionConnectorProps) {
  const handle = (next: 'AND' | 'OR') => {
    if (next === operator) return;
    onChange(next);
  };

  return (
    <div
      role="group"
      aria-label="Logical join"
      className="inline-flex items-center overflow-hidden rounded-full border border-border-subtle text-xs font-semibold"
    >
      {(['AND', 'OR'] as const).map((label) => {
        const active = operator === label;
        return (
          <button
            key={label}
            type="button"
            data-active={active}
            onClick={() => handle(label)}
            className={cn(
              'px-3 py-1 transition-colors',
              active
                ? 'bg-brand text-fg-inverse'
                : 'bg-transparent text-fg-muted hover:bg-canvas/40',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- --run src/features/conditions/ConditionConnector.test.tsx`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/conditions/ConditionConnector.tsx src/features/conditions/ConditionConnector.test.tsx
git commit -m "$(cat <<'EOF'
feat(conditions): add ConditionConnector pill

Side-by-side AND | OR toggle rendered between adjacent condition rows.
Active variant uses brand background; clicking the inactive button
flips the row's operator. Same-active clicks are no-ops (no onChange
fired) so we don't spam updates when users tap the highlighted side.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Drop in-row AND/OR toggle from `ConditionRow`

**Files:**
- Modify: `src/features/conditions/ConditionRow.tsx`

The current Row 1 of ConditionRow contains `{!isFirst ? <ToggleGroup .../> : <span>IF</span>}`. After this change, the `!isFirst` branch returns `null` (or omits the slot entirely); only the `IF` label remains for `isFirst === true`. The connector will be rendered by `ConditionBuilder` between rows.

Row 2's `pl-12` padding is conditional on `isFirst` so non-first rows don't have stranded indent.

- [ ] **Step 1: Apply the change**

In `src/features/conditions/ConditionRow.tsx`, find the block (around line 82-96):

```tsx
{!isFirst ? (
  <ToggleGroup
    value={row.operator ?? 'AND'}
    onChange={(v) => onChange({ operator: v as 'AND' | 'OR' })}
    options={[
      { value: 'AND', label: 'AND' },
      { value: 'OR', label: 'OR' },
    ]}
  />
) : (
  <span className="w-12 shrink-0 text-center text-xs font-semibold uppercase tracking-wide text-fg-muted">
    IF
  </span>
)}
```

Replace with:

```tsx
{isFirst ? (
  <span className="w-12 shrink-0 text-center text-xs font-semibold uppercase tracking-wide text-fg-muted">
    IF
  </span>
) : null}
```

Then find Row 2's container (around line 140):

```tsx
<div className="mt-2 flex items-center gap-2 pl-12">
```

Replace with:

```tsx
<div className={cn('mt-2 flex items-center gap-2', isFirst && 'pl-12')}>
```

(The `cn` helper is already imported at the top of the file.)

Also remove the now-unused `ToggleGroup` import at the top of the file:

```tsx
import { ToggleGroup } from '@/components/ui/toggle-group';
```

Delete this line.

- [ ] **Step 2: Run typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: clean. Tests that were rendering `ConditionRow` with `isFirst=false` no longer see the toggle but should still find the row body. If any test asserts on the AND/OR toggle existing inside a row, it will fail — fix by removing those assertions (the new ConditionConnector will be tested separately in its own file and via ConditionBuilder integration).

- [ ] **Step 3: Commit**

```bash
git add src/features/conditions/ConditionRow.tsx
git commit -m "$(cat <<'EOF'
refactor(conditions): remove in-row AND/OR toggle

The operator toggle moves out of each row into a ConditionConnector pill
rendered between adjacent rows by ConditionBuilder. The IF static label
stays inline on the first row only. Row body padding (pl-12 on the
second sub-row) becomes conditional on isFirst so non-first rows don't
have stranded indent.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Refactor `ConditionBuilder` — grouped render + default row

**Files:**
- Modify: `src/features/conditions/ConditionBuilder.tsx`
- Create: `src/features/conditions/ConditionBuilder.test.tsx` (new — there's no existing test for this component)

- [ ] **Step 1: Write the failing tests**

Create `src/features/conditions/ConditionBuilder.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConditionBuilder } from './ConditionBuilder';
import type { ConditionGroup, ConditionRow } from '@/types/builder.types';

function group(rows: ConditionRow[]): ConditionGroup {
  return { logic: { type: 'AND', threshold: null }, conditions: rows };
}

function row(id: string, operator?: 'AND' | 'OR'): ConditionRow {
  return {
    id,
    left: 'candle.close',
    op: '>',
    right_type: 'number',
    right_number: 0,
    right_indicator: null,
    lookback: 0,
    operator,
  };
}

describe('ConditionBuilder', () => {
  it('auto-adds a default row on mount when defaultRowOnMount=true and group is empty', () => {
    const onChange = vi.fn();
    render(
      <ConditionBuilder
        group={group([])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={onChange}
        defaultRowOnMount
      />,
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as ConditionGroup;
    expect(next.conditions).toHaveLength(1);
    expect(next.conditions[0].left).toBe('candle.close');
    expect(next.conditions[0].op).toBe('>');
    expect(next.conditions[0].right_type).toBe('number');
    expect(next.conditions[0].operator).toBeUndefined();
  });

  it('does NOT auto-add when defaultRowOnMount is omitted', () => {
    const onChange = vi.fn();
    render(
      <ConditionBuilder
        group={group([])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={onChange}
      />,
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does NOT auto-add when defaultRowOnMount=true but group already has rows', () => {
    const onChange = vi.fn();
    render(
      <ConditionBuilder
        group={group([row('a')])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={onChange}
        defaultRowOnMount
      />,
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders a ConditionConnector between adjacent rows', () => {
    render(
      <ConditionBuilder
        group={group([row('a'), row('b', 'AND'), row('c', 'OR')])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={() => {}}
      />,
    );
    // 3 rows → 2 connectors → each connector has both AND + OR labels
    expect(screen.getAllByText('AND')).toHaveLength(2);
    expect(screen.getAllByText('OR')).toHaveLength(2);
  });

  it('wraps multi-row OR groups in a bordered sub-container', () => {
    render(
      <ConditionBuilder
        group={group([row('a'), row('b', 'OR'), row('c', 'OR')])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={() => {}}
      />,
    );
    // The OR group should be rendered with a `data-or-group` marker (added by impl)
    const groupEls = document.querySelectorAll('[data-or-group="true"]');
    expect(groupEls).toHaveLength(1);
  });

  it('does NOT wrap single-row groups in a sub-container', () => {
    render(
      <ConditionBuilder
        group={group([row('a'), row('b', 'AND'), row('c', 'AND')])}
        indicators={[]}
        candlestickChannels={['close']}
        onChange={() => {}}
      />,
    );
    // 3 AND-joined rows → 3 single-row groups → 0 borders
    expect(document.querySelectorAll('[data-or-group="true"]')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --run src/features/conditions/ConditionBuilder.test.tsx`
Expected: 6 tests FAIL (component renders differently than tests expect).

- [ ] **Step 3: Rewrite `ConditionBuilder.tsx`**

Replace the entire file with:

```tsx
import { Fragment, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConditionRow } from './ConditionRow';
import { ConditionConnector } from './ConditionConnector';
import { groupConsecutiveOr } from './groupConsecutiveOr';
import type {
  ConditionGroup,
  ConditionRow as ConditionRowType,
  IndicatorItem,
} from '@/types/builder.types';

export interface ConditionBuilderProps {
  group: ConditionGroup;
  indicators: IndicatorItem[];
  candlestickChannels: ('open' | 'close' | 'high' | 'low' | 'volume')[];
  onChange: (group: ConditionGroup) => void;
  /** Optional title rendered above the condition list. */
  label?: string;
  /** Optional empty-state hint. Only used when `defaultRowOnMount` is false. */
  emptyHint?: string;
  /**
   * When true, the builder auto-adds one default row on mount if the
   * group is empty. Pass true for entry conditions (a bot must have
   * at least one); leave false for optional condition lists like the
   * indicator exit form.
   */
  defaultRowOnMount?: boolean;
}

export function ConditionBuilder({
  group,
  indicators,
  candlestickChannels,
  onChange,
  label = 'Entry conditions',
  emptyHint = 'No conditions yet — add one to control when the bot enters.',
  defaultRowOnMount = false,
}: ConditionBuilderProps) {
  const updateRow = (id: string, patch: Partial<ConditionRowType>) => {
    onChange({
      ...group,
      conditions: group.conditions.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      ),
    });
  };

  const removeRow = (id: string) => {
    onChange({
      ...group,
      conditions: group.conditions
        .filter((c) => c.id !== id)
        .map((c, idx) => (idx === 0 ? { ...c, operator: undefined } : c)),
    });
  };

  const makeDefaultRow = (isFirst: boolean): ConditionRowType => ({
    id: crypto.randomUUID(),
    left: candlestickChannels.includes('close')
      ? 'candle.close'
      : candlestickChannels[0]
        ? `candle.${candlestickChannels[0]}`
        : 'candle.close',
    op: '>',
    right_type: 'number',
    right_number: 0,
    right_indicator: null,
    lookback: 0,
    operator: isFirst ? undefined : 'AND',
  });

  const addRow = () => {
    const isFirst = group.conditions.length === 0;
    onChange({ ...group, conditions: [...group.conditions, makeDefaultRow(isFirst)] });
  };

  // Auto-add a default row on mount when the group is empty and the
  // caller opted in. Runs only once per mount (no auto-readd if the
  // user later empties the list).
  const didAutoAdd = useRef(false);
  useEffect(() => {
    if (
      defaultRowOnMount &&
      !didAutoAdd.current &&
      group.conditions.length === 0
    ) {
      didAutoAdd.current = true;
      onChange({
        ...group,
        conditions: [makeDefaultRow(true)],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = groupConsecutiveOr(group.conditions);

  return (
    <div className="rounded-xl border border-border bg-canvas/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium text-fg-secondary">{label}</h4>
        <span className="text-2xs uppercase tracking-wide text-fg-muted">
          {group.conditions.length} rule{group.conditions.length === 1 ? '' : 's'}
        </span>
      </div>

      {group.conditions.length === 0 ? (
        <p className="mb-3 rounded-md border border-dashed border-border bg-canvas/40 p-4 text-center text-xs text-fg-muted">
          {emptyHint}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((g, gi) => {
            const multi = g.length > 1;
            // Find the row index of g[0] in the flat list — needed
            // because the inter-group connector edits THAT row's
            // operator field (the first row of the next group).
            const firstRowIndexInFlat = group.conditions.indexOf(g[0]);
            const isAbsoluteFirstGroup = gi === 0;
            return (
              <Fragment key={g[0].id}>
                {!isAbsoluteFirstGroup && (
                  <div className="flex justify-center">
                    <ConditionConnector
                      operator={g[0].operator ?? 'AND'}
                      onChange={(op) => updateRow(g[0].id, { operator: op })}
                    />
                  </div>
                )}
                <div
                  data-or-group={multi ? 'true' : 'false'}
                  className={
                    multi
                      ? 'flex flex-col gap-2 rounded-xl border border-border-subtle p-2'
                      : ''
                  }
                >
                  {g.map((r, ri) => (
                    <Fragment key={r.id}>
                      {ri > 0 && (
                        <div className="flex justify-center">
                          <ConditionConnector
                            operator={r.operator ?? 'OR'}
                            onChange={(op) => updateRow(r.id, { operator: op })}
                          />
                        </div>
                      )}
                      <ConditionRow
                        row={r}
                        isFirst={isAbsoluteFirstGroup && ri === 0}
                        indicators={indicators}
                        candlestickChannels={candlestickChannels}
                        onChange={(patch) => updateRow(r.id, patch)}
                        onRemove={() => removeRow(r.id)}
                      />
                    </Fragment>
                  ))}
                </div>
              </Fragment>
            );
          })}
        </div>
      )}

      <div className="mt-3">
        <Button variant="ghost" size="sm" onClick={addRow}>
          <Plus className="h-3.5 w-3.5" />
          Add condition
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- --run src/features/conditions/ConditionBuilder.test.tsx`
Expected: 6 tests PASS.

Run: `pnpm test`
Expected: all pass (existing serializer + StepDrawer tests unaffected; ConditionRow tests may need a small update — if they were rendering a row with `isFirst=false` and asserting on the absent AND/OR toggle, they should still pass because the toggle is gone; if they asserted ITS PRESENCE, those assertions fail and must be removed). If StepDrawer or other tests fail, investigate before commit.

- [ ] **Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/conditions/ConditionBuilder.tsx src/features/conditions/ConditionBuilder.test.tsx
git commit -m "$(cat <<'EOF'
refactor(conditions): grouped render + default row in ConditionBuilder

- Group consecutive OR-joined rows into a bordered sub-container so
  OR-groups are visually distinct from surrounding AND-joined rows.
  Single-row groups render plain. Grouping is purely render-time;
  data model stays flat.
- Render ConditionConnector pills BETWEEN rows (within groups for OR,
  between groups for the inter-group join) — replaces the old in-row
  AND/OR toggle.
- Add optional `defaultRowOnMount` prop. When true and the group is
  empty on mount, auto-add one default row so entry conditions show a
  starter row immediately. Once-per-mount only — user can still empty
  the list.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire `defaultRowOnMount` in `EntryStrategyStep` + smoke test

**Files:**
- Modify: `src/features/bot-builder/steps/EntryStrategyStep.tsx`

- [ ] **Step 1: Add the prop**

In `src/features/bot-builder/steps/EntryStrategyStep.tsx`, locate the `<ConditionBuilder>` element and add the `defaultRowOnMount` prop:

```tsx
<ConditionBuilder
  group={strategy.entryConditions}
  indicators={fullIndicators}
  candlestickChannels={[...allCandle]}
  onChange={wrapOnChange((g) => patch({ entryConditions: g }))}
  defaultRowOnMount
/>
```

Do NOT add the prop to `IndicatorExitForm.tsx` — exit conditions can legitimately be empty.

- [ ] **Step 2: Run typecheck + tests**

Run: `pnpm typecheck && pnpm test`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/bot-builder/steps/EntryStrategyStep.tsx
git commit -m "$(cat <<'EOF'
feat(entry-strategy): show a starter condition row on first open

Pass defaultRowOnMount=true so users don't have to click "+ Add
condition" before they see the condition fields. Exit conditions stay
optional (no default row in IndicatorExitForm).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Browser smoke test**

Run: `pnpm dev`
Wait for Vite to be ready on http://127.0.0.1:5173.

Manual checks:
1. Log in (`trinm@coin98.finance` / `Coin98@123`). Reset the builder via DevTools → localStorage → remove `trading-bot-builder` (or use a fresh incognito).
2. Open the Strategy drawer.
3. Confirm: **one condition row is already rendered** (with `IF candle.close > 0`). No need to click "Add condition".
4. Click "Add condition". Confirm a second row appears AND a `[AND | OR]` pill renders between row 1 and row 2 (NOT inside row 2). AND is highlighted.
5. Click the OR button in the connector. Confirm:
   - The connector's active variant flips to OR.
   - The two rows are NOW wrapped in a single inner bordered container.
6. Click "Add condition" again. Confirm row 3 appears below row 2, INSIDE the same bordered container, with another connector pill between row 2 and row 3 (OR active by default? Actually: addRow defaults operator to 'AND' for non-first rows — so the new pill should show AND active, and row 3 sits OUTSIDE the OR group). Verify by visual inspection.
7. Click the new pill's OR button. Confirm row 3 joins the OR group (border expands to include row 3, OR pill is now inside the group between row 2 and row 3).
8. Click pill between row 1 and row 2, flip back to AND. Confirm:
   - Row 1 stands alone (no border).
   - Rows 2 and 3 are still inside a 2-row OR group with a border.
9. Open Close method → Indicator exit. Confirm exit conditions DO NOT auto-add a row (still starts empty with the dashed empty-state hint).
10. Apply a template (e.g. `scalping-btc-1m`). Confirm the imported conditions render with correct grouping (any OR'd rows wrapped in border, AND'd rows standalone).

- [ ] **Step 5: If issues are found, fix and commit separately. Otherwise no commit.**

---

## Out of scope (do NOT do in this plan)

- Nested groups in the data model (i.e. a `ConditionGroup` containing other `ConditionGroup` items). Tri confirmed UI-only.
- Drag-to-reorder, drag-to-regroup.
- New design tokens. Reuse existing Tailwind utilities (`border-border-subtle`, `bg-brand`, `text-fg-inverse`, `text-fg-muted`).
- BE schema or serializer changes.
- Animating the group border in/out on operator toggle. Static layout is fine for v1.

If the implementer notices an unrelated bug while in these files, file a separate task via `mcp__ccd_session__spawn_task` rather than bundling.
