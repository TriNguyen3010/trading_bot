# PR #16 Review — Deploy Fixes: Unblock Bot Create + Correct Dashboard Status

> **Reviewer:** Devin  
> **PR:** https://github.com/TriNguyen3010/trading_bot/pull/16  
> **Branch:** `claude/heuristic-gauss-272150` → `main`  
> **Commits:** 4 code + 1 merge  
> **Quality gates:** typecheck clean · lint 0 errors · 411/411 tests (50 files)

---

## Verdict: **GO**

Zero critical. 1 should-fix. 2 nice-to-have. All 4 fixes verified correct — proper root-cause analysis, each fix targets the actual failure surface.

---

## Fix Verification

### Fix 1: Stake currency = pair quote (`292fac2`) — **PASS**

**Root cause:** Freqtrade stakes in `stake_currency`. USDT stake on a USDC-quoted pair (Hyperliquid's default) → BE 500. All 7 Hyperliquid templates had USDC pairs with USDT stake.

**Fix scope:**

- `deriveStakeCurrency(uiPair, current)` — auto-aligns on pair change, only when quote is a known stake currency. Correct defensive behavior for unknown quotes.
- `validateBuilder` — adds explicit stake vs quote mismatch error at build time. Safety net.
- 7 templates fixed: `USDT` → `USDC`. All verified to have USDC-quoted pairs. 8th template (`grid-stable-usdt-pairs`) correctly left as `USDT` (pair: `USDC-USDT`, quote=USDT).
- `BotConfigStep.tsx` — `onChange` now calls `patch({ pair, stakeCurrency: deriveStakeCurrency(...) })`. Atomic update prevents intermediate inconsistency.

**Tests:** 3 new tests for `deriveStakeCurrency` (match, unsupported quote, malformed pair) + 3 new tests for `validateBuilder` (mismatch, match, malformed). Coverage thorough.

### Fix 2: `telegram: null` on create (`3b69a4e`) — **PASS**

**Root cause:** Wizard has no telegram fields. FE was sending a telegram block with `token: null` → BE merges into Freqtrade config → process crashes on null token → HTTP 500.

**Fix:** Replace the 17-line telegram block in `buildUnifiedPayload` with `telegram: null`. Matches the known-good create payload pattern. Clean + correct.

**Test:** New assertion: `expect(payload.telegram).toBeNull()`. Simple but sufficient.

### Fix 3: API URL change (`fc82b3f`) — **PASS**

**Root cause:** `tradingbot.ne.com:8088` was the UI, not the API server (was returning 502). Real BE is `ai-gamma-trade-stg.coin98.dev` (HTTPS).

**Changes:**

- `.env.production`: `VITE_API_BASE_URL=https://ai-gamma-trade-stg.coin98.dev`
- `vite.config.ts`: dev proxy target updated + `secure: true` added for HTTPS.

HTTPS also resolves the mixed-content issue (was blocking FE→BE requests from Vercel HTTPS deploy).

**Note:** `CLAUDE.md` §3 and §7 still reference the old URL (`tradingbot.ne.com:8088`). PR description correctly flags this as follow-up (N-1 below).

### Fix 4: Dashboard live status (`614bb4a`) — **PASS**

Three sub-fixes, all targeting real deploy issues:

**4a. Persist `dryRun` on DashboardBot row:**

- Added `dryRun: boolean | null` to `DashboardBot` interface.
- `zipBotsAndConfigs` captures `config?.dry_run ?? null` at load time.
- `updateOneBot` now uses `b.dryRun` instead of inferring from previous mode string.
- **Why needed:** Lifecycle responses (`BotStatusOut`) don't carry `dry_run`. Without persisting it, a freshly-started bot resolves `running + unknown dry_run` → PAUSED instead of DRY-RUN/LIVE.

**4b. `deriveMode` precedence: running > error_message:**

- Moved `if (bot.error_message) return 'ERROR'` AFTER the `status === 'running'` block.
- **Why needed:** Freqtrade logs non-fatal errors (e.g., Telegram polling warnings) while still trading. A stale `error_message` from a previous crash was masking live bots as ERROR.
- Edge case: `running + error_message + config=null` → falls through to ERROR. Acceptable — config-fetch failure is the root issue, and ERROR is a safe default that prompts user to Sync.
- New tests confirm both cases: running+error → LIVE/DRY-RUN; stopped+error → ERROR.

**4c. `pollUntilSettled` + `disableTelegram`:**

- `pollUntilSettled(id)`: polls `botApi.getStatus` every 1.5s (max 40 tries = 60s) until status settles into a terminal state (`running`/`stopped`/`error`). Bounded + cleanup-on-unmount via `mountedRef` + `pollTimers` ref.
- `disableTelegram(id)`: PATCH `/bot/{id}/config` to disable telegram before start/sync. Workaround for Freqtrade crashing on telegram polling when no token is configured.
- Ordering: `disableTelegram` → `start` (sequential await). Test confirms: if `disableTelegram` fails, `start` NOT called.

**Tests:** 3 new DashboardPage tests (start+poll→running, disableTelegram ordering, disableTelegram-fail→no-start) + 2 new `deriveMode` tests + updated existing test assertions. Thorough.

---

## Findings

### SF-1 · Should-fix · `CLAUDE.md` references stale BE URL

**Location:** `CLAUDE.md` §3 (line ~24), §7.1, §7.3

**Issue:** Multiple references to `tradingbot.ne.com:8088` and `localhost:8088`. The real BE is now `ai-gamma-trade-stg.coin98.dev` (HTTPS). Developers reading CLAUDE.md will try the wrong URL.

**Fix:** Update CLAUDE.md references to the new URL. Note that the dev proxy still works (Vite config already updated), so `VITE_API_BASE_URL=/api` in `.env.development` is still correct. Only the raw BE URL references need updating.

**Effort:** ~5 min

---

### N-1 · Nice-to-have · `pollUntilSettled` doesn't deduplicate concurrent polls for the same bot

**Location:** `src/pages/DashboardPage.tsx:253-278`

**Issue:** If a user triggers two lifecycle actions on the same bot before the first poll chain terminates (e.g., Start → immediate Sync), two independent poll chains run concurrently for the same bot. Both call `botApi.getStatus(id)` and `updateOneBot(id, next)`. No data corruption (both see the same status), but doubles the API calls.

In practice, the overlap window is very short: `markPending(id)` disables the button during the action, and mode updates after the action prevent re-triggering. But the poll chain continues independently even after the action completes.

**Fix (if desired):** Track active polls per bot id in a `Map<number, () => void>` and cancel the previous chain when starting a new one.

---

### N-2 · Nice-to-have · Mock data missing `dryRun` field in snapshot tests

**Location:** `src/features/bot-summary/__tests__/__snapshots__/summarize.test.ts.snap`

**Issue:** The snapshot changes are just formatting/whitespace from the `telegram: null` change. However, the mock bots in `MOCK_BOTS` (DashboardPage) now have `dryRun` fields — this is just for internal consistency, not a real issue.

---

## Merge Conflict Note

PR description correctly flags likely conflicts with Phase 3 in:

- `src/pages/DashboardPage.tsx` — Phase 3 adds backtest wiring, PR #16 adds polling + `dryRun` + disableTelegram in the same lifecycle section.
- `src/features/bot-monitoring/bot-list.helpers.ts` — Phase 3 doesn't modify this, but the `dryRun` field on `DashboardBot` will need to be present in Phase 3's `BotCard` mapping.

Recommendation: merge PR #16 into `main` first (it's a deploy fix), then rebase Phase 3 onto the updated main. The conflicts should be straightforward (additive changes in separate sections).

---

## Summary

| #    | Severity     | Finding                                    | Effort |
| ---- | ------------ | ------------------------------------------ | ------ |
| SF-1 | Should-fix   | CLAUDE.md stale BE URL references          | 5 min  |
| N-1  | Nice-to-have | Concurrent poll deduplication              | 15 min |
| N-2  | Nice-to-have | Cosmetic — mock data + snapshot formatting | 0 min  |

All 4 fixes are correct, well-tested, and address real deploy blockers. No regression against Phase 1 code patterns.
