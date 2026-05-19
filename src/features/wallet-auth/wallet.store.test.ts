import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWalletStore } from './wallet.store';

vi.mock('./wallet.api', () => ({
  walletApi: {
    getNonce: vi.fn(),
    getStatus: vi.fn(),
    disconnect: vi.fn(),
  },
}));

vi.mock('./wallet.provider', async () => {
  const actual =
    await vi.importActual<typeof import('./wallet.provider')>(
      './wallet.provider',
    );
  return {
    ...actual,
    detectCoin98: vi.fn(),
    requestAccounts: vi.fn(),
    personalSign: vi.fn(),
  };
});

import { walletApi } from './wallet.api';
import {
  detectCoin98,
  requestAccounts,
  personalSign,
  UserRejectedError,
} from './wallet.provider';
import type { EthereumProvider } from './wallet.types';

const fakeProvider: EthereumProvider = {
  request: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
};

function resetStore() {
  useWalletStore.setState({
    address: null,
    nonce: null,
    signature: null,
    user: null,
    status: 'idle',
    error: null,
    signingMessage: null,
  });
}

describe('wallet.store', () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetStore();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hydrate', () => {
    it('loads credentials from sessionStorage', () => {
      sessionStorage.setItem(
        'trading_bot_wallet_auth',
        JSON.stringify({ address: '0xabc', nonce: 'n', signature: 's' }),
      );

      useWalletStore.getState().hydrate();

      const s = useWalletStore.getState();
      expect(s.address).toBe('0xabc');
      expect(s.nonce).toBe('n');
      expect(s.signature).toBe('s');
      expect(s.status).toBe('ready');
    });

    it('leaves state idle when sessionStorage is empty', () => {
      useWalletStore.getState().hydrate();
      expect(useWalletStore.getState().status).toBe('idle');
      expect(useWalletStore.getState().address).toBeNull();
    });

    it('handles malformed JSON without crashing', () => {
      sessionStorage.setItem('trading_bot_wallet_auth', 'not-json');
      useWalletStore.getState().hydrate();
      expect(useWalletStore.getState().status).toBe('idle');
    });

    it('ignores partial credentials (missing signature)', () => {
      sessionStorage.setItem(
        'trading_bot_wallet_auth',
        JSON.stringify({ address: '0xabc', nonce: 'n' }),
      );
      useWalletStore.getState().hydrate();
      expect(useWalletStore.getState().status).toBe('idle');
      expect(useWalletStore.getState().address).toBeNull();
    });
  });

  describe('connect', () => {
    it('happy path: detects → requests accounts → fetches nonce → signs → saves creds → verifies via /user/status', async () => {
      vi.mocked(detectCoin98).mockReturnValue(fakeProvider);
      vi.mocked(requestAccounts).mockResolvedValueOnce(['0xabc']);
      vi.mocked(walletApi.getNonce).mockResolvedValueOnce({
        nonce: 'n1',
        message: 'Sign me',
      });
      vi.mocked(personalSign).mockResolvedValueOnce('0xsig');
      vi.mocked(walletApi.getStatus).mockResolvedValueOnce({
        id: 1,
        email: null,
        wallet_address: '0xabc',
        is_active: true,
        is_admin: false,
      });

      await useWalletStore.getState().connect();

      const s = useWalletStore.getState();
      expect(s.address).toBe('0xabc');
      expect(s.nonce).toBe('n1');
      expect(s.signature).toBe('0xsig');
      expect(s.user?.wallet_address).toBe('0xabc');
      expect(s.status).toBe('ready');

      const stored = JSON.parse(
        sessionStorage.getItem('trading_bot_wallet_auth')!,
      );
      expect(stored).toEqual({
        address: '0xabc',
        nonce: 'n1',
        signature: '0xsig',
      });
    });

    it('clears storage + error state when /user/status returns 403 (bad sig)', async () => {
      vi.mocked(detectCoin98).mockReturnValue(fakeProvider);
      vi.mocked(requestAccounts).mockResolvedValueOnce(['0xabc']);
      vi.mocked(walletApi.getNonce).mockResolvedValueOnce({
        nonce: 'n1',
        message: 'm',
      });
      vi.mocked(personalSign).mockResolvedValueOnce('0xsig');
      vi.mocked(walletApi.getStatus).mockRejectedValueOnce(
        Object.assign(new Error('Forbidden'), { name: 'HttpError', status: 403 }),
      );

      await useWalletStore.getState().connect();

      const s = useWalletStore.getState();
      expect(s.status).toBe('error');
      expect(s.address).toBeNull();
      expect(sessionStorage.getItem('trading_bot_wallet_auth')).toBeNull();
    });

    it('clears storage + error state when /user/status returns 401', async () => {
      vi.mocked(detectCoin98).mockReturnValue(fakeProvider);
      vi.mocked(requestAccounts).mockResolvedValueOnce(['0xabc']);
      vi.mocked(walletApi.getNonce).mockResolvedValueOnce({
        nonce: 'n1',
        message: 'm',
      });
      vi.mocked(personalSign).mockResolvedValueOnce('0xsig');
      vi.mocked(walletApi.getStatus).mockRejectedValueOnce(
        Object.assign(new Error('Unauthorized'), {
          name: 'HttpError',
          status: 401,
        }),
      );

      await useWalletStore.getState().connect();

      const s = useWalletStore.getState();
      expect(s.status).toBe('error');
      expect(sessionStorage.getItem('trading_bot_wallet_auth')).toBeNull();
    });

    it('clears storage + error state on network error during /user/status', async () => {
      vi.mocked(detectCoin98).mockReturnValue(fakeProvider);
      vi.mocked(requestAccounts).mockResolvedValueOnce(['0xabc']);
      vi.mocked(walletApi.getNonce).mockResolvedValueOnce({
        nonce: 'n1',
        message: 'm',
      });
      vi.mocked(personalSign).mockResolvedValueOnce('0xsig');
      vi.mocked(walletApi.getStatus).mockRejectedValueOnce(
        new Error('Network error'),
      );

      await useWalletStore.getState().connect();
      expect(useWalletStore.getState().status).toBe('error');
      expect(sessionStorage.getItem('trading_bot_wallet_auth')).toBeNull();
    });

    it('sets status="no-c98" when provider not detected', async () => {
      vi.mocked(detectCoin98).mockReturnValue(null);

      await useWalletStore.getState().connect();

      expect(useWalletStore.getState().status).toBe('no-c98');
      expect(useWalletStore.getState().address).toBeNull();
    });

    it('sets error state when user rejects account request', async () => {
      vi.mocked(detectCoin98).mockReturnValue(fakeProvider);
      vi.mocked(requestAccounts).mockRejectedValueOnce(new UserRejectedError());

      await useWalletStore.getState().connect();

      const s = useWalletStore.getState();
      expect(s.status).toBe('error');
      expect(s.error).toContain('từ chối');
    });

    it('sets error state when user rejects signing', async () => {
      vi.mocked(detectCoin98).mockReturnValue(fakeProvider);
      vi.mocked(requestAccounts).mockResolvedValueOnce(['0xabc']);
      vi.mocked(walletApi.getNonce).mockResolvedValueOnce({
        nonce: 'n',
        message: 'm',
      });
      vi.mocked(personalSign).mockRejectedValueOnce(new UserRejectedError());

      await useWalletStore.getState().connect();

      expect(useWalletStore.getState().status).toBe('error');
      expect(sessionStorage.getItem('trading_bot_wallet_auth')).toBeNull();
    });

    it('sets error when getNonce fails', async () => {
      vi.mocked(detectCoin98).mockReturnValue(fakeProvider);
      vi.mocked(requestAccounts).mockResolvedValueOnce(['0xabc']);
      vi.mocked(walletApi.getNonce).mockRejectedValueOnce(new Error('500'));

      await useWalletStore.getState().connect();
      expect(useWalletStore.getState().status).toBe('error');
    });

    // Bảo vệ fix của commit f56ecaf: nếu /user/status fail sau khi sign,
    // KHÔNG được set status='ready'. Nếu test này fail → regression của bug
    // "user vào builder với cred xấu".
    it('clears creds and sets error when /user/status fails after sign', async () => {
      vi.mocked(detectCoin98).mockReturnValue(fakeProvider);
      vi.mocked(requestAccounts).mockResolvedValueOnce(['0xabc']);
      vi.mocked(walletApi.getNonce).mockResolvedValueOnce({
        nonce: 'n',
        message: 'm',
      });
      vi.mocked(personalSign).mockResolvedValueOnce('0xsig');
      vi.mocked(walletApi.getStatus).mockRejectedValueOnce(
        Object.assign(new Error('Forbidden'), { name: 'HttpError', status: 403 }),
      );

      await useWalletStore.getState().connect();

      const s = useWalletStore.getState();
      expect(s.status).toBe('error');
      expect(s.address).toBeNull();
      expect(s.nonce).toBeNull();
      expect(s.signature).toBeNull();
      expect(sessionStorage.getItem('trading_bot_wallet_auth')).toBeNull();
    });

    it('clears creds and sets error when user is inactive (defensive — BE blocks at middleware in practice)', async () => {
      vi.mocked(detectCoin98).mockReturnValue(fakeProvider);
      vi.mocked(requestAccounts).mockResolvedValueOnce(['0xabc']);
      vi.mocked(walletApi.getNonce).mockResolvedValueOnce({
        nonce: 'n',
        message: 'm',
      });
      vi.mocked(personalSign).mockResolvedValueOnce('0xsig');
      vi.mocked(walletApi.getStatus).mockResolvedValueOnce({
        id: 1,
        email: null,
        wallet_address: '0xabc',
        is_active: false,
        is_admin: false,
      });

      await useWalletStore.getState().connect();

      const s = useWalletStore.getState();
      expect(s.status).toBe('error');
      expect(s.error).toContain('vô hiệu hoá');
      expect(s.address).toBeNull();
      expect(sessionStorage.getItem('trading_bot_wallet_auth')).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('clears sessionStorage + state and calls BE disconnect (best-effort)', async () => {
      sessionStorage.setItem(
        'trading_bot_wallet_auth',
        JSON.stringify({ address: '0xabc', nonce: 'n', signature: 's' }),
      );
      useWalletStore.setState({
        address: '0xabc',
        nonce: 'n',
        signature: 's',
        user: {
          id: 1,
          email: null,
          wallet_address: '0xabc',
          is_active: true,
          is_admin: false,
        },
        status: 'ready',
        error: null,
        signingMessage: null,
      });
      vi.mocked(walletApi.disconnect).mockResolvedValueOnce({ status: 'ok' });

      await useWalletStore.getState().disconnect();

      expect(sessionStorage.getItem('trading_bot_wallet_auth')).toBeNull();
      const s = useWalletStore.getState();
      expect(s.address).toBeNull();
      expect(s.user).toBeNull();
      expect(s.status).toBe('idle');
      expect(walletApi.disconnect).toHaveBeenCalled();
    });

    it('still clears local state when BE disconnect fails', async () => {
      sessionStorage.setItem(
        'trading_bot_wallet_auth',
        JSON.stringify({ address: '0xabc', nonce: 'n', signature: 's' }),
      );
      useWalletStore.setState({
        address: '0xabc',
        nonce: 'n',
        signature: 's',
        user: null,
        status: 'ready',
        error: null,
        signingMessage: null,
      });
      vi.mocked(walletApi.disconnect).mockRejectedValueOnce(
        new Error('network'),
      );

      await useWalletStore.getState().disconnect();

      expect(sessionStorage.getItem('trading_bot_wallet_auth')).toBeNull();
      expect(useWalletStore.getState().address).toBeNull();
    });
  });

  describe('loadUser', () => {
    it('sets user on success', async () => {
      useWalletStore.setState({
        address: '0xabc',
        nonce: 'n',
        signature: 's',
        user: null,
        status: 'ready',
        error: null,
        signingMessage: null,
      });
      vi.mocked(walletApi.getStatus).mockResolvedValueOnce({
        id: 2,
        email: null,
        wallet_address: '0xabc',
        is_active: true,
        is_admin: false,
      });

      await useWalletStore.getState().loadUser();
      expect(useWalletStore.getState().user?.id).toBe(2);
    });

    it('swallows errors silently (http.ts handles 401/403)', async () => {
      vi.mocked(walletApi.getStatus).mockRejectedValueOnce(new Error('boom'));
      await expect(
        useWalletStore.getState().loadUser(),
      ).resolves.toBeUndefined();
    });
  });
});
