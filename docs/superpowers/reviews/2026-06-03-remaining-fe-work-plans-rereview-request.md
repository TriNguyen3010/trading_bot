# Re-review request — Remaining FE work PLANS (round 2, verify fixes)

**Repo:** https://github.com/TriNguyen3010/trading_bot
**Branch:** `feat/phase-2b.1-agent-mgmt`
**Fix commit:** `7332f92` (`docs(plans): apply Devin plan-review fixes …`)
**Round-1 review (your findings):** `docs/superpowers/reviews/2026-06-03-remaining-fe-work-plans-review.md`
**Type:** Verify the round-1 findings are fully resolved and no new issues were introduced. Round-1 verdicts were WS2 = GO, WS1 = NO-GO, WS3 = NO-GO.

## Plans (re-read at `7332f92`)
- WS1: `docs/superpowers/plans/2026-06-03-phase-2b.1-agent-mgmt.md`
- WS2: `docs/superpowers/plans/2026-06-03-builder-remove-trading-mode.md`
- WS3: `docs/superpowers/plans/2026-06-03-backtest-trades-table.md`

## What changed — verify each fix

**WS1 (was NO-GO):**
- **W1-C1 (Critical):** all `HttpError` constructions in Task 4 Step 4.1 + Task 7 Step 7.1 changed from 3-arg to **2-arg** `new HttpError(400, '{"detail":"…"}')` (JSON body as 2nd arg). Verify: matches real `src/lib/http.ts` `constructor(status: number, body: string)` (2-arg, confirmed at line 59); `err.body`/`err.message` now = the JSON, so `isAgentCapFull` matches `"too many"`+`"agent"` and both tests pass; no remaining 3-arg occurrences.
- **W1-I1 (Important):** Task 6 Step 6.1 mock now `useAgentRevokeFlow: vi.fn(() => ({ state:{stage:'idle'}, run: vi.fn(), reset: vi.fn() }))`. Verify `vi.mocked(useAgentRevokeFlow).mockReturnValue(...)` is now valid.
- **W1-S1 (Should-fix):** `onManageAgents` made **optional** (`onManageAgents?: () => void`) with guarded call (`onManageAgents?.()`); Task 7 commit no longer leaves `LaunchpadModal` red before Task 8. Verify: no broken intermediate typecheck; CapFullStep call site is guarded; Task 8 wiring still consistent.

**WS2 (was GO):**
- **W2-S1 (Should-fix):** Task 3 Step 3 now removes only the `TradingMode` specifier and keeps `MarginMode` → `import type { MarginMode } from '@/types/builder.types';`. Verify `MarginMode` usage is preserved.

**WS3 (was NO-GO):**
- **W3-C1 (Important):** `quoteCurrencyFromPair` fully excised from Task 1 — title, the Step 1.1 `describe` block, the Step 1.3 `export function` impl, commit msg, and Self-Review row. Only `BacktestTrade` + `extractTrades` remain in Task 1 (`formatTrade*` in Task 2). Verify no duplicate `export function quoteCurrencyFromPair` remains and Task 1 reads coherently.
- **W3-C2 (Important):** Task 3 Step 3.3 now imports only `extractTrades` (not `quoteCurrencyFromPair`) and **reuses** C1's existing `const currency` (the re-declare item 4 removed). Verify no duplicate import specifier / no duplicate `const currency` (TS2451) when applied on top of C1's `BacktestDialog.tsx`.

## Ask
- Re-issue per-plan **GO / NO-GO**. We expect all three GO now.
- Flag any fix that is incomplete, introduced a new placeholder/inconsistency, or any finding from round 1 not actually addressed.
- The descriptive "Context" paragraph in WS3 Task 1 still mentions `quoteCurrencyFromPair` behavior (prose only, not code) — confirm that's harmless (no code re-adds it).

## Output format
Per plan: GO / NO-GO + 1-line rationale. Any remaining finding: Severity · plan file + task/step · Issue · Fix.
