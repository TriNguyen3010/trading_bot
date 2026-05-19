// =============================================================================
// Wallet auth API client.
//
// Delegates to the shared http<T>() wrapper in @/lib/http. At Task 3 time,
// http.ts still attaches the legacy Bearer header — Task 4 swaps it for
// X-Wallet-* headers, which makes getStatus + disconnect properly
// authenticated. The function shapes below stay stable across that swap.
//
// Spec: docs/superpowers/specs/2026-05-14-c98-wallet-auth-design.md §4.
// =============================================================================

import { http } from '@/lib/http';
import type { AuthUser, NonceResponse } from './wallet.types';

export const walletApi = {
  /** Public — no auth headers attached (path is whitelisted in http.ts). */
  getNonce: (address: string) =>
    http<NonceResponse>(
      'GET',
      `/wallet/nonce?address=${address.toLowerCase()}`,
    ),

  /** Authenticated — verifies current credentials + returns user info. */
  getStatus: () => http<AuthUser>('GET', '/user/status'),

  /** Authenticated — best-effort server-side nonce invalidation. */
  disconnect: () => http<{ status: string }>('POST', '/wallet/disconnect'),
};
