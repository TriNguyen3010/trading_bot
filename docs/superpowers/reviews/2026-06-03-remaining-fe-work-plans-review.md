# Plan review — Remaining FE work (3 plans, pre-execution)

**Reviewer:** Claude (Opus 4.8) · **Date:** 2026-06-03
**Branch reviewed:** `feat/phase-2b.1-agent-mgmt` @ `88c50a0`
**Verified against:** real codebase + `BE/openapi.json` + Phase 2b code on `claude/inspiring-franklin-a85f4e` (PR #19) + C1 code on `fix/backtest-stake-currency` (PR #20) + `BE/backtest_200.json`.

> Note on review setup: the agent-wallet feature (Phase 2b prerequisite) is **not present** on the review branch — it lives on PR #19 (`claude/inspiring-franklin-a85f4e`). WS1 was verified against that branch's code, as the plan's "Prerequisites" section intends. WS3 was verified against C1 (`fix/backtest-stake-currency`).

## Verdicts

| Plan | Verdict | One-line rationale |
|---|---|---|
| **WS1** — agent mgmt | **NO-GO** | Excellent contract/field accuracy, faithful hook mirror — but `HttpError` is constructed with **3 args** in 2 tests; real signature is 2-arg → typecheck **and** both tests fail as written. Quick fix. |
| **WS2** — remove trading-mode | **GO** | Removal list is complete (all 21 sites mapped), line numbers exact, `tradingModeSchema` correctly left alone. One Should-fix (line-28 import) + nits. |
| **WS3** — backtest trades table | **NO-GO** | Field names perfect, branch base correct — but Task 1 + Task 3.3 still re-implement / re-import / re-declare C1's `quoteCurrencyFromPair` + `currency`; following the steps literally **fails typecheck** in 3 spots. The ⚠️ callout says skip, but the task bodies weren't excised. |

---

## WS1 — `2026-06-03-phase-2b.1-agent-mgmt.md`

### Critical

- **[W1-C1] `HttpError` constructed with 3 arguments — fails typecheck AND both tests fail.**
  `src/lib/http.ts:60` → `constructor(status: number, body: string)` (TWO args; `super(body || \`HTTP ${status}\`)`).
  - **Task 4, Step 4.1** test `'returns true for mixed-case in HttpError body'`: `new HttpError(400, 'Bad Request', '{"detail":"Too Many agents for this wallet"}')`.
  - **Task 7, Step 7.1** test cap-full: `new HttpError(400, 'Bad Request', '{"detail":"Too many extra agents — limit is 3"}')`.
  - With the real 2-arg signature: `body = 'Bad Request'`, the JSON 3rd arg is **dropped**. So `isAgentCapFull` parses `'Bad Request'` → no `"too many"`/`"agent"` → returns `false`; the Task 4 test and (via `state.message`) the Task 7 cap-full test both **fail**. Separately TS reports `Expected 2 arguments, but got 3` → `pnpm typecheck` fails.
  - **Fix:** drop the middle `'Bad Request'` arg → `new HttpError(400, '{"detail":"Too many extra agents — limit is 3"}')`. Then `err.body` = the JSON, `err.message` = the JSON, and detection works (matches the production path `http.ts:217 throw new HttpError(res.status, text)`).

### Important

- **[W1-I1] Task 6, Step 6.1 — module mock isn't a `vi.fn()`, so the "external revoke uses name" test throws.**
  The factory is `vi.mock('./useAgentRevokeFlow', () => ({ useAgentRevokeFlow: () => ({ ... }) }))` — a plain arrow. The test `'calls useAgentRevokeFlow.run with type=external …'` then does `vi.mocked(useAgentRevokeFlow).mockReturnValue(...)`, which throws `mockReturnValue is not a function` (the export is not a mock). Step 6.4's own troubleshooting note assumes it *is* a `vi.fn()`.
  - **Fix:** `useAgentRevokeFlow: vi.fn(() => ({ state: { stage: 'idle' }, run: vi.fn(), reset: vi.fn() }))`.

### Should-fix

- **[W1-S1] Task 7 introduces a *required* prop; the caller fix is in Task 8 → broken intermediate commit.**
  Task 7.3b makes `onManageAgents` **required** on `AgentOnboardingDialogProps`. The sole caller is `LaunchpadModal` (`src/features/launchpad/LaunchpadModal.tsx` + `.test.tsx`), updated only in **Task 8.5**. Task 7.4 runs *only* the dialog test (not `pnpm typecheck`), so the Task 7 commit ships with `LaunchpadModal` missing a required prop → `pnpm typecheck` is red between the Task 7 and Task 8 commits.
  - **Fix:** either make it optional (`onManageAgents?: () => void` + a no-op/guarded fallback), or fold the `LaunchpadModal` prop wiring into Task 7. Also confirm `LaunchpadModal.test.tsx` still compiles (it renders `LaunchpadModal`, which now passes the prop — fine — but double-check it doesn't mount `AgentOnboardingDialog` directly).

### Note / Nice-to-have

- **[W1-N1]** Cap-full detection in the dialog (`isAgentCapFull(new Error(state.message))`, Task 7.3d) is correct in production only because `useAgentSignFlow` stores raw `err.message`, and a production `HttpError.message` = the raw JSON body containing `"too many"`/`"agent"` (verified `http.ts:217`). It's fragile (a future `formatBackendError` pass or BE rewording breaks it silently). The plan's own note + the BE `error_code: "AGENT_CAP_FULL"` follow-up is the real fix. Acceptable for v1.
- **[W1-N2]** `ManageAgentsModal` tags `source: dbEntry ? 'app-managed' : 'external'` (Task 6.3) — any DB-known agent counts as app-managed, including revoked/`is_active:false` ones. Spec phrasing was "found in DB with `is_active:true`". Reasonable and doesn't affect any test; confirm intended.

### Verified correct (no action)

- **All 7 endpoints, path params, request bodies, and 200 shapes match openapi exactly:** `/agent/hyperliquid-wallets` (→ `HyperliquidWalletResponse[]`), `/agent/sync-status` (→ `AgentSyncStatusResponse`), `GET /agent/{agent_id}/revoke-payload` (untyped `{}`), `POST /agent/{agent_id}/revoke` (body `AgentRevokeRequest`, void), `GET /agent/external-revoke-payload?agent_name=` (query default `''`, untyped `{}`), `POST /agent/external-revoke` (body `ExternalRevokeRequest`, void), `POST /bot/rotate-wallet` (→ `BotWalletRotationResponse`).
- **All 6 schema field-name lists in Task 1 match openapi exactly** (`HyperliquidWalletResponse`: `address`,`name`,`valid_until:int|null`; `AgentSyncStatusResponse`; `AgentRevokeRequest`; `ExternalRevokeRequest`; `BotWalletRotationResponse`; `BotWalletRotationResultItem`; `AgentInfoResponse`). No invented fields.
- **Untyped `{}` revoke-payload GETs → `{ sign_payload: unknown }`** (Task 2.3) is the right call — mirrors `AgentPrepareResponse.sign_payload` and matches `extractNonceFromSignPayload(payload: unknown)`.
- **`useAgentRevokeFlow` faithfully mirrors `useAgentSignFlow`:** `eip712Sign(provider, walletAddress, signPayload)` arg order ✓, `extractNonceFromSignPayload` ✓, `detectCoin98`/`UserRejectedError`/`NoProviderError` imports ✓, wallet.store fields (`address,nonce,signature,status,user,error,signingMessage`) ✓, error stage `{message, userRejected}` ✓, test mock pattern identical to `useAgentSignFlow.test.ts` ✓.
- **External revoke correctly carries `HyperliquidWalletResponse.name`** (not `.address`) into `externalRevokePayload(name)` and `ExternalRevokeRequest.agent_name` (Task 5 + Task 6). `agent_name` is non-required in openapi → the always-send is harmless.
- **Cap-full matcher** (`"too many"` AND `"agent"`, case-insensitive over `HttpError.body` JSON `.detail`) is correct against how `http.ts` surfaces errors (raw text body) — once W1-C1 is fixed.
- **`Button` variants/sizes used** (`primary`/`secondary`/`destructive`/`ghost`, `md`/`sm`) all exist; **`AlertCircle` already imported** in `AgentOnboardingDialog`; `ErrorStep` label "Retry" and idle "Generate & Sign" match the test `name:` matchers.

---

## WS2 — `2026-06-03-builder-remove-trading-mode.md`

### Should-fix

- **[W2-S1] Task 3, Step 3 item 1 — "Remove import of `TradingMode` (line 28)" would also delete `MarginMode`.**
  `src/features/bot-builder/steps/BotConfigStep.tsx:28` is `import type { TradingMode, MarginMode } from '@/types/builder.types';`. `MarginMode` is still used. Deleting the whole line breaks it.
  - **Fix:** remove only the `TradingMode` specifier, keep `MarginMode`.

### Note / Nice-to-have

- **[W2-N1]** Task 4, Step 4 narrative-branch rewrite is described loosely ("Adjust the surrounding prose to flow naturally"). Non-blocking — `summary-modes.test.tsx` no longer asserts the prose (the `/dry-run/i` and `/live/i` assertions are removed in Step 1).
- **[W2-N2]** Task 3, Step 2 "confirm it fails" is a **compile** failure (the `tradingMode` field was removed from the type in Task 2), not a runtime red. The plan acknowledges this; it's an acceptable TDD-red but worth knowing the step won't produce a clean assertion failure.
- **[W2-N3]** Task 6, Step 4 grep-zero will **not** be empty — `src/schemas/unified-bot-strategy.schema.ts:65 tradingModeSchema` remains (the BE `trading_mode` spot/margin/futures enum). The plan correctly anticipates this single survivor and tells the implementer it's the only allowed match.

### Verified correct (no action)

- **Removal list is COMPLETE.** All 21 `tradingMode`/`TradingMode` occurrences across 21 files map to a task: types(21,123)→T2; store(26)→T2; serializer(106,112-derived,280,562)→T1; serializer.test(25,189)→T1; BotConfigStep(28,44,45,49,110-113,169,275)→T3; BotConfigSummary(13,25)→T4; summary-modes.test(16)→T4; deploy-summary(108)→T4; risk(27,67)→T4; summarize.test(71,131)→T4; TemplateDetailModal(154)→T5; validateSetup(5,9)→T5; i18n(258)→T5; all **8 catalog files** with **exact** line numbers (breakout 31, conservative-dca 33, cypheus 26, grid-stable 33, macd 31, multi-tf 32, rsi 33, scalping 32). Nothing missed.
- **`tradingModeSchema` (BE `spot|margin|futures`, schema line 65, used as `trading_mode` line 559) is correctly NOT touched** — it's a different concept; confirmed unrelated to the FE toggle.
- **`buildUnifiedPayload.dry_run` derives from `buildBotPayload`** (`serializer.ts:365,377`), so hardcoding `dry_run: true` in `buildBotPayload` (Task 1, line 112) makes the Task 1 test `buildUnifiedPayload(...).dry_run === true` pass. Import-side `dry_run`→`tradingMode` maps dropped at lines 280 & 562; `dry_run_wallet` (288, 572) preserved.
- **Migrations sound:** store persist `v3→v4` deletes `botConfig.tradingMode`; templates `v2→v3` deletes `snap.botConfig.tradingMode`. `launch-actions.ts` left untouched (Launchpad remains mode source of truth) — correct.

---

## WS3 — `2026-06-03-backtest-trades-table.md`

### Important (each **fails typecheck if the task steps are followed literally**)

- **[W3-C1] Task 1 still re-implements + re-tests `quoteCurrencyFromPair`, which already exists from C1.**
  C1 exports it: `fix/backtest-stake-currency:src/features/backtest/backtest-helpers.ts:52` → `export function quoteCurrencyFromPair(pair: string | null | undefined): string`. But:
  - Task 1 **title** says "+ `quoteCurrencyFromPair`";
  - **Step 1.1** writes a full `describe('quoteCurrencyFromPair', …)` block;
  - **Step 1.3** writes `export function quoteCurrencyFromPair(pair: string): string { … }` (note: signature differs — `string` vs `string | null | undefined`);
  - the **Self-Review** table lists it ("Task 1 — Step 1.3").
  Following these literally → **duplicate `export function`** (TS2393 redeclaration) + conflicting signature → typecheck fails; the test block is redundant. The ⚠️ callout says skip, but the body wasn't excised.
  - **Fix:** delete `quoteCurrencyFromPair` from Task 1 entirely — the title, the Step 1.1 `describe` block, the Step 1.3 impl, and the Self-Review row. Keep only `BacktestTrade` + `extractTrades` (and `formatTrade*` in Task 2). `import { quoteCurrencyFromPair } from './backtest-helpers'` where needed.

- **[W3-C2] Task 3, Step 3.3 re-imports `quoteCurrencyFromPair` and re-declares `const currency`, both already in C1's `BacktestDialog`.**
  C1's `BacktestDialog.tsx` already `import { … quoteCurrencyFromPair … } from './backtest-helpers'` (line 13) and already `const currency = quoteCurrencyFromPair(bot.pair);` (line 94). Step 3.3 item 1 ("Import `extractTrades` **and `quoteCurrencyFromPair`**") → duplicate import specifier; item 4 ("Derive currency: `const currency = quoteCurrencyFromPair(bot.pair);` (replaces any prior hard-coded `'USDT'`)") → **duplicate block-scoped `const currency`** (TS2451). There is no "hard-coded `'USDT'`" left to replace.
  - **Fix:** import **only** `extractTrades` (and `formatTradeTime` in Task 4); reuse the existing `currency`; delete Step 3.3 item 4. This matches the ⚠️ callout ("reuse that `currency`").

### Note

- **[W3-N1]** `extractTrades` casts `item.results as { strategy?: Record<string, { trades?: unknown }> } | null | undefined`. Verified `BacktestHistoryItem.results` is `{type: object, additionalProperties: true} | null` (≈ `Record<string, unknown> | null`) — the cast is legal, and every test fixture satisfies all 8 required `BacktestHistoryItem` fields. ✓

### Verified correct (no action)

- **All 12 `BacktestTrade` field names + sample values match `BE/backtest_200.json` exactly:** `open_timestamp` (1777251300000), `close_timestamp` (1777272900000), `open_rate` (78938.0), `close_rate` (79088.0), `profit_abs` (0.97893036), `profit_ratio` (0.00979…), `exit_reason` ('duration_6.0_hours'), `enter_tag` ('ui_enter_long'), `trade_duration` (360), `is_short` (false), `leverage` (10), `pair` ('BTC/USDC:USDC').
- **`formatTradeTime(1777251300000) → "Apr 27 00:55"`** is correct: trade's `open_date` is `2026-04-27 00:55:00+00:00` UTC.
- **Branch base note is right:** "off C1 (`fix/backtest-stake-currency`, PR #20) — NOT plain main." `extractTrades` guards (results null / `strategy` missing / non-array) are correct; `BacktestComparisonItem` local-type pattern is correctly reused for `BacktestTrade`.

---

## Cross-cutting

- **Placeholder scan:** no "TBD" / "add error handling" / undefined-type placeholders in any of the three plans. (WS1 Step 8.5 and WS2 Task 4 narrative have mild "find the existing usage" / "adjust prose" softness — noted above, non-blocking.)
- **Type/name consistency within each plan:** consistent (`AgentRevokeFlowState`, `RevokeTarget`, `MergedAgent`, `BacktestTrade`, stage strings all line up).
- **Spec coverage:** every WS1/WS2/WS3 spec bullet maps to a task (the plans' Self-Review tables are accurate, except the WS3 table over-claims `quoteCurrencyFromPair` as new work — see W3-C1).
- **TDD ordering:** correct (failing test → run → implement → pass → commit) throughout, with two caveats: WS1-S1 (a required-prop commit lands red before its caller fix) and WS2-N2 / WS3 reds that are really *typecheck* reds rather than assertion reds.

## Suggested path to GO
- **WS1:** fix W1-C1 (2-arg `HttpError`, both tests) + W1-I1 (`vi.fn()` mock) + W1-S1 (optional prop or fold caller into Task 7). Then GO.
- **WS2:** apply W2-S1 (keep `MarginMode` on line 28). Already GO; this is a one-word edit.
- **WS3:** excise `quoteCurrencyFromPair` from Task 1 + drop the duplicate import/`const currency` from Task 3.3 (W3-C1, W3-C2). Then GO.
