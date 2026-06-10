import type { EthereumProvider } from '@/features/wallet-auth/wallet.types';
import {
  UserRejectedError,
  NoProviderError,
} from '@/features/wallet-auth/wallet.provider';
import { HttpError } from '@/lib/http';

const KNOWN_CHAIN_LABELS: Record<number, string> = {
  42161: 'Arbitrum One',
};

export class WalletChainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletChainError';
  }
}

/** The EIP-712 sign_payload from BE is an opaque object. Parse nonce defensively. */
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
  const text = getErrorText(err);
  if (!text) return false;
  const lower = text.toLowerCase();
  return lower.includes('too many') && lower.includes('agent');
}

function getErrorText(err: unknown): string {
  if (!(err instanceof Error)) return '';
  return err instanceof HttpError ? err.body : err.message;
}

function getBackendDetail(err: unknown): string {
  const text = getErrorText(err);
  if (!text) return '';
  try {
    const parsed = JSON.parse(text) as { detail?: unknown };
    return typeof parsed.detail === 'string' ? parsed.detail : text;
  } catch {
    return text;
  }
}

export function isHyperliquidDepositRequired(err: unknown): boolean {
  const lower = getBackendDetail(err).toLowerCase();
  return (
    lower.includes('must deposit before performing actions') ||
    lower.includes('requires a deposit before creating an agent wallet')
  );
}

export function formatAgentFlowError(err: unknown): string {
  if (isHyperliquidDepositRequired(err)) {
    const detail = getBackendDetail(err);
    const user = /\bUser:\s*(0x[a-fA-F0-9]{40})\b/.exec(detail)?.[1];
    const suffix = user ? ` for wallet ${user}` : '';
    return `Hyperliquid requires a funded account before creating an API/agent wallet. Deposit USDC into Hyperliquid${suffix}, wait until it is credited to perps/cross margin, then try Generate & Sign again.`;
  }
  return getBackendDetail(err) || 'Unknown error';
}

function parseChainId(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const text = raw.trim();
  const parsed = text.startsWith('0x')
    ? Number.parseInt(text, 16)
    : Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatChain(chainId: number | null): string {
  if (chainId == null) return 'unknown chain';
  const label = KNOWN_CHAIN_LABELS[chainId];
  return label ? `${label} (${chainId})` : `chain ${chainId}`;
}

function toHexChainId(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}

export function extractEip712ChainId(typedData: unknown): number | null {
  if (typedData === null || typeof typedData !== 'object') return null;
  const domain = (typedData as Record<string, unknown>).domain;
  if (domain === null || typeof domain !== 'object') return null;
  return parseChainId((domain as Record<string, unknown>).chainId);
}

async function ensureTypedDataChain(
  provider: EthereumProvider,
  typedData: unknown,
): Promise<void> {
  const requiredChainId = extractEip712ChainId(typedData);
  if (requiredChainId == null) return;

  const activeChainId = parseChainId(
    await provider.request({ method: 'eth_chainId' }),
  );
  if (activeChainId === requiredChainId) return;

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: toHexChainId(requiredChainId) }],
    });
  } catch {
    throw new WalletChainError(
      `Your wallet is on ${formatChain(activeChainId)}, but the Hyperliquid signature requires ${formatChain(requiredChainId)}. Please switch network to ${formatChain(requiredChainId)} and try again.`,
    );
  }
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
  await ensureTypedDataChain(provider, typedData);
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
