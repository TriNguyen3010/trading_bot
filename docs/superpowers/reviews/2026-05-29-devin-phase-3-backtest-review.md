# Phase 3 (Backtest) Code Review — PR #13

**Verdict: GO**

Zero critical. 1 should-fix (~5 min). 3 nice-to-have. All 7 focus areas examined — 5 PASS, 2 produced findings.

Quality gates verified: 426/426 tests pass, typecheck clean, lint 0 errors.

---

## Should-fix (1)

### SF-1 · `extractMetrics` NaN on malformed `max_drawdown_account`

**Severity:** Should-fix
**Location:** `src/features/backtest/backtest-helpers.ts:90`

**Issue:** All other `BacktestComparisonItem` fields are read with optional chaining + `?? null` (lines 91-92), but `max_drawdown_account` uses direct multiplication:

```ts
maxDrawdownPct: comp ? comp.max_drawdown_account * 100 : null,
```

If a real `strategy_comparison[0]` exists but `max_drawdown_account` is missing or not a number (BE's `results` is `additionalProperties:true` — no schema enforcement), this produces `NaN`, which renders as `"NaN%"` in the ResultMetric grid (`BacktestDialog.tsx:281`).

The null-`comp` case is handled (returns `null`), but a partially-filled `comp` is not. The `sharpe` field has the same risk shape but is protected by `comp?.sharpe ?? null`.

**Suggested fix:**

```ts
maxDrawdownPct:
  comp && typeof comp.max_drawdown_account === 'number'
    ? comp.max_drawdown_account * 100
    : null,
```

---

## Nice-to-have (3)

### N-1 · Test fixture `win_rate: 0.617` misrepresents BE convention

**Severity:** Nice-to-have
**Location:** `src/features/backtest/BacktestDialog.test.tsx:66`

**Issue:** The `backtest-helpers.test.ts` fixture correctly uses `win_rate: 44.23` (percentage 0-100, matching documented convention and plan §Background line 60). But the BacktestDialog test fixture uses `win_rate: 0.617` (0-1 ratio). Test passes because `formatWinRate` has a dual-unit heuristic (`v <= 1 → v * 100`), but it's testing a code path that real BE responses won't exercise.

**Suggested fix:** Change to `win_rate: 61.7` — assertion `screen.getByText('61.7%')` stays the same.

### N-2 · Untested error + no-metrics branches in BacktestDialog

**Severity:** Nice-to-have
**Location:** `src/features/backtest/BacktestDialog.test.tsx`

**Issue:** 5 tests cover setup, run, result-with-metrics, cancel, and no-strategy-warning. Not covered:

- **Poll error → setup-with-error-banner** (lines 64-66 + 154-158): `poll.error` causes `setStep('setup')` + error banner. One test would confirm the error→setup transition and banner rendering.
- **No-metrics fallback** (lines 324-341): `step='result' && !metrics` shows "No metrics returned." Effectively dead code in normal flow (poll.done + no error always has poll.item), but would fire if BE returns a terminal status with empty item. A test would pin this safety net.
- **"Run again" flow** (lines 305-309): result → setup reset. Untested transition.

These are simple branches unlikely to break. Not blocking.

### N-3 · Negative stake/wallet values pass client-side validation

**Severity:** Nice-to-have
**Location:** `src/features/backtest/BacktestDialog.tsx:224`

**Issue:** `disabled={submitting || !Number(stake) || !Number(wallet)}` prevents zero, empty, and non-numeric values — but `Number('-100')` = `-100`, `!-100` = `false` → Run button enabled with negative inputs. BE should reject, but a client-side `> 0` guard is cleaner UX.

**Suggested fix:** `disabled={submitting || !(Number(stake) > 0) || !(Number(wallet) > 0)}`

---

## Focus area results

### Focus 1: `extractMetrics` defensive read → **SF-1** (above)

### Focus 2: `useBacktestPoll` cleanup race → **PASS**

Traced rapid `backtestId` change scenario:

1. Effect runs with id=1, `tick()` fires `await backtestApi.get(1)`
2. `backtestId` changes to 2 → cleanup: `cancelled = true`, `clearTimeout(handle)` (handle is null — fetch still in-flight)
3. New effect runs with id=2, resets state, `tick()` fires for id=2
4. Old fetch for id=1 resolves → `if (cancelled) return` → bails out correctly

The `cancelled` flag properly gates all stale state writes. State reset (`setState({ item: null, done: false, error: null })`) runs synchronously before `tick()` — clean transition. When hook disables (backtestId → null), state retains last values (no reset before early return at line 27), which is correct — `BacktestDialog` needs `poll.item` to render metrics in the result step.

### Focus 3: `BacktestDialog` step machine → **PASS**

Traced all transitions:

| From     | Trigger                    | To       | Side effects                          |
| -------- | -------------------------- | -------- | ------------------------------------- |
| setup    | `runBacktest()` succeeds   | running  | `backtestId` set, poll starts         |
| running  | `poll.done && !poll.error` | result   | metrics computed from poll.item       |
| running  | `poll.done && poll.error`  | setup    | error banner shown                    |
| running  | X / overlay click          | (closes) | no cancel; Effect 2 resets on re-open |
| running  | "Cancel and go back"       | (closes) | `backtestApi.cancel()` best-effort    |
| result   | "Run again"                | setup    | backtestId/error cleared              |
| result   | "Done" / X                 | (closes) | Effect 2 resets on re-open            |
| (closed) | re-open                    | setup    | Effect 2 fires: resets all state      |

No loops: Effect 1 only fires when `step='running'` (one-way gate). Effect 2 only fires on `open` change. Both converge on `setup`. No stuck state: `step='result' && !metrics` has fallback UI with "Run again" button.

One design note (not a finding): X button during `running` step closes dialog without calling `backtestApi.cancel()` — only "Cancel and go back" cancels. This is consistent with "best-effort cancel" documentation. Backtest continues as a background job.

### Focus 4: `isBacktestTerminal` regex → **PASS** (low risk)

`/fail|error|cancel/i` against free-form `status` string. Primary terminal check is `completed_at` (line 22) — regex is a fallback for when BE reports failure without setting `completed_at`. A hypothetical status like `"preparing-fallback"` would false-positive (contains "fail"), but:

- The `completed_at` check runs first — correct for all "completed" states
- The regex only matters for error/cancel states where `completed_at` might lag
- False-positive consequence: polling stops early, dialog shows result with possibly incomplete data — preferable to infinite polling
- BE could enum-ise status in the future; current heuristic is pragmatic for untyped field

### Focus 5: Schema-drift sweep → **PASS**

Scanned all 80+ `@default` fields in `BE/openapi.json`. The `@default` → required-in-generated-types gotcha applies to:

- `BacktestJobResponse.status` / `.message` — documented in deviation #1, code provides values
- `BacktestRequest.enable_protections` — FE sends explicit `true`
- `BacktestRequest.backtest_cache` — documented in deviation #1, FE sends `null`

No other `@default` fields exist in `BacktestHistoryItem` (the type FE polls). No new gotcha found beyond what's already patched + documented.

### Focus 6: `BotCard` prop accretion → **PASS**

Mode × prop matrix verified across all 6 modes:

| Mode     | Backtest row              | Lifecycle row      | All handlers wired? |
| -------- | ------------------------- | ------------------ | ------------------- |
| LIVE     | ✅ visible                | Stop + Delete      | ✅                  |
| DRY-RUN  | ✅ visible                | Stop + Delete      | ✅                  |
| PAUSED   | ✅ visible                | Start + Delete     | ✅                  |
| ERROR    | ✅ visible (deviation #2) | Sync + Delete      | ✅                  |
| STARTING | ❌ hidden                 | Spinner (disabled) | ✅                  |
| STOPPING | ❌ hidden                 | Spinner (disabled) | ✅                  |
| Demo     | ❌ hidden (no handler)    | All disabled       | ✅                  |

No unreachable combination. Each handler (`onStart/onStop/onSync/onRemove/onBacktest`) is consumed only in its relevant mode branch — this is by design, not a prop-accretion smell. The `busy` prop correctly disables all action buttons during pending operations.

### Focus 7: `BacktestDialog` test coverage → **N-2** (above)

30 new tests across 5 files cover: API wrapper (4 methods), helpers (presetToTimerange, isBacktestTerminal, extractMetrics, formatWinRate, formatTotalProfit), polling hook (null-id, poll-until-terminal, error), and dialog (setup render, run payload, result metrics, cancel, no-strategy warning). Coverage is good for a 359-line component. The untested branches are small and defensive — see N-2.

---

## No regression against Phase 1

Verified: PR #13 does not touch any Phase 1 code (`src/features/bot-monitoring/`, `useBotStatusPoll`, `ConfirmActionDialog`, lifecycle API). Only additions:

- New `src/features/backtest/` directory (4 source + 4 test files)
- `DashboardPage.tsx`: additive changes only (import, `backtestBot` state, `onBacktest` prop, `BacktestDialog` render, `BotCard` prop addition)
- `src/types/api-helpers.ts`: 4 new type re-exports (additive)
- Mock bots: `strategyName: null` added to existing fixtures (non-breaking — field was already in `DashboardBot` from Phase 1)

---

## Authorised deviations — verified, not re-litigated

1. **`backtest_cache: null` + `BacktestJobResponse.message`** — confirmed correct: `api.d.ts` marks both as required due to `@default` semantics. Code provides values.
2. **Backtest button placement** — confirmed: Phase 1 replaced the edit/pause/stop row. New Backtest row lives above lifecycle row, gated by `onBacktest && mode !== 'STARTING' && mode !== 'STOPPING'`. ERROR mode intentionally allowed. Comment at `DashboardPage.tsx:842-850` documents rationale.
3. **"Run" label + `aria-label="Run backtest"`** — confirmed: avoids clash with dialog title matching `/Backtest/i`. Test uses `getByRole('button', { name: /run backtest/i })` correctly.
