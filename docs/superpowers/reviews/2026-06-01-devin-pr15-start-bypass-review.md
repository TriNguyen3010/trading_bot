# PR #15 Review — Phase 2a Close Direct-Start Bypass

> **Reviewer:** Devin (round 5 follow-up)  
> **PR:** https://github.com/TriNguyen3010/trading_bot/pull/15  
> **Branch:** `fix/phase-2a-start-bypass` → `main`  
> **Commit:** `baafacd` — plan-only update to `docs/superpowers/plans/2026-05-27-launchpad-dry-live.md`  
> **Scope:** Verify plan fully closes the direct-Start bypass raised in R5 Critical

---

## Verdict: **GO**

Zero critical. 1 should-fix (code snippet type mismatch — ~2 min fix in plan). Test plan adequate.

---

## Bypass Closure Verification

### Surface 1: Dashboard BotCard `onStart` — **CLOSED**

**Before (Phase 1, line 567):**

```tsx
onStart={bot.isDemo ? undefined : () => void doStart(bot.id)}
```

`doStart` → `botApi.start(id)` directly — bypasses Launchpad.

**After (Task 4 Step 2, line 734-738):**

```tsx
onStart={
  bot.isDemo
    ? undefined
    : () => setLaunchBotTarget(toLaunchpadBot(bot))
}
```

All non-demo Start clicks → Launchpad modal. `botApi.start` only fires inside `launchBot()` after user explicitly picks mode.

### Surface 2: Dashboard BotCard `onClick` (whole card) — **CLOSED**

**Before:** All non-demo cards → navigate to monitor.

**After (Task 4 Step 2, line 727-732):** Non-running cards → Launchpad; running cards → monitor. PAUSED bot with `dry_run=false` → Launchpad (not direct start).

### Surface 3: BotMonitoringPage header Start — **CLOSED**

**Before (line 3927):** `onStart={doStart}` → `lifecycleApi.start(safeBotId)` directly.

**After (Task 5b Step 1):** `onStart={handleStartClick}` → `navigate('/dashboard', { state: { launchpadBotId: ... } })` → Dashboard consume effect → Launchpad opens.

### Exhaustive `botApi.start` call-site audit

| File                        | Line          | Call                                             | Status after plan                                                                         |
| --------------------------- | ------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `bot.api.ts`                | 12            | Definition: `start: (id) => http('POST', ...)`   | API definition — unchanged, correct                                                       |
| `DashboardPage.tsx`         | 216           | `botApi.start(id)` inside `doStart`              | **Dead code** — `doStart` no longer wired to any UI handler (N-2)                         |
| `BotMonitoringPage.tsx`     | 3865          | `lifecycleApi.start(safeBotId)` inside `doStart` | **Replaced** — `handleStartClick` wired instead                                           |
| `launch-actions.ts`         | 219 (plan)    | `botApi.start(botId)` inside `launchBot`         | **Gated** — only callable from LaunchpadModal after mode selection                        |
| `bot.api.lifecycle.test.ts` | 19            | `botApi.start(42)`                               | Test-only — verifies API method, not a UI surface                                         |
| `DashboardPage.test.tsx`    | 326, 341, 431 | Test assertions                                  | Plan requires updating line 324 test to assert Launchpad opens, not `botApi.start` called |

**No remaining direct-Start surfaces outside Launchpad flow.**

---

## Findings

### SF-1 · Should-fix · Task 5b Step 1 — `meta.id` wrong type, use `safeBotId`

**Location:** Plan line 890-891 (Task 5b Step 1 code snippet)

**Issue:** The code snippet passes `meta.id` as `launchpadBotId`:

```tsx
const handleStartClick = useCallback(() => {
  navigate('/dashboard', { state: { launchpadBotId: meta.id } });
}, [navigate, meta.id]);
```

Two problems:

1. **Type mismatch:** `BotMeta.id` is `string` (`src/features/bot-monitoring/types.ts:7`). Dashboard consume effect expects `number` (`launchpadBotId?: number`), and `realBots.find((b) => b.id === targetId)` does strict equality — `number === string` → always `false` → **Launchpad silently fails to open**.
2. **Null crash:** `useCallback` runs before the early-return guard at line 3904. When `meta` is null (loading state), `meta.id` throws at hook evaluation time.

The plan's own note (below the snippet) correctly identifies the issue:

> Note: `meta.id` — confirm shape. Use the parsed number id, not the URL string.

But the code contradicts the note. An implementer following the snippet verbatim → silent failure.

**Fix:** Replace the snippet with:

```tsx
const handleStartClick = useCallback(() => {
  if (safeBotId == null) return;
  navigate('/dashboard', { state: { launchpadBotId: safeBotId } });
}, [navigate, safeBotId]);
```

Consistent with existing `doStart`/`doStop`/`doSync` pattern (all use `safeBotId` + null guard). Remove the `meta.id` note (no longer needed).

**Effort:** ~2 min

---

### N-1 · Nice-to-have · Task 4 Step 2 — STARTING/STOPPING `onClick` routes to Launchpad

**Location:** Plan line 727-732 (Task 4 Step 2 `onClick` snippet)

**Issue:** The `onClick` ternary:

```tsx
bot.mode === 'LIVE' || bot.mode === 'DRY-RUN'
  ? () => navigate(`/bots/${bot.id}`)
  : () => setLaunchBotTarget(toLaunchpadBot(bot));
```

STARTING and STOPPING bots fall into the Launchpad branch. Opening Launchpad for a bot mid-transition is confusing (shows Backtest/Dry-run/Live options while bot is already starting/stopping). Edge case: user picks Dry-run in Launchpad → PATCHes `dry_run=true` on a STARTING-live bot → config corruption mid-transition.

**Not a safety issue** — STARTING/STOPPING cards have no Start button (Phase 1's `!isTransition` guard), so the bypass critical path is unaffected.

**Fix:** Add transitions to the monitor route:

```tsx
bot.mode === 'LIVE' ||
bot.mode === 'DRY-RUN' ||
bot.mode === 'STARTING' ||
bot.mode === 'STOPPING'
  ? () => navigate(`/bots/${bot.id}`)
  : () => setLaunchBotTarget(toLaunchpadBot(bot));
```

---

### N-2 · Nice-to-have · `doStart` dead code on DashboardPage after Phase 2a

**Location:** `src/pages/DashboardPage.tsx` lines 212-224

**Issue:** After Phase 2a rewires `onStart` to Launchpad, `doStart` (which calls `botApi.start` directly) is no longer referenced by any UI handler. It's dead code — harmless now, but a future dev might accidentally wire something to it, reopening the bypass.

**Fix:** Remove `doStart` definition from DashboardPage during Phase 2a build. If needed later, the pattern is captured in `launchBot()`.

---

## Test Plan Assessment: **ADEQUATE**

| Test                                              | What it guards                                           | Verdict                                       |
| ------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------- |
| Update Phase 1 T6 test (line 324)                 | Dashboard Start → Launchpad, NOT `botApi.start`          | Critical — plan documents requirement clearly |
| New regression: stopped + `dry_run=false` → Start | Pins the exact bypass scenario                           | Critical — covers the attack vector           |
| New BotMonitoringPage test                        | Stopped Start → navigate `/dashboard` with state         | Critical — covers second surface              |
| Task 6 Step 2 manual smoke (🔒)                   | Network tab: no `POST /bot/{id}/start` without Launchpad | Belt-and-suspenders verification              |

The test plan regression-guards both bypass surfaces (Dashboard + Monitor) with the correct critical assertion: `botApi.start` NOT called directly. The manual smoke checklist with Network tab verification is an excellent addition.

---

## Summary

| #    | Severity     | Finding                                                          | Effort |
| ---- | ------------ | ---------------------------------------------------------------- | ------ |
| SF-1 | Should-fix   | Task 5b `meta.id` → `safeBotId` (type mismatch + null crash)     | 2 min  |
| N-1  | Nice-to-have | STARTING/STOPPING `onClick` → Launchpad (should → monitor)       | 2 min  |
| N-2  | Nice-to-have | `doStart` dead code after Phase 2a (remove to prevent re-bypass) | 5 min  |

**Verdict: GO.** The plan fully closes the direct-Start bypass on all identified surfaces. SF-1 is a plan snippet error that would cause silent failure at runtime — fix before dispatching to implementer.
