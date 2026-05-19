# Round 3 — Implementation Audit: C98 Wallet Auth (`feat/wallet-auth`)

> **Reviewer:** Devin (AI)
> **Date:** 2026-05-19
> **Branch:** `feat/wallet-auth` (22 commits ahead of `main` at `b3d8b2f`)
> **Scope:** Implementation code vs. spec + plan (10 audit points)
> **Stats:** 34 files changed, +3306 / −512

---

## Build & Test Results

| Command | Result |
|---------|--------|
| `pnpm typecheck` | ✅ Clean |
| `pnpm lint` | ✅ 0 errors, 5 warnings (all acceptable — see §Nice-to-have N3) |
| `pnpm test` | ✅ **321/321 pass** (0 failures) |
| Wallet-auth specific (`vitest run src/features/wallet-auth src/lib/http.test.ts`) | ✅ **53/53 pass** (provider 11, api 3, store 17, events 7, http 15) |

---

## Critical (must fix before merge)

**(none)**

No critical security or correctness bugs found. The implementation is solid.

---

## Important (should fix this PR)

### I1. `WalletChip.tsx:45` — `void disconnect()` is fire-and-forget

**File:** `src/features/wallet-auth/WalletChip.tsx:45`

```tsx
onClick={() => void disconnect()}
```

**What's wrong:** The `void` operator discards the Promise — `disconnect()` is NOT awaited. Spec §6.3 line 410 says:

> *"Caller (**useWalletEvents**, **HeaderToolbar** logout button) **bắt buộc await** `disconnect()` trước khi `window.location.href` / `navigate(...)`"*

WalletChip is a third caller not listed in the spec. In the current architecture it's *accidentally safe*: ProtectedRoute fires a **soft** React Router `<Navigate>` (not `window.location.href`) only after `disconnect()` clears state (which happens **after** the BE call). So the in-flight fetch isn't killed.

**Why Important, not Critical:** The BE nonce deletion DOES complete before navigation in practice. But the safety relies on an indirect chain (zustand set → React re-render → Navigate) rather than an explicit `await`. If anyone adds `window.location.href = '/'` after this line, the security bug (24h nonce reuse) instantly returns.

**Fix:**
```tsx
onClick={async () => {
  await disconnect();
}}
```

---

### I2. `RequireWalletProvider.tsx:43-44` — 2-field check, should be 3

**File:** `src/features/wallet-auth/RequireWalletProvider.tsx:43-44`

```tsx
const isConnected = useWalletStore(
  (s) => !!s.address && !!s.signature,
);
```

**What's wrong:** Checks only `address` + `signature`, missing `nonce`. Every other auth-check in the codebase uses 3 fields:
- `useIsWalletConnected` (wallet.store.ts:226): `!!s.address && !!s.nonce && !!s.signature`
- `http.ts getWalletCreds()` (line 103): `if (!parsed.address || !parsed.nonce || !parsed.signature) return null`

If a partial state ever occurs (address + signature present, nonce missing), `requireWalletThen()` would run the action immediately instead of opening the modal. The action's API call would then fail (http.ts sees incomplete creds → no headers → 401).

**Why Important:** Not a security issue (request fails server-side), but a UX bug — user sees a 401 toast + redirect instead of the connect modal.

**Fix:**
```tsx
const isConnected = useWalletStore(
  (s) => !!s.address && !!s.nonce && !!s.signature,
);
```

---

### I3. `WalletChip.tsx:18` — Same 2-field inconsistency

**File:** `src/features/wallet-auth/WalletChip.tsx:18`

```tsx
const isConnectedReal = !!address && !!signature;
```

**What's wrong:** Same pattern as I2 — missing `nonce` check. Used to decide which chip variant to render (connected vs. connect button). Lower impact than I2 because it's purely visual, but should be consistent.

**Fix:**
```tsx
const nonce = useWalletStore((s) => s.nonce);
const isConnectedReal = !!address && !!nonce && !!signature;
```

---

### I4. `README.md` — Stale references (3 items)

**File:** `src/features/wallet-auth/README.md`

| Line | Issue |
|------|-------|
| 18 | *"Today, `connect()` is a 2-second timeout that returns fake creds"* — stale. Real implementation replaced the stub. |
| 16 | *"the legacy email `useAuthStore` during transition"* — `useAuthStore` deleted in Task 11. No transition needed. |
| 5 | References `public/deferred-auth-flow.html` — verify this file still exists and is relevant. |

**Fix:** Update README to reflect that stubs have been replaced with real Coin98 integration. Remove `useAuthStore` mention.

---

### I5. `ConnectWalletPanel.tsx:186-191` — PLACEHOLDER dev note left in production code

**File:** `src/features/wallet-auth/ConnectWalletPanel.tsx:186-191`

```tsx
<div className="rounded-md border border-dashed border-info/40 bg-info/5 px-3 py-2 text-2xs leading-relaxed text-info">
  <span className="font-semibold">PLACEHOLDER UI</span> · final visual +
  real wallet logic owned by external team. Stub <code>connect()</code>{' '}
  plays detect → connecting → signing → ready over ~3.2s for end-to-end
  demo.
</div>
```

**What's wrong:** The real `connect()` implementation is done (detect → requestAccounts → getNonce → personalSign → getStatus). This dev note describes the old stub behavior and will confuse users in production.

**Fix:** Remove the entire `<div>` block, or gate it behind `import.meta.env.DEV`.

---

## Nice-to-have (follow-up issue OK)

### N1. Missing test: `useWalletEvents` — `disconnect` event handler untested

**File:** `src/features/wallet-auth/useWalletEvents.test.ts`

**What's missing:** Tests cover `accountsChanged` (3 scenarios: different address, empty array, same address) but the `disconnect` event handler (useWalletEvents.ts:55-58) has no dedicated test. The handler has the same await + redirect pattern as `accountsChanged`, so correctness is likely — but an explicit test would guard against regression.

**Suggested test:**
```ts
it('on disconnect event → disconnect + redirect to /', async () => {
  const disconnectSpy = vi
    .spyOn(useWalletStore.getState(), 'disconnect')
    .mockResolvedValueOnce();
  renderHook(() => useWalletEvents());

  await onHandlers.disconnect();

  expect(disconnectSpy).toHaveBeenCalled();
  expect(window.location.href).toBe('/');
});
```

---

### N2. Missing test: `hydrate()` with partial JSON (2 of 3 fields)

**File:** `src/features/wallet-auth/wallet.store.test.ts`

**What's missing:** Tests cover: valid 3-field JSON (pass), empty storage (pass), malformed JSON (pass). No test for JSON with only 2 fields, e.g. `{ address: '0x', nonce: 'n' }` (missing signature). The code handles this correctly at line 82 (`if (parsed.address && parsed.nonce && parsed.signature)`), but there's no test exercising this branch.

**Suggested test:**
```ts
it('ignores partial credentials (missing signature)', () => {
  sessionStorage.setItem(
    'trading_bot_wallet_auth',
    JSON.stringify({ address: '0xabc', nonce: 'n' }),
  );
  useWalletStore.getState().hydrate();
  expect(useWalletStore.getState().status).toBe('idle');
});
```

---

### N3. `main.tsx:16` — react-refresh lint warning

**File:** `src/main.tsx:16`

```
src/main.tsx:16:10 warning  Fast refresh only works when a file has exports.
Move your component(s) to a separate file  react-refresh/only-export-components
```

**Assessment:** `main.tsx` is the entry point — it's never hot-reloaded by Vite's HMR. The warning is harmless. Extracting `AppBootstrap` to a separate file (e.g., `src/features/wallet-auth/AppBootstrap.tsx`) would silence it but adds a file for no functional benefit.

**Verdict:** Acceptable as-is. Extract only if the team prefers zero warnings.

---

### N4. `errorLabel()` — mixed English/Vietnamese

**File:** `src/features/wallet-auth/ConnectWalletPanel.tsx:238-247`

Labels are English (`'Signature rejected'`, `'Wallet not found'`, `'Account disabled'`) while error messages are Vietnamese. This is a design choice (title in English for UI consistency, body in Vietnamese for user-facing detail). Not a bug, but verify this matches the team's i18n strategy.

---

## Verified ✓

### V1. Credential lifecycle ✅

| Check | Status | Evidence |
|-------|--------|----------|
| sessionStorage key = `trading_bot_wallet_auth` | ✅ | wallet.store.ts:12, http.ts:82 |
| Shape: 3 fields (address, nonce, signature) | ✅ | writeStorage():36-40, getWalletCreds():98-108 |
| Address lowercase | ✅ | wallet.provider.ts:63 `result.map(a => a.toLowerCase())`, wallet.api.ts:20 `address.toLowerCase()` |
| Hydrate validates all 3 fields present | ✅ | wallet.store.ts:82 |
| Hydrate handles malformed JSON | ✅ | wallet.store.ts:90-92 (catch → idle) |
| `useIsWalletConnected` checks all 3 fields | ✅ | wallet.store.ts:226 |
| `clearStorage` removes key | ✅ | wallet.store.ts:49 |
| All clear sites reset properly | ✅ | `disconnect()`:172-188, `reset()`:200-211, 401 in http.ts:160-163, connect error:155-166, connect start:105-112 |
| No partial state slip | ✅ | connect() clears all 3 at start (line 108-110), error catch clears all 3 (157-160) |

---

### V2. `connect()` chain ✅

| Check | Status | Evidence |
|-------|--------|----------|
| `getStatus()` called DIRECTLY (not via loadUser) | ✅ | wallet.store.ts:134 `await walletApi.getStatus()` |
| f56ecaf bug fix preserved | ✅ | If getStatus throws → catch clears all → status='error', never 'ready' |
| `is_active=false` defensive check | ✅ | wallet.store.ts:140-152 |
| All error paths → status='error' + clear | ✅ | 7 test cases verify: 403, 401, network, user reject connect, user reject sign, getNonce fail, is_active=false |
| Stale creds cleared at flow START | ✅ | wallet.store.ts:108-110 sets address/nonce/signature to null |

---

### V3. `disconnect()` await semantics ✅ (2/3 callers; WalletChip flagged I1)

| Caller | Awaits? | Navigation type | Safe? |
|--------|---------|----------------|-------|
| HeaderToolbar.tsx:150-152 | ✅ `await disconnect()` | `navigate('/', { replace: true })` (soft) | ✅ |
| useWalletEvents.ts:50, :56 | ✅ `await disconnect()` | `window.location.href = '/'` (hard) | ✅ |
| WalletChip.tsx:45 | ❌ `void disconnect()` | None (ProtectedRoute `<Navigate>`, soft) | ⚠️ See I1 |

---

### V4. `http.ts` 403 handling ✅

| Check | Status | Evidence |
|-------|--------|----------|
| 403 → pass-through `{detail}` from BE | ✅ | http.ts:174-177 parses JSON, extracts `data.detail` |
| 403 → fallback raw text | ✅ | http.ts:178-179 `if (text.trim()) msg = text` |
| 403 → fallback default Vietnamese | ✅ | http.ts:173 `'Quyền truy cập bị từ chối.'` |
| Silent-toast prefixes skip 403 toast | ✅ | http.ts:80 + 171 `if (!silentToast)` |
| 401 → clear + redirect + warning toast | ✅ | http.ts:159-163 |
| 401 ≠ 403 (no cross-contamination) | ✅ | Separate `if` blocks, different behavior |
| 403 does NOT clear creds | ✅ | No `clearWalletAuth()` in 403 block |
| 403 does NOT redirect | ✅ | No `window.location.href` in 403 block |

---

### V5. XSS risk — no new attack surface ✅

| Check | Status | Evidence |
|-------|--------|----------|
| No console.log leaking credentials | ✅ | grep confirmed: 0 matches for `console.(log|warn|info|error|debug).*(address|nonce|signature|cred|wallet)` |
| No localStorage migration | ✅ | All wallet auth in sessionStorage only |
| No signature in URL params | ✅ | Creds only in headers (`X-Wallet-*`) |
| 24h window unchanged | ✅ | No new code path widens the accepted risk from spec §14.1 |

---

### V6. Redirect targets ✅

| Check | Status | Evidence |
|-------|--------|----------|
| No `/connect` route in code | ✅ | routes.tsx has no `/connect` path |
| All redirects point to `/` | ✅ | ProtectedRoute:18, http.ts:162, useWalletEvents:51+57, HeaderToolbar:152 |
| `/connect` only in comments | ✅ | grep shows 4 matches — all in code comments explaining the adaptation |
| api.d.ts `/exchange/connect` | ✅ | Unrelated BE endpoint, not auth |

---

### V7. `VITE_BYPASS_AUTH` consistency ✅

All 7 bypass points work coherently:

| Layer | File:Line | Behavior |
|-------|-----------|----------|
| ProtectedRoute | ProtectedRoute.tsx:17 | `!BYPASS_AUTH && !isAuthenticated` → passes through |
| http.ts headers | http.ts:133 | `creds && !isPublic && !BYPASS_AUTH` → no auth headers sent |
| http.ts 401 | http.ts:159 | `res.status === 401 && !BYPASS_AUTH` → skip clear+redirect |
| RequireWalletProvider | RequireWalletProvider.tsx:52 | `BYPASS_AUTH \|\| isConnected` → runs action, no modal |
| RequireWalletProvider openConnect | RequireWalletProvider.tsx:65 | `BYPASS_AUTH` → no-op |
| useIsWalletConnected | wallet.store.ts:226 | `BYPASS_AUTH \|\|` → always true |
| WalletChip | WalletChip.tsx:23 | Shows "DEV bypass" badge |
| useWalletEvents | useWalletEvents.ts:35 | `BYPASS_AUTH` → early return, no listeners |
| Test setup | setup.ts:8 | `vi.stubEnv('VITE_BYPASS_AUTH', 'false')` → tests use real auth |

End-to-end in bypass mode: user navigates all protected routes without wallet, no BE calls, no crash. ✅

---

### V8. Test coverage ✅

53 wallet-auth tests across 5 files — no *critical* gaps:

| File | Tests | Coverage |
|------|-------|----------|
| wallet.provider.test.ts | 11 | detectCoin98 (4), requestAccounts (4), personalSign (3) |
| wallet.api.test.ts | 3 | getNonce, getStatus, disconnect |
| wallet.store.test.ts | 17 | hydrate (3), connect (8), disconnect (2), loadUser (2), + f56ecaf regression guard, is_active defensive |
| useWalletEvents.test.ts | 7 | attach/detach, accountsChanged (3 scenarios), no provider, late injection |
| http.test.ts | 15 | headers, public path, 401, 403 (3 shapes), silent toast (2), 422, normalization (4) |

Minor gaps flagged as N1 (disconnect event untested) and N2 (partial hydrate untested).

---

### V9. Old auth deleted cleanly ✅

| Check | Status | Evidence |
|-------|--------|----------|
| `src/features/auth/` removed | ✅ | 6 files deleted (LoginPage, ProtectedRoute, auth.api, auth.store, auth.store.test, auth.types) |
| No `useAuthStore` references in code | ✅ | grep: 0 matches in `src/` |
| No `LoginPage` references | ✅ | grep: 0 matches in `src/` |
| No `/login` route | ✅ | routes.tsx has no `/login` path |

---

### V10. Defer-auth UX satisfies security model ✅

**Spec §3 + §14 compliance analysis:**

The plan assumed a **forced-auth UX** (every unauth route redirects to `/connect`). The implementation ships a **defer-auth UX** (Landing is public; CTAs trigger a modal).

| Security concern | Forced-auth (plan) | Defer-auth (implementation) | Equivalent? |
|-----------------|--------------------|-----------------------------|-------------|
| Auth flow (detect → request → sign → verify) | Same | Same | ✅ |
| Creds stored in sessionStorage | Same | Same | ✅ |
| ProtectedRoute blocks unauth | Redirect `/connect` | Redirect `/` | ✅ (different target, same gate) |
| 401 clears + redirects | To `/connect` | To `/` | ✅ |
| accountsChanged clears + redirects | To `/connect` | To `/` | ✅ |
| disconnect() awaited before navigate | Same | Same (2/3 callers; I1 flagged) | ✅ |
| No dangling state after redirect | `/connect` is unauth page | `/` is Landing (public) | ✅ |

**Conclusion:** The defer-auth UX is a UX-layer adaptation. The security model (what is gated, how creds flow, when they're cleared) is identical. No security regression.

---

## Summary

| Category | Count | Items |
|----------|-------|-------|
| Critical | 0 | — |
| Important | 5 | I1 (WalletChip void disconnect), I2 (RequireWalletProvider 2-field), I3 (WalletChip 2-field), I4 (README stale), I5 (placeholder note) |
| Nice-to-have | 4 | N1 (disconnect event test), N2 (partial hydrate test), N3 (main.tsx lint), N4 (mixed language labels) |
| Verified | 10 | V1-V10 |

**Overall assessment:** Implementation is high quality and matches the spec+plan intent. No critical bugs. The 5 Important items are straightforward fixes (1-line code changes + README update). Ready to merge after addressing I1-I5.
