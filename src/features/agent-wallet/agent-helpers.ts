import type { EthereumProvider } from '@/features/wallet-auth/wallet.types';
import {
  UserRejectedError,
  NoProviderError,
} from '@/features/wallet-auth/wallet.provider';
import { HttpError } from '@/lib/http';

/** EIP-712 sign_payload từ BE là object opaque. Parse nonce defensively. */
export function extractNonceFromSignPayload(payload: unknown): number {
  if (payload !== null && typeof payload === 'object' && 'message' in payload) {
    const msg = (payload as Record<string, unknown>).message as Record<
      string,
      unknown
    >;
    if (
      msg !== null &&
      typeof msg === 'object' &&
      'nonce' in msg &&
      typeof msg.nonce === 'number'
    ) {
      return msg.nonce as number;
    }
  }
  return 0;
}

/** Format spending limit cap for display. Null → "No limit". */
export function formatSpendingLimit(v: number | null | undefined): string {
  if (v == null) return 'No limit';
  return v >= 1000
    ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : `$${v.toFixed(2)}`;
}

/** Detect Hyperliquid "agent cap full" error.
 * Returns true when the error body/message contains BOTH "too many" AND "agent"
 * (case-insensitive). Handles HttpError (checks .body) and plain Error (.message).
 * Returns false for any non-Error value. */
export function isAgentCapFull(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const text = err instanceof HttpError ? err.body : err.message;
  const lower = text.toLowerCase();
  return lower.includes('too many') && lower.includes('agent');
}

/** Wrap EIP-712 sign request to the wallet provider (Coin98 / window.ethereum).
 * Mirrors personalSign() pattern in wallet.provider.ts but uses
 * eth_signTypedData_v4 method. Throws UserRejectedError if user cancels. */
export async function eip712Sign(
  provider: EthereumProvider,
  walletAddress: string,
  typedData: unknown,
): Promise<string> {
  if (!provider) throw new NoProviderError();
  try {
    return (await provider.request({
      method: 'eth_signTypedData_v4',
      params: [walletAddress, JSON.stringify(typedData)],
    })) as string;
  } catch (err) {
    // Coin98 / EIP-1193 returns code 4001 for user-reject. Inline check
    // mirrors private `isUserReject` in wallet.provider.ts — keep
    // them in sync if the wallet-auth feature changes its reject signal.
    if (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: number }).code === 4001
    ) {
      throw new UserRejectedError();
    }
    throw err;
  }
}
