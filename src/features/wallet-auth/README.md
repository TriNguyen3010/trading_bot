# `wallet-auth/` — Coin98 wallet authentication

Trading Bot uses **defer-auth UX**: Landing (`/`) is public; clicking `Build a bot` / `Import` / the header wallet chip opens a Radix Dialog that drives the real Coin98 wallet flow (detect → request accounts → fetch nonce → personal_sign → verify via `/user/status`).

> Reference spec: [`docs/superpowers/specs/2026-05-14-c98-wallet-auth-design.md`](../../../docs/superpowers/specs/2026-05-14-c98-wallet-auth-design.md)
> Implementation plan: [`docs/superpowers/plans/2026-05-14-c98-wallet-auth.md`](../../../docs/superpowers/plans/2026-05-14-c98-wallet-auth.md)

---

## What this folder does

1. **Triggers the wallet flow on intent.** Clicking `Build a bot →` or `Import` on Landing calls `useRequireWallet().requireWalletThen(action)` which opens the modal. After a successful sign, `action` runs (navigate to `/builder`, open import dialog, …).
2. **Drives modal state.** `wallet.store.ts` exposes `status: 'idle' | 'detecting' | 'no-c98' | 'connecting' | 'signing' | 'ready' | 'error'`. `ConnectWalletPanel` renders the matching UI for each.
3. **Persists credentials.** On success, writes `{address, nonce, signature}` to `sessionStorage['trading_bot_wallet_auth']`. Survives tab reload, expires on tab close.
4. **Hydrates on boot.** `main.tsx` calls `useWalletStore.getState().hydrate()` before render, then `loadUser()` to refresh the user object.
5. **Listens to wallet events.** `useWalletEvents` (mounted once at app root via `AppBootstrap`) handles `accountsChanged` + `disconnect` — both force a `disconnect()` + redirect to `/`.
6. **Gates protected routes.** `ProtectedRoute` (wallet-auth version) checks `useIsWalletConnected()` (all 3 credential fields). On fail → redirect to `/`.

---

## File layout

| File                        | Responsibility                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `wallet.types.ts`           | Types: `WalletCredentials`, `NonceResponse`, `AuthUser`, `WalletStatus`, `EthereumProvider` (EIP-1193 minimal shape)               |
| `wallet.provider.ts`        | Coin98 detection + EIP-1193 RPC. Exports `detectCoin98`, `requestAccounts`, `personalSign`, `UserRejectedError`, `NoProviderError` |
| `wallet.api.ts`             | BE client. `getNonce(address)`, `getStatus()`, `disconnect()` — all via `@/lib/http`                                               |
| `wallet.store.ts`           | Zustand store + actions. Exports `useWalletStore`, `useIsWalletConnected`, `useWalletAddress`                                      |
| `useWalletEvents.ts`        | Hook listening to `accountsChanged` + `disconnect` events                                                                          |
| `ProtectedRoute.tsx`        | Route guard — redirects to `/` when no creds                                                                                       |
| `ConnectWalletPanel.tsx`    | Modal body — state-driven UI for each `status`                                                                                     |
| `ConnectWalletModal.tsx`    | Radix Dialog wrapper, success toast, post-success action runner                                                                    |
| `RequireWalletProvider.tsx` | Global context — exposes `requireWalletThen` + `openConnect`                                                                       |
| `WalletChip.tsx`            | Header pill — `Connect wallet` / truncated address / `DEV bypass`                                                                  |

---

## `VITE_BYPASS_AUTH` mode

Set `VITE_BYPASS_AUTH=true` in `.env.local` to skip auth for offline dev (working away from the BE network). Short-circuits in 7 places — see spec §7.1. The header chip shows a `DEV bypass` info pill so it's obvious the gate is off.

---

## Testing

53 tests across this folder + `lib/http.test.ts`:

| File                      | Count                                                          |
| ------------------------- | -------------------------------------------------------------- |
| `wallet.provider.test.ts` | 11                                                             |
| `wallet.api.test.ts`      | 3                                                              |
| `wallet.store.test.ts`    | 18 (includes partial-hydrate + `disconnect` event regressions) |
| `useWalletEvents.test.ts` | 8 (includes `disconnect` event handler regression)             |
| `lib/http.test.ts`        | 15                                                             |

Run wallet-auth only:

```bash
pnpm vitest run src/features/wallet-auth src/lib/http.test.ts
```

---

## Adaptations from plan

Plan T8 envisioned a forced-auth `/connect` route. This folder ships defer-auth instead — the wallet modal is mounted globally via `RequireWalletProvider`, so unauth users land on the public Landing and trigger the modal by clicking a CTA / chip. Redirects (401, accountsChanged, ProtectedRoute) all point to `/` instead of `/connect`.
