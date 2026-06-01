# Code Review — Phase 2b (Live launch + Agent wallet) — PR #19

**PR:** https://github.com/TriNguyen3010/trading_bot/pull/19
**Branch:** `claude/inspiring-franklin-a85f4e` (11 commits, `f250722` → `a5935fe`)
**Base:** `main`
**Reviewer:** Devin (automated, requested by Tri)
**Date:** 2026-06-01
**Review request:** `docs/superpowers/reviews/2026-06-01-phase-2b-review-request.md`

---

## Verdict: **GO** (conditional — 1 Important, fix ~15 min)

Zero critical. 1 important (double-launch from unstable `onSuccess` effect). 1 should-fix.
2 nice-to-have. Quality gates confirmed: 485/485 tests, typecheck clean, lint 0 errors.
All 7 focus areas examined — 5 PASS, 2 produced findings.

---

## Findings

### I-1 · `onSuccess` useEffect double-fire → cascading `doLaunch` calls

**Severity:** Important
**Location:** `AgentOnboardingDialog.tsx:31-33` + `LaunchpadModal.tsx:85-88`
**Focus area:** #2 (resume-after-onboarding loop)

**Issue:**

The `onSuccess` effect depends on `[state, onSuccess]`:

```tsx
// AgentOnboardingDialog.tsx:31-33
useEffect(() => {
  if (state.stage === 'success') onSuccess(state.agent);
}, [state, onSuccess]);
```

`handleOnboardingSuccess` in `LaunchpadModal` is **not memoized** — it's a plain
function declared in the render body:

```tsx
// LaunchpadModal.tsx:85-88
const handleOnboardingSuccess = () => {
  setOnboardingOpen(false);
  void doLaunch('live');
};
```

Every re-render of `LaunchpadModal` creates a new `handleOnboardingSuccess` reference.
This changes the `onSuccess` prop, which triggers the effect to re-fire while
`state.stage` is still `'success'` (because the reset effect only fires when
`open` becomes `true`, and `open` is `false` after the first `handleOnboardingSuccess`
call).

**Cascade sequence:**

1. Sign flow succeeds → `state = { stage: 'success', agent }`.
2. Effect fires → `handleOnboardingSuccess()` → `setOnboardingOpen(false)` + `void doLaunch('live')` (call **A**).
3. React batches `setOnboardingOpen(false)` + `setBusy('live')` → one re-render.
4. New render → new `handleOnboardingSuccess` ref → `onSuccess` changed → effect
   fires again → `void doLaunch('live')` (call **B**). **Double-launch.**
5. When call A's `finally { setBusy(null) }` triggers another re-render →
   new ref → effect fires again → call **C**. And so on until parent unmounts
   `LaunchpadModal` (via `onOpenChange(false)` + `onLaunched()`).

In practice: minimum 2 `launchBot` calls, potentially more depending on React
scheduling between success and unmount. Each call fires the full
`agentApi.active → update → disableTelegram → start` chain. Multiple `start`
calls may cause duplicate toast messages and unnecessary BE load.

**Suggested fix (pick one):**

**Option A — `useRef` for `onSuccess` (recommended, 3 lines):**

```tsx
// AgentOnboardingDialog.tsx
const onSuccessRef = useRef(onSuccess);
onSuccessRef.current = onSuccess;

useEffect(() => {
  if (state.stage === 'success') onSuccessRef.current(state.agent);
}, [state]); // ← onSuccess removed from deps
```

**Option B — reset on close (2 lines):**

```tsx
useEffect(() => {
  if (open) {
    reset();
    setLimitInput(suggestedLimit != null ? String(suggestedLimit) : '');
  } else {
    reset(); // clear success state so effect can't re-fire
  }
}, [open, reset, suggestedLimit]);
```

Option A is cleaner — it eliminates the root cause (unstable dep) instead of
patching the symptom (stale success state).

---

### SF-1 · `agent.api.test.ts` confirm mock missing required nullable fields

**Severity:** Should-fix
**Location:** `agent.api.test.ts:31-36`
**Focus area:** Schema compliance (cross-cutting)

**Issue:**

The `agentApi.confirm` test mock omits `label` and `spending_limit_usd`:

```ts
mockHttp.mockResolvedValue({
  id: 1,
  agent_address: '0xagent',
  is_active: true,
  spent_today_usd: 0,
  created_at: '2026-05-28T00:00:00Z',
  // missing: label, spending_limit_usd (required nullable per AgentCreateResponse)
});
```

`AgentCreateResponse` schema requires both fields (nullable). The
`useAgentSignFlow.test.ts` mock (line 46-54) correctly includes them. This
test currently passes because `http` is fully mocked and return type isn't
validated, but the fixture silently diverges from the real response shape.

**Fix:** Add `label: null, spending_limit_usd: null` to the mock (1 line).

---

### N-1 · Negative spending limit accepted by FE

**Severity:** Nice-to-have
**Location:** `AgentOnboardingDialog.tsx:43-46`

`handleGenerate` sends the parsed number directly:

```tsx
const limitNum = parseFloat(limitInput);
void run({ spendingLimitUsd: Number.isFinite(limitNum) ? limitNum : null });
```

The `<input type="number" min={0}>` has an HTML `min` attribute, but
`handleGenerate` doesn't check `limitNum >= 0`. The BE rejects via
`minimum: 0.0` validation, so the user sees an error — but FE should
catch this earlier for better UX. Low priority since the BE is the
authoritative validator.

---

### N-2 · No abort pattern in `useAgentSignFlow` for stale async after dialog close

**Severity:** Nice-to-have
**Location:** `useAgentSignFlow.ts:32-95`
**Focus area:** #7 (state leak when closing mid-flow)

When the user closes `AgentOnboardingDialog` during `signing` (wallet popup
pending), the hook's `run()` async chain continues in the background. If the
user re-opens the dialog, the reset effect fires (`open → true → reset()`),
but the old async could race: old `setState({ stage: 'success' })` fires
after reset sets `{ stage: 'idle' }`.

In practice, low risk because:

- Wallet popups are modal — reopening usually replaces the old prompt.
- The reset effect runs on `open=true`, clearing stale state.
- Worst case: a brief flash of success before the new idle.

If hardening: add an `AbortController` or `generationRef` counter pattern
to discard stale runs.

---

## Focus Area Summary

| #   | Focus                              | Result   | Finding                                                                                                                                                     |
| --- | ---------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `launchBot` live ordering          | **PASS** | `agentApi.active()` before all mutations, dry-run skips it, sequential await chain, no interleaving                                                         |
| 2   | Resume-after-onboarding loop       | **I-1**  | `onSuccess` effect double-fires → cascading `doLaunch`                                                                                                      |
| 3   | Read-your-write on `/agent/active` | **PASS** | Comment documents assumption; if BE replica lags, onboarding re-opens (no crash, no infinite loop — reset clears state on re-open)                          |
| 4   | Nonce seam                         | **PASS** | `extractNonceFromSignPayload` matches `auth-architecture.md` §EIP-712 shape (`message.nonce: uint64`); defensive fallback `0` documented as known follow-up |
| 5   | EIP-712 sign params                | **PASS** | `params: [walletAddress, JSON.stringify(typedData)]` correct per EIP-1193; 4001 → `UserRejectedError`, non-4001 → rethrow. Tests cover all 3 paths          |
| 6   | Error UX double-surface            | **PASS** | `/agent/` added to `SILENT_TOAST_PREFIXES`; all modal/dialog error paths own their UX; no `/agent/*` path needs global toast. Test added (`http.test.ts`)   |
| 7   | State leak on close mid-flow       | **N-2**  | Stale async can race with re-opened dialog; low risk, cleanup would be nice                                                                                 |

---

## Verification Checks

### A. OpenAPI Schema Compliance

All 7 agent types in `api-helpers.ts` verified against `BE/openapi.json`:

| Type                         | Fields                                                                                                            | Match |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----- |
| `CreateAgentRequest`         | `label` (string\|null), `spending_limit_usd` (number\|null) — both optional                                       | ✓     |
| `AgentPrepareResponse`       | `agent_address`, `label`, `spending_limit_usd`, `sign_payload` (object, additionalProperties) — all required      | ✓     |
| `AgentConfirmRequest`        | `wallet_address` (42 chars), `agent_address` (42 chars), `signature` (min 130), `nonce` (integer) — all required  | ✓     |
| `AgentCreateResponse`        | `id`, `agent_address`, `label`, `spending_limit_usd`, `spent_today_usd`, `is_active`, `created_at` — all required | ✓     |
| `AgentInfoResponse`          | Same as AgentCreateResponse + optional `revoked_at`                                                               | ✓     |
| `SpendingLimitCheckRequest`  | `amount_usd` (number, exclusiveMinimum 0) — required                                                              | ✓     |
| `SpendingLimitCheckResponse` | `allowed` (boolean), `reason` (string) — both required                                                            | ✓     |

### B. Auth Architecture Nonce Shape

`BE/auth-architecture.md` §"EIP-712 Typed Data Structure" (L142-173) confirms:

```json
"message": {
  "hyperliquidChain": "Mainnet",
  "agentAddress": "0x...",
  "agentName": "My Agent",
  "nonce": 1716100000000   ← uint64 number
}
```

`extractNonceFromSignPayload` path: `payload.message.nonce` (typeof number) — matches.

### C. Regression Check

- **Phase 1 (bot lifecycle):** `doLaunch` calls `launchBot` which preserves `disableTelegram` before `start`. No regression. ✓
- **Phase 2a (dry-run):** Dry-run path unchanged, `agentApi.active()` only called for `mode === 'live'`. No regression. ✓
- **Phase 3 (backtest):** Backtest card in Launchpad unchanged. No regression. ✓
- **Wallet auth (Phase 0):** `eip712Sign` uses `detectCoin98` (correct name), imports `UserRejectedError`/`NoProviderError` from `wallet.provider` (exported). `isUserReject` kept private with inline 4001 check. No code change to wallet-auth files. ✓

### D. Authorised Decisions Verified (not re-litigated)

1. `disableTelegram` in `launchBot` — confirmed present for both modes (L34). ✓
2. `checkLimit` defer — `agentApi.checkLimit` exists with test, not wired. ✓
3. `suggestedLimit` not passed — prop optional, dialog functions. ✓
4. Sibling dialog pattern — `AgentOnboardingDialog` renders as `<>` sibling, not nested inside Radix Root. ✓
5. 4001 inline — matches `isUserReject` logic in `wallet.provider.ts:28-33`, comment present. ✓
6. Inline Vietnamese strings — consistent with existing `wallet-auth`/`bot-monitoring`. ✓

### E. Test Coverage

| File                             | Tests                                                                                          | Coverage                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------ |
| `agent.api.test.ts`              | 5 (create, confirm, active, list, checkLimit)                                                  | All 5 endpoints ✓              |
| `agent-helpers.test.ts`          | 7 (extractNonce ×2, formatLimit ×2, eip712Sign ×4 paths)                                       | Pure functions fully covered ✓ |
| `useAgentSignFlow.test.ts`       | 7 (happy path, user-reject, reset, no-address, no-provider, generic error, signing transition) | State machine + guards ✓       |
| `AgentOnboardingDialog.test.tsx` | 6 (idle render, generate+limit, spinner, onSuccess, continue, error+retry)                     | All steps ✓                    |
| `LaunchpadModal.test.tsx`        | 6 (+3 new: Go Live, AgentNotActiveError→onboarding, resume)                                    | Agent bridge fully covered ✓   |
| `launch-actions.test.ts`         | 7 (+3 new: live+active, live+no-agent, dry-run skips active)                                   | Agent gate ✓                   |
| `http.test.ts`                   | +1 (agent silent toast)                                                                        | SILENT_TOAST_PREFIXES ✓        |

**Total:** ~38 new tests across 7 files. 485/485 pass.

---

## Summary

| Severity     | #   | ID       | Description                                              | Effort  |
| ------------ | --- | -------- | -------------------------------------------------------- | ------- |
| Important    | 1   | I-1      | `onSuccess` useEffect double-fire → cascading `doLaunch` | ~15 min |
| Should-fix   | 1   | SF-1     | Confirm test mock missing `label`, `spending_limit_usd`  | ~2 min  |
| Nice-to-have | 2   | N-1, N-2 | Negative limit FE validation; stale async abort pattern  | —       |

**Action:** Fix I-1 (ref pattern or reset-on-close) before merge. SF-1 fold into same commit.
