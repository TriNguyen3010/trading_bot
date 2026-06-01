# PR #14 Review — Phase 2a: Launchpad Hub + Dry-Run Launch

> **Reviewer:** Devin  
> **PR:** https://github.com/TriNguyen3010/trading_bot/pull/14  
> **Branch:** `feat/phase-2a-launchpad` → `feat/phase-3-backtest`  
> **Commits:** 6 code + 1 doc (review request)  
> **Plan:** `docs/superpowers/plans/2026-05-27-launchpad-dry-live.md`  
> **Quality gates:** typecheck clean · lint 0 errors · 438/438 tests

---

## Verdict: **GO** (conditional — 1 Critical must-fix before merge)

1 Critical (direct-Start bypass still wired). 1 Should-fix. 2 Nice-to-have. All 7 focus areas examined — 5 PASS, 2 produced findings.

---

## Findings

### C-1 · Critical · `onStart` still calls `botApi.start` directly — bypass NOT closed

**Location:** `src/pages/DashboardPage.tsx:629-631`

```tsx
onStart={
  bot.isDemo ? undefined : () => void doStart(bot.id)
}
```

**Issue:** The `onClick` 3-way router (line 619-627) correctly routes PAUSED/ERROR bots to Launchpad. But the **Start button** on PAUSED cards (BotCard line 981-988) still fires `onStart` → `doStart(bot.id)` → `botApi.start(id)` **directly**, completely bypassing the Launchpad's mode-selection gate.

**Attack vector:** PAUSED bot with `dry_run=false` in stored config (previously Live, now stopped) → user clicks Start button → `botApi.start` fires → bot restarts in LIVE mode without going through Launchpad. User never explicitly picks a mode. When Phase 2b ships, this also bypasses the agent EIP-712 confirmation.

This is the exact bypass that PR #15's plan update (Task 4 Step 2) fixes. PR #14 was built from the original plan before the bypass was identified.

**Fix (from PR #15 plan, Task 4 Step 2 line 734-738):**

```tsx
onStart={
  bot.isDemo
    ? undefined
    : () => setLaunchBotTarget(toLaunchpadBot(bot))
}
```

All non-demo Start button clicks → Launchpad modal → user explicitly picks mode. `botApi.start` only fires inside `launchBot()` after mode selection.

**Note:** `BotMonitoringPage.tsx:3927` has the same bypass (`onStart={doStart}`), addressed by PR #15 Task 5b. That file is not in PR #14's scope (Phase 4 will overhaul it), so not flagged as a PR #14 finding — but it MUST be addressed before Phase 2a is considered fully shipped.

**Effort:** ~5 min (1-line change for Dashboard; BotMonitoringPage fix deferred to PR #15 Task 5b implementation)

---

### SF-1 · Should-fix · `doStart` becomes dead code after C-1 fix — remove to prevent future re-bypass

**Location:** `src/pages/DashboardPage.tsx:270-284`

**Issue:** After applying C-1, nothing in DashboardPage calls `doStart` anymore. It becomes dead code containing a direct `botApi.start(id)` call. A future developer might accidentally wire a new button to `doStart`, re-opening the bypass.

**Fix:** Remove the `doStart` definition entirely from DashboardPage. The PATCH + start sequence is now handled by `launchBot()` in `launch-actions.ts`, which is the only sanctioned start path.

If a "restart in same mode" shortcut is needed later, it should go through `launchBot(id, currentMode)`, not `botApi.start` directly.

**Effort:** ~5 min (remove ~15 lines + verify no references)

---

### N-1 · Nice-to-have · `doLaunch` error UX — modal stays open but no retry affordance

**Location:** `src/features/launchpad/LaunchpadModal.tsx:67-81`

**Issue:** When `doLaunch` fails (e.g., PATCH 4xx, network error):

1. `setError(formatBackendError(err))` → red banner shown
2. `setBusy(null)` → spinner removed, button re-enabled
3. User can click "Start dry-run" again → works as retry

This actually works fine as a retry affordance (button re-enables). The only minor issue: the error banner persists between retries. If the retry succeeds, `setError(null)` is called at the start of `doLaunch`, so the banner clears. All good.

**On review:** PASS — no actual issue, keeping note for completeness.

---

### N-2 · Nice-to-have · Backtest handoff from Launchpad doesn't carry `strategyName` to `BacktestDialog`

**Location:** `src/pages/DashboardPage.tsx:750-759`

**Issue:** When Launchpad's Backtest card is clicked, `onBacktest` creates a `BacktestBot` from `launchBotTarget`:

```tsx
setBacktestBot({
  id: launchBotTarget.id,
  name: launchBotTarget.name,
  strategyName: launchBotTarget.strategyName,
  pair: launchBotTarget.pair,
  timeframe: launchBotTarget.timeframe,
});
```

This does include `strategyName`. But `BacktestBot` (from Phase 3) doesn't have a `strategyName` field — it has `name` only. Let me verify...

Actually, checking the type: `BacktestBot` is `{ id: number; name: string; strategyName: string | null; pair: string; timeframe: string }` from `BacktestDialog.tsx`. So `strategyName` IS included. PASS — no actual issue.

---

## Focus Area Verification

### 1. `launchBot` PATCH-then-start ordering — **PASS**

`launch-actions.ts:14-15`:

```ts
await botStrategyApi.update(botId, { dry_run: mode === 'dry-run' });
return botApi.start(botId);
```

Sequential `await` — start cannot fire before PATCH resolves. If PATCH throws, `start` is never reached (standard Promise rejection propagation). Test at `launch-actions.test.ts:39-43` confirms: PATCH fails → `botApi.start` NOT called.

No timing/interleaving risk — both are simple HTTP calls, no concurrent state.

### 2. `LaunchpadModal` step machine + Live deviation — **PASS**

- `type Step = 'modes' | 'live-confirm'` — wider union retained for Phase 2b.
- `const [, setStep]` — step reader is destructured away (unused). Only `setStep('modes')` called in reset effect (line 58-63). `setStep('live-confirm')` is **never called anywhere**.
- Live card: `disabled` prop on ModeCard (line 168) → `disabled={busy || disabled}` (line 219) → HTML button disabled → `onClick` handler never fires.
- Even if it did fire: `onClick={() => {}}` (line 169) — a no-op, not `doLaunch('live')`.
- `doLaunch('live')` is defined but unreachable from any user gesture in Phase 2a. Dead code, intentionally retained for Phase 2b.

**No path to Live launch exists in Phase 2a.**

### 3. Dashboard `onClick` 3-way router — **PASS (with C-1 caveat)**

Mode × isDemo trace (7 states):

| Mode       | isDemo    | `onClick` target | `onStart` target       | Start button visible?   | Net safety |
| ---------- | --------- | ---------------- | ---------------------- | ----------------------- | ---------- |
| LIVE       | false     | Monitor          | `doStart` (bypass)     | No (mode ≠ PAUSED)      | Safe       |
| DRY-RUN    | false     | Monitor          | `doStart` (bypass)     | No (mode ≠ PAUSED)      | Safe       |
| STARTING   | false     | Monitor          | `doStart` (bypass)     | No (transition spinner) | Safe       |
| STOPPING   | false     | Monitor          | `doStart` (bypass)     | No (transition spinner) | Safe       |
| **PAUSED** | **false** | **Launchpad**    | **`doStart` (bypass)** | **YES**                 | **⚠️ C-1** |
| ERROR      | false     | Launchpad        | `doStart` (bypass)     | No (Sync+Delete shown)  | Safe       |
| Any        | true      | Builder          | `undefined`            | No                      | Safe       |

The `onClick` router is correct for all 7 states. The bypass is exclusively through the `onStart` prop on PAUSED cards (C-1).

No unreachable combinations. No mid-transition Launchpad opens (STARTING/STOPPING correctly route to monitor — Deviation #2 applied correctly).

### 4. `onLaunched` closure capture — **PASS**

```tsx
onLaunched={() => {
  const id = launchBotTarget?.id;
  setLaunchBotTarget(null);
  if (id != null) navigate(`/bots/${id}`);
}}
```

The closure captures `launchBotTarget` at render time. `const id = launchBotTarget?.id` snapshots the value before `setLaunchBotTarget(null)`. React 18 batches state updates, but the `id` local variable is already captured — `setLaunchBotTarget(null)` doesn't affect it.

The async gap between click and `onLaunched` firing (during `launchBot` await) is safe because `launchBotTarget` is only cleared by user actions (close modal, navigate away), and the modal is still open during the await. If user closes modal during the await, `bot` becomes null → component returns null (early exit at line 65) → `onLaunched` still fires from the captured closure but `launchBotTarget` may already be null → `id` is `undefined` → `navigate` not called. Safe.

### 5. Cross-page handoff via `location.state` — **PASS (known trade-off)**

The consume effect (line 229-240) correctly:

1. Guards with `consumedLaunchRef` to prevent double-trigger
2. Waits for `realBots` to load (null check)
3. Searches for the target bot in the fetched list
4. Opens Launchpad only if found
5. Clears history state via `navigate({ replace: true, state: {} })`

Known edge case: if `realBots` fetch completes but the new bot isn't in it (BE filtering, cache, eventual consistency), `state.launchpadBotId` lingers until next `realBots` update or page navigation. Documented in PR description as known follow-up. Acceptable for Phase 2a.

### 6. `consumedLaunchRef` + `navigate({ replace, state: {} })` double-guard — **PASS**

Both guards do useful work:

- **`consumedLaunchRef`**: Prevents re-consumption during the React render cycle between `setLaunchBotTarget(...)` and `navigate({ replace })` taking effect. Also guards against React 18 strict-mode double-invoke in development.
- **`navigate({ replace, state: {} })`**: Clears browser history state so back-button / manual refresh on `/dashboard` doesn't re-trigger.

Neither is dead code. Belt-and-suspenders is justified here.

### 7. Stack PR regression risk (Phase 3 + Phase 2a on DashboardPage) — **PASS**

Phase 3 additions: `backtestBot` state, `onBacktest` handler, `BacktestDialog` mount.
Phase 2a additions: `launchBotTarget` state, `toLaunchpadBot`, onClick router, `LaunchpadModal` mount, post-create consume effect.

Composition verified:

- **State isolation:** `backtestBot` and `launchBotTarget` are independent `useState` hooks — no shared state, no stale closures.
- **Dialog exclusivity:** LaunchpadModal's Backtest card calls `setLaunchBotTarget(null)` BEFORE `setBacktestBot(...)` (line 760 then 752-758). Both closures trigger re-render; on next render LaunchpadModal is closed (`launchBotTarget === null`) and BacktestDialog opens (`backtestBot !== null`). No z-index conflict — mutually exclusive rendering via Radix Portal.
- **No double-mount:** BacktestDialog and LaunchpadModal are sibling mounts at the end of DashboardPage. Both use Radix Portal → rendered in document.body. Only one is open at a time.

---

## Authorised Deviations — Verified

1. **Live card disabled:** Confirmed — `disabled` prop, no-op `onClick`, `setStep('live-confirm')` never called. Correct implementation of SPLIT callout.
2. **STARTING/STOPPING → monitor:** Confirmed — lines 623-626 route transitions to monitor. Avoids Launchpad UX confusion for in-motion bots.
3. **`as LaunchpadBot['mode']` cast in `toLaunchpadBot`:** Confirmed — runtime onClick router guarantees STARTING/STOPPING never reach the mapper (they route to monitor). JSDoc documents the invariant.

---

## Summary

| #       | Severity     | Finding                                                                          | Effort |
| ------- | ------------ | -------------------------------------------------------------------------------- | ------ |
| **C-1** | **Critical** | `onStart` still wired to `doStart` → `botApi.start` directly (bypass NOT closed) | 5 min  |
| SF-1    | Should-fix   | `doStart` dead code after C-1 fix — remove to prevent re-bypass                  | 5 min  |

No regression against Phase 1 (PR #12) or Phase 3 (PR #13). All 3 authorised deviations verified.

**Action required:** Apply C-1 fix (route `onStart` through Launchpad) before merge. This is the same fix documented in PR #15 Task 4 Step 2 — the plan is already correct, the code just needs to implement it.
