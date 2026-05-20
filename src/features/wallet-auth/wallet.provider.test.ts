import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectCoin98,
  requestAccounts,
  requestAccountPicker,
  personalSign,
  UserRejectedError,
  NoProviderError,
} from './wallet.provider';
import type { EthereumProvider } from './wallet.types';

function fakeProvider(): EthereumProvider {
  return {
    request: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  };
}

describe('wallet.provider', () => {
  beforeEach(() => {
    delete (window as unknown as { coin98?: unknown }).coin98;
    delete (window as unknown as { ethereum?: unknown }).ethereum;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectCoin98', () => {
    it('returns window.coin98.provider when present', () => {
      const p = fakeProvider();
      (window as unknown as { coin98: { provider: EthereumProvider } }).coin98 =
        { provider: p };
      expect(detectCoin98()).toBe(p);
    });

    it('falls back to window.ethereum when isCoin98=true', () => {
      const p = {
        ...fakeProvider(),
        isCoin98: true,
      } as EthereumProvider & { isCoin98: true };
      (window as unknown as { ethereum: typeof p }).ethereum = p;
      expect(detectCoin98()).toBe(p);
    });

    it('returns null when neither provider exists', () => {
      expect(detectCoin98()).toBeNull();
    });

    it('returns null when only non-C98 window.ethereum exists', () => {
      (window as unknown as { ethereum: EthereumProvider }).ethereum =
        fakeProvider();
      expect(detectCoin98()).toBeNull();
    });
  });

  describe('requestAccounts', () => {
    it('returns lowercase addresses on success', async () => {
      const p = fakeProvider();
      vi.mocked(p.request).mockResolvedValueOnce([
        '0xABCdef0000000000000000000000000000000001',
      ]);
      const result = await requestAccounts(p);
      expect(result).toEqual(['0xabcdef0000000000000000000000000000000001']);
      expect(p.request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
    });

    it('throws UserRejectedError on error code 4001', async () => {
      const p = fakeProvider();
      vi.mocked(p.request).mockRejectedValueOnce({
        code: 4001,
        message: 'User rejected',
      });
      await expect(requestAccounts(p)).rejects.toBeInstanceOf(
        UserRejectedError,
      );
    });

    it('throws UserRejectedError when wallet returns empty accounts (locked / cancelled password)', async () => {
      const p = fakeProvider();
      vi.mocked(p.request).mockResolvedValueOnce([]);
      await expect(requestAccounts(p)).rejects.toBeInstanceOf(
        UserRejectedError,
      );
    });

    it('throws generic Error on other failures', async () => {
      const p = fakeProvider();
      vi.mocked(p.request).mockRejectedValueOnce(new Error('boom'));
      await expect(requestAccounts(p)).rejects.toThrow('boom');
    });
  });

  describe('requestAccountPicker', () => {
    it('calls wallet_requestPermissions with eth_accounts', async () => {
      const p = fakeProvider();
      vi.mocked(p.request).mockResolvedValueOnce([
        { parentCapability: 'eth_accounts' },
      ]);
      await requestAccountPicker(p);
      expect(p.request).toHaveBeenCalledWith({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });
    });

    it('throws UserRejectedError on error code 4001', async () => {
      const p = fakeProvider();
      vi.mocked(p.request).mockRejectedValueOnce({ code: 4001 });
      await expect(requestAccountPicker(p)).rejects.toBeInstanceOf(
        UserRejectedError,
      );
    });

    it('rethrows unsupported-method errors so the caller can fall back', async () => {
      const p = fakeProvider();
      const unsupported = Object.assign(new Error('Method not found'), {
        code: 4200,
      });
      vi.mocked(p.request).mockRejectedValueOnce(unsupported);
      await expect(requestAccountPicker(p)).rejects.toBe(unsupported);
    });
  });

  describe('personalSign', () => {
    it('returns signature on success', async () => {
      const p = fakeProvider();
      vi.mocked(p.request).mockResolvedValueOnce('0xdeadbeef');
      const sig = await personalSign(p, 'hello', '0xabc');
      expect(sig).toBe('0xdeadbeef');
      expect(p.request).toHaveBeenCalledWith({
        method: 'personal_sign',
        params: ['hello', '0xabc'],
      });
    });

    it('throws UserRejectedError on error code 4001', async () => {
      const p = fakeProvider();
      vi.mocked(p.request).mockRejectedValueOnce({ code: 4001 });
      await expect(personalSign(p, 'hello', '0xabc')).rejects.toBeInstanceOf(
        UserRejectedError,
      );
    });

    it('NoProviderError thrown when null provider used', async () => {
      // @ts-expect-error — runtime safety check
      await expect(personalSign(null, 'm', '0x1')).rejects.toBeInstanceOf(
        NoProviderError,
      );
    });
  });
});
