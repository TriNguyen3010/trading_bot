# Round 4 — Doc Review: Phase 2b plan + Phase 3 delta + Spec 4/5 + CLAUDE.md §8.3

**Branch:** `feat/bot-lifecycle` (commits `71675d1`, `2da1fc3`)  
**Focus:** Phase 2b plan (NEW — `docs/superpowers/plans/2026-05-28-phase-2b-launchpad-live-agent.md`, 1117 lines, 7 tasks)  
**Method:** Cross-check plan against `BE/openapi.json` (commit `c13fe09`), `src/types/api.d.ts` (generated types), `BE/auth-architecture.md`, and actual source files in `src/features/wallet-auth/`.

---

## Phase 2b Findings

### I-1 · Important · `SpendingLimitCheckRequest/Response` field names WRONG

**File:** `docs/superpowers/plans/2026-05-28-phase-2b-launchpad-live-agent.md` §Background L149-157, Task 2 L303-311

**Plan says:**

```ts
interface SpendingLimitCheckRequest {
  bot_id?: number;
  requested_usd: number;
}
interface SpendingLimitCheckResponse {
  allowed: boolean;
  remaining_usd?: number;
  message?: string;
}
```

**openapi.json says** (L5616-5635, confirmed in `api.d.ts` L3846-3856):

```ts
SpendingLimitCheckRequest: {
  amount_usd: number; // ← NOT requested_usd, NO bot_id field
}
SpendingLimitCheckResponse: {
  allowed: boolean;
  reason: string; // ← required, NOT remaining_usd/message
}
```

**3 mismatches:**

1. Field `requested_usd` → should be `amount_usd`
2. Field `bot_id` does not exist in schema
3. Response has `reason: string` (required) — plan has `remaining_usd?: number` + `message?: string` (both non-existent)

**Impact:** Test L305 `mockResolvedValue({ allowed: true, remaining_usd: 500 })` — wrong field. L306-308 `checkLimit({ requested_usd: 200 })` — wrong field. Both fail typecheck after `pnpm gen:api`.

**Mitigating factor:** Plan L160 marks these as "giả định — implementer verify với gen:api". But test+implementation code uses wrong names — implementer following plan verbatim writes broken code, discovers at typecheck step.

**Fix:** Replace 3 field names in Background schemas + Task 2 test + Task 2 implementation. ~5 min.

---

### I-2 · Important · `getEthereumProvider()` does not exist — actual function is `detectCoin98()`

**File:** Phase 2b plan Task 3 L424-429, Task 4 L526/537-541/572/606/639-640

**Plan imports:**

```ts
import { getEthereumProvider } from '@/features/wallet-auth/wallet.provider';
import { isUserReject } from '@/features/wallet-auth/wallet.provider';
import type { EthereumProvider } from '@/features/wallet-auth/wallet.provider';
```

**Actual `wallet.provider.ts` exports:**

- `detectCoin98()` — this is what the plan calls `getEthereumProvider()`. No function named `getEthereumProvider` exists anywhere in the codebase.
- `isUserReject` is **private** (not exported, L28). Used internally by `personalSign()` and `requestAccounts()` but not available to external modules.
- `EthereumProvider` is exported from `wallet.types.ts` (L30), NOT from `wallet.provider.ts` (only imported there at L7).

**Impact:** 3 broken imports:

1. `getEthereumProvider` → `detectCoin98` (function name wrong)
2. `isUserReject` → not exported (either export it from wallet.provider.ts, or restructure)
3. `EthereumProvider` → import from `@/features/wallet-auth/wallet.types` (not wallet.provider)

**Fix options for `isUserReject`:**

- **(a)** Add `export` keyword to `isUserReject` in `wallet.provider.ts` (1 line change, but modifies existing file)
- **(b)** Move `eip712Sign` into `wallet.provider.ts` alongside `personalSign` (co-locate sibling functions — cleaner, but deviates from plan's file structure)
- **(c)** Duplicate the `code === 4001` check in `agent-helpers.ts` (avoids touching existing file, but violates DRY)

**Recommendation:** Option (a) — minimal, already private impl detail, safe to export.

---

### S-1 · Should-fix · Test mock fixtures missing required nullable fields

**File:** Phase 2b plan Task 4 L559-571, L602-604; Task 5 L901-906

Generated types (`api.d.ts` L1501-1516, L1540-1551) have `label` and `spending_limit_usd` as **required** (always present, can be null):

```ts
AgentCreateResponse: {
  label: string | null; // required, not optional
  spending_limit_usd: number | null; // required, not optional
  // ...
}
AgentPrepareResponse: {
  label: string | null; // required
  spending_limit_usd: number | null; // required
  // ...
}
```

Plan's test mocks omit these fields:

```ts
// Task 4, L565-571: missing label + spending_limit_usd
vi.mocked(agentApi.confirm).mockResolvedValue({
  id: 1,
  agent_address: '0xagent',
  is_active: true,
  spent_today_usd: 0,
  created_at: '...',
});

// Task 4, L559-563: missing spending_limit_usd
vi.mocked(agentApi.create).mockResolvedValue({
  agent_address: '0xagent',
  label: 'main',
  sign_payload: { message: { nonce: 999 } },
});

// Task 4, L602-604: missing label AND spending_limit_usd
// Task 5, L901-906: missing label AND spending_limit_usd
```

**Impact:** `pnpm typecheck` will fail on test files — `mockResolvedValue` expects complete type.

**Fix:** Add `label: null, spending_limit_usd: null` (or appropriate values) to all mock fixtures. ~5 min.

---

### S-2 · Should-fix · Missing `useEffect` import in `AgentOnboardingDialog`

**File:** Phase 2b plan Task 5 L778-809

L778: `import { useState } from 'react';`  
L800/807: uses `useEffect(...)` — not imported.

**Fix:** Change to `import { useState, useEffect } from 'react';`. 1 line.

---

### N-1 · Nice-to-have · Background primaryType label inaccurate

**File:** Phase 2b plan Background L84, L160

Plan shows `primaryType: "ApproveAgent"`.  
`BE/auth-architecture.md` L160 shows: `primaryType: "HyperliquidTransaction:ApproveAgent"`.

**Impact:** Zero — code treats `sign_payload` as opaque (passes to `eth_signTypedData_v4` as-is, only extracts `message.nonce`). This is only a doc accuracy issue in the Background section.

---

### N-2 · Nice-to-have · `formatTotalProfit(0)` renders `'+0.00 USDT'`

**File:** `docs/superpowers/plans/2026-05-27-backtest.md` L504-511

`v=0` → `sign = '+'` → output `'+0.00 USDT'`. Some UIs suppress sign on zero. Cosmetic decision — current behavior is consistent with "always show sign" convention.

---

## §A Verification Summary — Phase 2b

| Check                                | Result       | Notes                                                                                                                                                                                                                                            |
| ------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Agent schemas match openapi.json     | **5/7 PASS** | `CreateAgentRequest`, `AgentPrepareResponse`, `AgentConfirmRequest`, `AgentCreateResponse`, `AgentInfoResponse` ✅. `SpendingLimitCheckRequest/Response` ❌ field names wrong (I-1). Plan warns "giả định".                                      |
| EIP-712 sign realistic               | **PASS**     | `eip712Sign()` correctly mirrors `personalSign()` pattern — same provider.request call structure, correct error handling.                                                                                                                        |
| extractNonceFromSignPayload shape    | **PASS**     | Plan assumes `{ message: { nonce: number } }`. `auth-architecture.md` L167-172 confirms `message: { ..., nonce: 1716100000000 }`. Defensive parse handles unexpected shapes.                                                                     |
| useAgentSignFlow state machine       | **PASS**     | All 6 states (idle/creating/signing/confirming/success/error) needed and used. Error cases handle UserRejected, NoProvider, generic.                                                                                                             |
| AgentNotActiveError race/re-entrancy | **PASS**     | Flow: 1st `handleLive()` → catch → open onboarding → `finally` clears busy → onboarding completes → `handleOnboardingSuccess()` → 2nd `handleLive()` (sequential, no overlap). Safety: 2nd call re-checks `agentApi.active()` before proceeding. |
| 7-task dependency sequencing         | **PASS**     | T1 (types) → T2 (api) → T3 (helpers) → T4 (hook uses T2+T3) → T5 (dialog uses T4) → T6 (integration uses T2+T5) → T7 (smoke).                                                                                                                    |
| wallet.provider imports              | **FAIL**     | 3 broken imports (I-2): function name, private function, wrong type source file.                                                                                                                                                                 |

---

## §B Phase 3 Tightening

| Check                                   | Result   | Notes                                                                                                                 |
| --------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `BacktestComparisonItem` matches sample | **PASS** | `max_drawdown_abs: string` ✅ (noted correctly). `winrate: 0-1 ratio` ✅ (distinct from top-level `win_rate: 0-100`). |
| `extractMetrics` conversion             | **PASS** | `comp.max_drawdown_account * 100` → percentage ✅ (0.0953 → 9.53%). Test asserts `toBeCloseTo(9.53)`.                 |
| `formatTotalProfit` edge cases          | **PASS** | `v=null` → `'—'` ✅. `v=0` → `'+0.00 USDT'` (cosmetic, N-2). Sign logic correct for positive/negative.                |
| Gap 2 resolved annotation               | **PASS** | L57: `total_profit` documented as "absolute USDT/USDC" ✅.                                                            |

---

## §C Spec 4/5 Partial-Unblock Claims

| Claim                                       | Result            | Evidence                                                                                                                                                              |
| ------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1.4 `BotAuditLogOut` typed                 | **✅ CONFIRMED**  | openapi.json L2958-2990: 9 fields (id, bot_id, server_id, request_id, action, triggered_by, result, error_details, timestamp). All properly typed.                    |
| §1.4 `BacktestCandlesResponse` typed        | **✅ CONFIRMED**  | openapi.json L2753 — exists with fields (backtest_id, pair, timeframe, range_start, range_end, candles).                                                              |
| §1.4 `BotStatusOut` from `/restart`         | **✅ CONFIRMED**  | `/bot/{id}/restart` endpoint exists (openapi.json), uses `BotStatusOut` response.                                                                                     |
| §1.5 FE owns local `BacktestComparisonItem` | **✅ REASONABLE** | BE marks `results` as `additionalProperties:true`. FE type derived from sample is pragmatic — no BE schema to depend on.                                              |
| §1.7 Empty endpoints                        | **✅ CONFIRMED**  | 3 endpoints with `"schema": {}`: `/open_trades`, `/db_trades`, `/performance`. Spec correctly frames as 2 functional gaps (open_trades/db_trades serve same purpose). |
| No billing/subscription/payment endpoints   | **✅ CONFIRMED**  | Grep for billing/subscription/payment/checkout/tier/plan in openapi.json returns zero hits. Phase 5 fully blocked.                                                    |

---

## §D CLAUDE.md §8.3 Dialog Convention

| Check                               | Result | Evidence                                                                                                                                                                                                                                                       |
| ----------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wrapper usage matches convention    | **✅** | 10 files import `@/components/ui/dialog` — ConfirmActionDialog, ConnectWalletModal, ConfirmReplaceDialog, TemplatesDialog, TemplateDetailModal, MyBotsDialog, ImportDialog, CreateNewBotButton, BotConfigStep, AddStrategyButton. All utility/confirm dialogs. |
| Primitive usage matches convention  | **✅** | 1 file uses `@radix-ui/react-dialog` directly: `ExportDialog.tsx` (14 imports — 2-pane animate-width bespoke layout).                                                                                                                                          |
| Plan's AgentOnboardingDialog choice | **✅** | Plan correctly uses primitive (`DialogPrimitive`) for 3-step bespoke onboarding modal (L749, L779).                                                                                                                                                            |

---

## Verdict

### Phase 2b: **GO** (conditional on 2 Important + 2 Should-fix)

Plan is structurally sound and TDD-ready. Architecture (feature isolation, hook-driven state machine, error handling) is well-designed. No critical issues. The 4 findings are mechanical fixes (wrong field names, wrong function names, missing imports/fields) — all discoverable at typecheck, none requiring architectural changes.

**Before dispatching implementer:**

- Fix I-1 in plan doc (SpendingLimitCheck fields — 5 min)
- Fix I-2 in plan doc (detectCoin98 + isUserReject export + EthereumProvider import source — 5 min)
- Fix S-1 in plan doc (add nullable fields to mock fixtures — 5 min)
- Fix S-2 in plan doc (add useEffect to import — 1 line)

Alternatively: dispatch implementer with this review as companion doc — implementer can fix during build since typecheck catches all 4.

### Phase 3 delta: **PASS** — no new issues found.

### Spec 4/5: **PASS** — all partial-unblock claims verified correct.

### CLAUDE.md §8.3: **PASS** — convention documented correctly, matches codebase.

---

## Finding Summary

| #   | Severity     | Artifact | Finding                                                                                                                          | Effort   |
| --- | ------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------- | -------- |
| I-1 | Important    | Phase 2b | `SpendingLimitCheckRequest/Response` 3 field name mismatches vs openapi.json                                                     | 5 min    |
| I-2 | Important    | Phase 2b | `getEthereumProvider()` doesn't exist (is `detectCoin98()`), `isUserReject` not exported, `EthereumProvider` wrong import source | 5 min    |
| S-1 | Should-fix   | Phase 2b | Test mocks missing required nullable fields (`label`, `spending_limit_usd`) — 4 locations                                        | 5 min    |
| S-2 | Should-fix   | Phase 2b | Missing `useEffect` import in AgentOnboardingDialog snippet                                                                      | 1 min    |
| N-1 | Nice-to-have | Phase 2b | Background `primaryType` label should be `HyperliquidTransaction:ApproveAgent`                                                   | doc only |
| N-2 | Nice-to-have | Phase 3  | `formatTotalProfit(0)` → `'+0.00 USDT'` — cosmetic sign-on-zero                                                                  | cosmetic |
