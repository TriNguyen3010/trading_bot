# `wallet-auth/` — handoff for the wallet team

Trading Bot UI scaffolds the **defer-auth flow** (user sees app → clicks Build/Import → wallet modal opens). This folder contains the UI shell + stubbed logic. The wallet team owns the **real Coin98 integration** behind the stubs.

> Reference spec: [`docs/superpowers/specs/2026-05-14-c98-wallet-auth-design.md`](../../../docs/superpowers/specs/2026-05-14-c98-wallet-auth-design.md)
> Flow review: [`public/deferred-auth-flow.html`](../../../public/deferred-auth-flow.html)

---

## What this folder does (today, with stubs)

1. **Triggers wallet flow on intent.** Click `Build a bot →` or `Import` on landing → `useRequireWallet().requireWalletThen(action)` opens the modal. After successful "sign", `action` runs (navigate to `/builder`, open import dialog, …).
2. **Drives modal state.** `wallet.store.ts` exposes `status: 'idle' | 'detecting' | 'connecting' | 'signing' | 'ready' | 'error' | 'no-c98'`. The Panel reads it and renders accordingly.
3. **Persists creds.** On success, writes `{address, nonce, signature}` to `sessionStorage["trading_bot_wallet_auth"]`. Survives tab reload.
4. **Hydrates on boot.** `main.tsx` calls `useWalletStore.getState().hydrate()` before render.
5. **Gates protected routes.** `ProtectedRoute` checks `useIsWalletConnected()` (and the legacy email `useAuthStore` during transition). On fail → redirect to `/`.

**Today, `connect()` is a 2-second timeout that returns fake creds** so the flow demos end-to-end without a real wallet.

---

## What you need to swap in

Three files contain the stubs. Replace their bodies; **keep their function signatures**.

### 1. `wallet.provider.ts` — Coin98 detection + EIP-1193 calls

```ts
export interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void;
}

export function detectCoin98(): EthereumProvider | null { /* real impl */ }

export async function requestAccounts(
  provider: EthereumProvider,
): Promise<string[]> { /* real impl */ }

export async function personalSign(
  provider: EthereumProvider,
  message: string,
  address: string,
): Promise<string> { /* real impl */ }
```

Spec §3.3 (detection) and §3.2 step 2-4 (provider calls).

### 2. `wallet.api.ts` — BE calls

```ts
export const walletApi = {
  getNonce(address: string): Promise<{ nonce: string; message: string }> {
    // GET /wallet/nonce?address=<addr>  (public, no headers)
  },

  getStatus(): Promise<AuthUser> {
    // GET /user/status  with X-Wallet-* headers
  },

  disconnect(): Promise<void> {
    // POST /wallet/disconnect  with X-Wallet-* headers, empty body
  },
};
```

Spec §4 + Q1-Q6 in `docs/superpowers/specs/2026-05-14-c98-wallet-auth-design.md` §10.

### 3. `wallet.store.ts` — `connect()` action body

Currently a `setTimeout` chain. Replace with the real sequence (spec §3.2):

```
detectCoin98 → eth_requestAccounts → walletApi.getNonce → personal_sign
            → write sessionStorage → walletApi.getStatus → set status='ready'
```

Handle the rejection cases:
- User rejects connection → `status = 'error'`, `error = 'Bạn đã từ chối kết nối'`
- User rejects sign → `status = 'error'`, `error = 'Bạn đã từ chối ký message'`
- Nonce 400 → `status = 'error'`, `error = 'Địa chỉ ví không hợp lệ'`
- Network → `status = 'error'`, `error = 'Không thể kết nối server'`

`disconnect()` and `loadUser()` already have correct shape — fill in the real fetch calls.

### 4. (Optional) Replace `ConnectWalletPanel.tsx`

The current Panel is a working placeholder. If you ship a polished Coin98 visual:

- **Required contract**: read `useWalletStore((s) => s.status)`, call `useWalletStore((s) => s.connect)`, accept an `onCancel` prop.
- Anything else (illustrations, copy, animations) is yours.

Then remove the "PLACEHOLDER UI" dev-note block at the bottom of the file.

---

## What we (UI side) handle and you should NOT touch

- `ConnectWalletModal.tsx` — Radix Dialog wrapper. UI scaffolding. If you replace it, keep the `{ open, onOpenChange, onSuccess }` contract.
- `RequireWalletProvider.tsx` — provides `requireWalletThen(action)` to the rest of the app. Don't change the public hook signature.
- `WalletChip.tsx` — header chip showing "Connect wallet" / address. UI only.
- `useRequireWallet` hook — call sites: `LandingPage.tsx`. Don't rename.

---

## How to verify your real wiring works

After swapping the stubs:

1. **`pnpm dev`**, open http://127.0.0.1:5173/.
2. Click **`Build a bot →`**.
3. Modal opens → click **`Connect Coin98 Wallet`**.
4. Coin98 popup → approve connection → sign nonce.
5. Modal closes → navigate to `/builder`.
6. **`Application` → `Session Storage`** → key `trading_bot_wallet_auth` exists with real address + sig.
7. Reload page → land back on `/`, header chip shows your truncated address (no re-sign).
8. Click chip → disconnects → chip swaps back to "Connect wallet".

If steps 1-5 work but `/builder` redirects back to `/` → check `useIsWalletConnected()` returning true after `connect()`.

If 401 errors → check `lib/http.ts` is sending `X-Wallet-Address`, `X-Wallet-Nonce`, `X-Wallet-Signature` headers (this swap is **not** in this folder — coordinate with the http.ts owner).

---

## Files in this folder

| File | Owner after handoff | Notes |
|---|---|---|
| `wallet.types.ts` | shared | Add fields if BE shape changes |
| `wallet.provider.ts` | **wallet team** | Replace stub body |
| `wallet.api.ts` | **wallet team** | Replace stub body |
| `wallet.store.ts` | shared | Replace `connect()` body only; rest is fine |
| `ConnectWalletPanel.tsx` | **wallet team** (polish) | Replace placeholder with final visual if desired |
| `ConnectWalletModal.tsx` | UI side | Dialog wrapper, do not change contract |
| `RequireWalletProvider.tsx` | UI side | Public hook, do not change contract |
| `WalletChip.tsx` | UI side | Header chip |
| `README.md` | shared | This doc |

---

## Open questions for the wallet team

1. **Modal contract**: this UI uses a Provider-based pattern (`requireWalletThen` opens a single global modal). Works for your impl, or do you want a Promise-based `openConnectModal(): Promise<Creds | null>` instead?
2. **Coin98 detection poll**: spec says 5×500ms (2.5s). In a modal that feels long. Acceptable to drop to 3×400ms (1.2s)?
3. **HTTP layer**: does the wallet team also own `src/lib/http.ts` rewrite (swap Bearer → X-Wallet-*)? Or split — wallet team for store/provider, UI team for http?
4. **Mobile**: Coin98 mobile deep-link flow not implemented in this scaffold. Phase 2?
