// =============================================================================
// STUB · wallet auth API calls
//
// TODO(wallet-team): replace stub bodies with real fetch() calls against the BE
// endpoints. Spec: docs/superpowers/specs/2026-05-14-c98-wallet-auth-design.md §4.
//
// Endpoints (per BE):
//   GET  /wallet/nonce?address=<addr>   public, no headers
//   GET  /user/status                    with X-Wallet-* headers
//   POST /wallet/disconnect              with X-Wallet-* headers, empty body
//
// Keep the function shapes stable when swapping the bodies.
// =============================================================================

import type { AuthUser, NonceResponse } from './wallet.types';

export const walletApi = {
  async getNonce(_address: string): Promise<NonceResponse> {
    // STUB: return a deterministic fake message so the modal can display it.
    const nonce = `stub-nonce-${Date.now().toString(36)}`;
    return {
      nonce,
      message: [
        'Sign in to Trading Bot',
        `Nonce: ${nonce}`,
        `Expires: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()}`,
      ].join('\n'),
    };
  },

  async getStatus(): Promise<AuthUser> {
    // STUB: return a fake authed user so the rest of the app can proceed.
    return {
      id: 1,
      email: null,
      wallet_address: '0x4a7c8e2bd3f4a91f6f0ab95cc7e1d3a4b5c6d9f21',
      is_active: true,
      is_admin: false,
    };
  },

  async disconnect(): Promise<void> {
    // STUB: best-effort no-op.
  },
};
