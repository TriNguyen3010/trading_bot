// =============================================================================
// Wallet provider — Coin98 detection + low-level EIP-1193 RPC.
//
// Spec: docs/superpowers/specs/2026-05-14-c98-wallet-auth-design.md §3.3.
// =============================================================================

import type { EthereumProvider } from './wallet.types';

export class UserRejectedError extends Error {
  constructor() {
    super('You declined the request from the wallet');
    this.name = 'UserRejectedError';
  }
}

export class NoProviderError extends Error {
  constructor() {
    super('Coin98 wallet not found');
    this.name = 'NoProviderError';
  }
}

interface RpcErrorLike {
  code?: number;
  message?: string;
}

function isUserReject(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as RpcErrorLike).code === 4001
  );
}

/**
 * Detect a Coin98 wallet provider injected on `window`.
 * Checks the official `window.coin98.provider` first, then falls back to
 * the legacy `window.ethereum` injection when it carries the `isCoin98`
 * flag (some older C98 builds expose only this shim).
 */
export function detectCoin98(): EthereumProvider | null {
  const win = window as unknown as {
    coin98?: { provider?: EthereumProvider };
    ethereum?: EthereumProvider & { isCoin98?: boolean };
  };
  if (win.coin98?.provider) return win.coin98.provider;
  if (win.ethereum?.isCoin98) return win.ethereum;
  return null;
}

export async function requestAccounts(
  provider: EthereumProvider,
): Promise<string[]> {
  if (!provider) throw new NoProviderError();
  try {
    const result = (await provider.request({
      method: 'eth_requestAccounts',
    })) as string[];
    // Empty array = wallet locked + user cancelled password prompt.
    // Treat as a rejection so the UI shows the "try again" branch.
    if (!result || result.length === 0) throw new UserRejectedError();
    return result.map((a) => a.toLowerCase());
  } catch (err) {
    if (err instanceof UserRejectedError) throw err;
    if (isUserReject(err)) throw new UserRejectedError();
    throw err;
  }
}

/**
 * Ask the wallet to open its account picker so the user can switch to a
 * different account without having to manually open the extension first.
 *
 * Implements EIP-2255 `wallet_requestPermissions` with the `eth_accounts`
 * permission. MetaMask, Rabby, and most modern wallets respond by showing
 * the account-selection UI. Wallets that don't support EIP-2255 throw
 * `4200` (unsupported method) or similar — we surface that as a normal
 * rejection so the caller can fall back to the regular reconnect flow.
 *
 * 4001 (user rejected) is still surfaced as `UserRejectedError` so the
 * caller can short-circuit cleanly.
 */
export async function requestAccountPicker(
  provider: EthereumProvider,
): Promise<void> {
  if (!provider) throw new NoProviderError();
  try {
    await provider.request({
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }],
    });
  } catch (err) {
    if (isUserReject(err)) throw new UserRejectedError();
    throw err;
  }
}

export async function personalSign(
  provider: EthereumProvider,
  message: string,
  address: string,
): Promise<string> {
  if (!provider) throw new NoProviderError();
  try {
    return (await provider.request({
      method: 'personal_sign',
      params: [message, address],
    })) as string;
  } catch (err) {
    if (isUserReject(err)) throw new UserRejectedError();
    throw err;
  }
}
