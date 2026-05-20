import { create } from 'zustand';
import { toast } from 'sonner';
import { walletApi } from './wallet.api';
import {
  detectCoin98,
  NoProviderError,
  personalSign,
  requestAccountPicker,
  requestAccounts,
  UserRejectedError,
} from './wallet.provider';
import type { AuthUser, WalletStatus } from './wallet.types';

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
  /** Set while status === 'signing' so the UI can display the message
   * the wallet is asking the user to sign. */
  signingMessage: string | null;

  // Actions
  hydrate: () => void;
  connect: () => Promise<void>;
  /** Ask the wallet to open its account picker (EIP-2255), then clear
   * the current session and reconnect — so the address that comes back
   * from `eth_requestAccounts` is whatever the user just picked. Falls
   * back to a plain reconnect when the wallet does not support
   * `wallet_requestPermissions`. */
  switchAccount: () => Promise<void>;
  disconnect: () => Promise<void>;
  loadUser: () => Promise<void>;
  reset: () => void;
}

function writeStorage(creds: {
  address: string;
  nonce: string;
  signature: string;
}) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
  } catch {
    /* noop */
  }
}

function clearStorage() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

function readableError(err: unknown): string {
  if (err instanceof UserRejectedError)
    return 'Bạn đã từ chối yêu cầu từ ví Coin98.';
  if (err instanceof NoProviderError) return 'Không tìm thấy ví Coin98.';
  if (err instanceof Error) return err.message;
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
}

export const useWalletStore = create<WalletState>()((set) => ({
  address: null,
  nonce: null,
  signature: null,
  user: null,
  status: 'idle',
  error: null,
  signingMessage: null,

  hydrate: () => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        address?: string;
        nonce?: string;
        signature?: string;
      };
      if (parsed.address && parsed.nonce && parsed.signature) {
        set({
          address: parsed.address,
          nonce: parsed.nonce,
          signature: parsed.signature,
          status: 'ready',
        });
      }
    } catch {
      /* malformed — leave idle */
    }
  },

  // =========================================================================
  // Real connect() chain — replaces the earlier setTimeout simulation.
  //   detecting → no-c98 (early return) OR
  //   detecting → connecting → signing → ready
  // On any failure: clear creds + sessionStorage, set status='error' with
  // a user-readable message. Per spec §3.2 verification step, /user/status
  // is called DIRECTLY (not via loadUser which swallows errors) so 403/401/
  // network failures translate to error state, never to a false 'ready'.
  // =========================================================================
  connect: async () => {
    set({
      status: 'detecting',
      error: null,
      address: null,
      nonce: null,
      signature: null,
      signingMessage: null,
    });
    const provider = detectCoin98();
    if (!provider) {
      set({ status: 'no-c98' });
      return;
    }

    try {
      set({ status: 'connecting' });
      const [address] = await requestAccounts(provider);

      set({ status: 'signing', address });
      const { nonce, message } = await walletApi.getNonce(address);
      set({ nonce, signingMessage: message });
      const signature = await personalSign(provider, message, address);

      writeStorage({ address, nonce, signature });
      set({ address, nonce, signature });

      // Verify credentials by calling /user/status DIRECTLY. Do NOT call
      // loadUser() — it swallows errors, which would let 403/401/network
      // failures slip through and set status='ready' with bad credentials.
      const user = await walletApi.getStatus();

      // Defensive is_active check (spec §3.2 + §14.4). BE confirms
      // deactivated user → 403 at middleware (FE never receives 200 +
      // is_active=false in current implementation). Keep the check as
      // belt-and-suspenders for future BE policy changes.
      if (!user.is_active) {
        clearStorage();
        set({
          address: null,
          nonce: null,
          signature: null,
          user: null,
          status: 'error',
          error: 'Tài khoản đã bị vô hiệu hoá. Vui lòng liên hệ admin.',
          signingMessage: null,
        });
        return;
      }

      set({ user, status: 'ready', signingMessage: null });
    } catch (err) {
      clearStorage();
      set({
        address: null,
        nonce: null,
        signature: null,
        user: null,
        status: 'error',
        error: readableError(err),
        signingMessage: null,
      });
    }
  },

  switchAccount: async () => {
    const provider = detectCoin98();
    if (!provider) {
      set({ status: 'no-c98' });
      return;
    }

    // Step 1: ask the wallet to show its account picker. If the wallet
    // doesn't support EIP-2255, swallow the error and continue — the
    // disconnect+reconnect below still gives the user a chance to switch
    // accounts manually in the extension.
    //
    // 4001 (user cancelled the picker) → bail without touching the
    // current session. The user is still signed in with the old address;
    // no harm done.
    try {
      await requestAccountPicker(provider);
    } catch (err) {
      if (err instanceof UserRejectedError) {
        return;
      }
      // Unsupported method / other RPC errors — keep going.
    }

    // Step 2: tear down the old session (BE drops the old nonce) then
    // run the regular connect flow against whatever account the picker
    // left selected.
    try {
      await walletApi.disconnect();
    } catch {
      /* nonce will auto-expire ≤24h */
    }
    clearStorage();
    set({
      address: null,
      nonce: null,
      signature: null,
      user: null,
      status: 'idle',
      error: null,
      signingMessage: null,
    });

    await useWalletStore.getState().connect();

    // Surface a toast since this flow runs outside the ConnectWalletModal
    // (which is where the regular "Đã kết nối" toast fires). Read state
    // synchronously — connect() has already settled by the time await
    // resolves.
    const final = useWalletStore.getState();
    if (final.status === 'ready' && final.address) {
      const shortAddr = `${final.address.slice(0, 6)}…${final.address.slice(-4)}`;
      toast.success(`Đã chuyển sang ${shortAddr}`);
    } else if (final.status === 'error' && final.error) {
      toast.error(final.error);
    }
  },

  // BẮT BUỘC await: BE removes wallet_nonce:0x... from Redis. If FE only
  // clears local without calling BE → old nonce remains valid for 24h →
  // a stolen cred can still auth. Caller MUST await this before navigate.
  disconnect: async () => {
    try {
      await walletApi.disconnect();
    } catch {
      /* ignore network/5xx — nonce will auto-expire ≤24h */
    }
    clearStorage();
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
    try {
      const user = await walletApi.getStatus();
      set({ user });
    } catch {
      // http.ts already handles 401 (clear + redirect) and 403 (toast).
      // Other errors: leave state alone, UI will show stale user briefly.
    }
  },

  reset: () => {
    clearStorage();
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

// Check all 3 fields (match http.ts validation). If we only checked 2,
// a partial-state edge case would slip past ProtectedRoute → one wasted
// cycle: request fails 401 → http.ts clears+redirects. Not an infinite
// loop but the UX flashes the failure.
//
// BYPASS_AUTH short-circuits to true so offline dev (away from the BE
// network) can navigate the authed UX without ever opening the wallet
// modal. Spec §7.1.
const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true';

export const useIsWalletConnected = () =>
  useWalletStore(
    (s) => BYPASS_AUTH || (!!s.address && !!s.nonce && !!s.signature),
  );

export const useWalletAddress = () =>
  useWalletStore((s) => s.address);
