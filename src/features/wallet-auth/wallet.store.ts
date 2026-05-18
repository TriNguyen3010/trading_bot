import { create } from 'zustand';
import { walletApi } from './wallet.api';
import type { AuthUser, WalletCredentials, WalletStatus } from './wallet.types';

const STORAGE_KEY = 'trading_bot_wallet_auth';

interface WalletState {
  // Credentials (persisted to sessionStorage on success)
  address: string | null;
  nonce: string | null;
  signature: string | null;

  // In-memory only
  user: AuthUser | null;
  status: WalletStatus;
  error: string | null;
  signingMessage: string | null;

  // Actions
  hydrate: () => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  loadUser: () => Promise<void>;
  reset: () => void;
}

function readSession(): WalletCredentials | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WalletCredentials;
  } catch {
    return null;
  }
}

function writeSession(creds: WalletCredentials) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
  } catch {
    /* noop */
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export const useWalletStore = create<WalletState>()((set, get) => ({
  address: null,
  nonce: null,
  signature: null,
  user: null,
  status: 'idle',
  error: null,
  signingMessage: null,

  hydrate: () => {
    const creds = readSession();
    if (creds) {
      set({
        address: creds.address,
        nonce: creds.nonce,
        signature: creds.signature,
      });
    }
  },

  // =========================================================================
  // STUB connect() — drives the modal state machine and simulates a successful
  // wallet sign over ~3.2s. External team replaces the body with real
  // detectCoin98 → eth_requestAccounts → personal_sign → walletApi.getStatus.
  //
  // Timeline (matches spec §3.2 happy path):
  //   0.0s   detecting       (provider lookup)
  //   0.6s   connecting      (eth_requestAccounts — user opens Coin98)
  //   1.5s   address known   (still connecting, now we know the wallet)
  //   2.0s   signing         (personal_sign — user reviews message)
  //   3.0s   getStatus       (BE verifies signature)
  //   3.2s   ready           (success)
  // =========================================================================
  connect: async () => {
    const FAKE_ADDRESS = '0x4a7c8e2bd3f4a91f6f0ab95cc7e1d3a4b5c6d9f21';

    set({
      status: 'detecting',
      error: null,
      address: null,
      nonce: null,
      signature: null,
      signingMessage: null,
    });
    await sleep(600);

    set({ status: 'connecting' });
    await sleep(900);

    // Discovered the account — surface it to the UI early so the user sees
    // which wallet is signing before the message popup.
    set({ address: FAKE_ADDRESS });
    await sleep(500);

    const nonceResp = await walletApi.getNonce(FAKE_ADDRESS);
    set({
      status: 'signing',
      nonce: nonceResp.nonce,
      signingMessage: nonceResp.message,
    });
    await sleep(1000);

    const signature = '0x' + 'a'.repeat(130);
    const creds: WalletCredentials = {
      address: FAKE_ADDRESS,
      nonce: nonceResp.nonce,
      signature,
    };
    writeSession(creds);

    let user: AuthUser | null = null;
    try {
      user = await walletApi.getStatus();
    } catch {
      // STUB: ignore — real impl handles 401/403 via http.ts.
    }
    await sleep(200);

    set({
      address: creds.address,
      nonce: creds.nonce,
      signature: creds.signature,
      user,
      status: 'ready',
      error: null,
    });
  },

  disconnect: async () => {
    walletApi.disconnect().catch(() => {
      /* best-effort */
    });
    clearSession();
    set({
      address: null,
      nonce: null,
      signature: null,
      user: null,
      status: 'idle',
      error: null,
      signingMessage: null,
    });
  },

  loadUser: async () => {
    const { address } = get();
    if (!address) return;
    try {
      const user = await walletApi.getStatus();
      set({ user });
    } catch {
      // STUB: real impl — 401 clears creds via http.ts.
    }
  },

  reset: () => {
    clearSession();
    set({
      address: null,
      nonce: null,
      signature: null,
      user: null,
      status: 'idle',
      error: null,
      signingMessage: null,
    });
  },
}));

export const useIsWalletConnected = () =>
  useWalletStore((s) => !!s.address && !!s.signature);

export const useWalletAddress = () =>
  useWalletStore((s) => s.address);
