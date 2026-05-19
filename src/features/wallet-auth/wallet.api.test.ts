import { describe, it, expect, vi, beforeEach } from 'vitest';
import { walletApi } from './wallet.api';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('walletApi', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockFetch.mockReset();
  });

  it('getNonce calls GET /wallet/nonce with lowercased address', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ nonce: 'abc123', message: 'Sign me' }),
    });

    const result = await walletApi.getNonce(
      '0xABCdef0000000000000000000000000000000001',
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        '/wallet/nonce?address=0xabcdef0000000000000000000000000000000001',
      ),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result).toEqual({ nonce: 'abc123', message: 'Sign me' });
  });

  it('getStatus calls GET /user/status', async () => {
    sessionStorage.setItem(
      'trading_bot_wallet_auth',
      JSON.stringify({ address: '0xabc', nonce: 'n', signature: 's' }),
    );
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 1,
        email: null,
        wallet_address: '0xabc',
        is_active: true,
        is_admin: false,
      }),
    });

    const result = await walletApi.getStatus();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/user/status'),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.wallet_address).toBe('0xabc');
    expect(result.email).toBeNull();
  });

  it('disconnect POSTs to /wallet/disconnect with empty body', async () => {
    sessionStorage.setItem(
      'trading_bot_wallet_auth',
      JSON.stringify({ address: '0xabc', nonce: 'n', signature: 's' }),
    );
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    });

    await walletApi.disconnect();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/wallet/disconnect'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
