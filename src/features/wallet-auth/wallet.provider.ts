// =============================================================================
// STUB · wallet provider detection + EIP-1193 surface
//
// TODO(wallet-team): replace this entire file with the real Coin98 integration.
// Spec lives in docs/superpowers/specs/2026-05-14-c98-wallet-auth-design.md §3.3.
//
// The interface below is what the rest of the app consumes — keep its shape
// stable when swapping in the real implementation:
//   - detectCoin98(): EthereumProvider | null
//   - requestAccounts(provider): Promise<string[]>
//   - personalSign(provider, message, address): Promise<string>
// =============================================================================

export interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void;
}

/**
 * Detect a Coin98 wallet provider injected on `window`.
 *
 * STUB: returns null so the UI can render the "no Coin98" branch for demo.
 * The stub `connect()` flow in wallet.store.ts bypasses this for the mock path.
 */
export function detectCoin98(): EthereumProvider | null {
  return null;
}

export async function requestAccounts(
  _provider: EthereumProvider,
): Promise<string[]> {
  throw new Error('wallet.provider stub: requestAccounts not implemented');
}

export async function personalSign(
  _provider: EthereumProvider,
  _message: string,
  _address: string,
): Promise<string> {
  throw new Error('wallet.provider stub: personalSign not implemented');
}
