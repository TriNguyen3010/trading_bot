# Entry Condition Layout Redesign — Design Spec

**Status:** Approved by Tri 2026-05-12 (Q1=yes, Q2=A, Q3=grouping)
**Owner:** FE (Tri Nguyen)
**Scope:** Visual layout of `ConditionBuilder` — no data model change, no BE change.

---

## 1. Goal

Three layout tweaks to the entry/exit condition builder:

1. **Default first row pre-rendered.** When the user opens the Strategy drawer with empty `entryConditions`, the builder auto-creates one default condition row (`IF candle.close > 0`) so the user can immediately start filling in real values without first clicking "+ Add condition". Exit conditions stay empty by default (an empty exit list is a valid state — means "no indicator exit").

2. **AND/OR toggle moves out of the row into a vertical connector pill between rows.** Currently the toggle sits inside row 2+ (top-left). New: each pair of adjacent rows has a small pill component between them with side-by-side `AND | OR` toggle. Active variant highlighted (same style as the existing yellow `AND` in the screenshot).

3. **Auto-grouping of consecutive OR rows with a shared border.** When 2+ consecutive rows are joined by OR (i.e. `row[i].operator === 'OR'`), the builder wraps them in a single bordered sub-container to make the OR-group visually distinct from surrounding AND-joined rows. Single-row "groups" render plain (no extra border). Data model stays flat — grouping is computed at render time from the existing `operator` field on each row.

## 2. Non-goals

- BE schema changes. The payload structure (`signals.entry_long.conditions: ConditionRow[]`) is unchanged.
- Nested groups in the data model (no `ConditionGroup` inside `ConditionGroup`). Tri confirmed UI-only.
- Indicator parameter editor changes (`IndicatorChip` stays untouched).
- Auto-saving / phantom row UX. The default row commits to state on mount via `onChange` — it's a real row, not a placeholder.

## 3. Visual layout (after)

```
┌─ Entry conditions ──────────────────────── 2 RULES ─┐
│                                                    │
│   ┌─ row ─────────────────────────────────────┐    │
│   │ IF  [candle.close ▼] [> ▼]                │    │  Single-row group → no extra border.
│   │     [Number ▼] [0]                  ✕     │    │
│   └────────────────────────────────────────────┘    │
│                                                    │
│          ┌──────┬──────┐                            │  Connector pill — Q2A side-by-side.
│          │ AND* │  OR  │                            │  Active variant highlighted.
│          └──────┴──────┘                            │
│                                                    │
│   ┌─ OR group (multi-row) ────────────────────┐    │  Multi-row OR group → bordered sub-
│   │  ┌─ row ─────────────────────────────┐    │    │  container with OR pills between rows.
│   │  │  [candle.close ▼] [> ▼]           │    │    │
│   │  │  [Number ▼] [0]              ✕    │    │    │
│   │  └────────────────────────────────────┘    │    │
│   │       ┌──────┬──────┐                       │    │
│   │       │  AND │ OR*  │                       │    │
│   │       └──────┴──────┘                       │    │
│   │  ┌─ row ─────────────────────────────┐     │    │
│   │  │  [RSI-14 ▼] [< ▼]                  │     │    │
│   │  │  [Number ▼] [30]              ✕    │     │    │
│   │  └────────────────────────────────────┘     │    │
│   └─────────────────────────────────────────────┘    │
│                                                    │
│   + Add condition                                  │
└────────────────────────────────────────────────────┘
```

The OR group's border is a subtle inner border (`border-border-subtle` or similar low-contrast token), just enough to show the boundary without competing with the row borders.

## 4. Grouping algorithm

```
groups = [[rows[0]]]
for i in 1..rows.length:
  if rows[i].operator === 'OR':
    groups[last].push(rows[i])
  else:
    groups.push([rows[i]])
```

Pure function. Output: `ConditionRow[][]`. Empty input → empty output.

A single-row group renders plain. A multi-row group renders inside a bordered `<div>` with OR connector pills between rows inside.

## 5. Connector pill behavior

The pill is a thin horizontal element rendered BETWEEN any two adjacent rows in the rendered list (whether they're in the same group or different groups). It always shows both `AND | OR` side by side. Active variant (whichever the row's `operator` is) gets the brand-yellow highlight; inactive is muted text on transparent background.

Clicking toggles `row[i].operator` between `'AND'` and `'OR'`. Toggling triggers re-grouping on the next render:
- `AND → OR`: this row joins the previous row's group (potentially merging groups).
- `OR → AND`: this row breaks out into a new group (potentially splitting a group).

The pill is always interactive — there is no read-only state inside an OR group. Tri can switch any row's join freely.

## 6. Default first row

`ConditionBuilder` gains an optional prop `defaultRowOnMount?: boolean` (defaults to `false`).

When `defaultRowOnMount === true`:
- `useEffect` on mount: if `group.conditions.length === 0`, call `addRow()` once.
- The default row uses the same shape as today's `addRow()` (left = `candle.close` if available, op = `>`, right_type = `number`, right_number = 0, no operator since it's the first row).
- If the user later removes all rows, the row does NOT auto-re-add — `useEffect` runs only on mount.

Passed `true` from `EntryStrategySetup`. Not passed (or `false`) from `IndicatorExitForm`.

## 7. Files

**Modified (3):**
| Path | Change |
|---|---|
| `src/features/conditions/ConditionBuilder.tsx` | Add `defaultRowOnMount` prop. On mount, auto-add if true + empty. Compute groups via new `groupConsecutiveOr` helper. Render groups with shared border when multi-row. Render `<ConditionConnector>` between adjacent rows (within and between groups). |
| `src/features/conditions/ConditionRow.tsx` | Remove the `ToggleGroup AND/OR` block at the top of non-first rows (the connector handles operator now). The first row still shows the `IF` static label inline. |
| `src/features/bot-builder/steps/EntryStrategyStep.tsx` | Pass `defaultRowOnMount` prop to `<ConditionBuilder>`. |

**New (2):**
| Path | Purpose |
|---|---|
| `src/features/conditions/groupConsecutiveOr.ts` + `.test.ts` | Pure grouping function with 4-5 test scenarios. |
| `src/features/conditions/ConditionConnector.tsx` + `.test.tsx` | Side-by-side `AND | OR` toggle pill. Props: `operator: 'AND' | 'OR'`, `onChange: (op) => void`. |

**Unchanged:** Data model (`builder.types.ts`), serializer (`serializer.ts`), Zod schema, BE payload shape.

## 8. Test plan

- **groupConsecutiveOr** unit tests: empty input, single row, all-AND, all-OR (one big group), mixed (AND OR AND OR forms 3 groups: [r1][r2,r3][r4]), idempotent.
- **ConditionConnector** component tests: renders both AND/OR labels; active variant has brand color; onChange fires with the OTHER operator when clicked.
- **ConditionBuilder** component tests:
  - With `defaultRowOnMount=true` + empty group → `onChange` fires with one default row on mount.
  - With `defaultRowOnMount` omitted + empty group → no auto-add.
  - Multi-row OR group renders with shared border (verify by class name or testid).
  - Connector pill renders between rows and not before first row.
- Existing serializer round-trip tests: unchanged, must still pass.

## 9. Risk assessment

Low. UI-only refactor. The data model is identical, so the BE payload is identical, the serializer tests are identical. The connector is just a relocated UI element. The grouping is a pure render-time computation. Default row auto-add is a one-liner `useEffect`.

Main concerns:
- Visual styling needs to match the existing design language (rounded corners, border tokens, brand color for active). Use existing Tailwind tokens — no new design tokens.
- Connector pill should be small enough not to dominate the row spacing. Aim for ~28-32px height.

## 10. Out of scope (future iterations)

- Nested groups (data model change). Tri can ask for this later if needed.
- Drag-to-reorder conditions or drag-to-regroup. Currently no reordering UI — same as today.
- Inline edit of operator without a toggle (typed input). Stays as toggle.
