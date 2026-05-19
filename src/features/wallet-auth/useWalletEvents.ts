import { useEffect } from 'react';
import { detectCoin98 } from './wallet.provider';
import { useWalletStore } from './wallet.store';
import type { EthereumProvider } from './wallet.types';

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true';

// =============================================================================
// useWalletEvents
//
// Mounted once at app root. Listens for Coin98 wallet events:
//   - accountsChanged: user switched accounts in the wallet → force
//     disconnect so they reconnect with the new address.
//   - disconnect: provider hung up the session → same.
//
// On either, the hook awaits disconnect() (BE removes server-side nonce
// from Redis) before redirecting to "/" so a stolen credential cannot
// keep authenticating for 24h.
//
// Adaptation: plan T9 redirects to /connect (forced-auth UX). Em's
// defer-auth UX has no /connect route — redirect to Landing where the
// wallet chip / CTAs re-trigger the wallet modal.
//
// Late-injection guard: Coin98 content script may inject the provider
// after React mounts. Poll up to 10×500ms before giving up.
// =============================================================================

export function useWalletEvents() {
  // Re-run when status changes so we get a second chance to attach
  // after a successful connect — provider is guaranteed to exist then,
  // even if it was injected late.
  const status = useWalletStore((s) => s.status);

  useEffect(() => {
    if (BYPASS_AUTH) return;

    let cleanup: (() => void) | undefined;
    let pollInterval: number | undefined;
    let attempts = 0;

    const attach = (provider: EthereumProvider) => {
      const onAccountsChanged = async (...args: unknown[]) => {
        const accounts = (args[0] as string[]) ?? [];
        const current = useWalletStore.getState().address;
        const next = accounts[0]?.toLowerCase() ?? null;
        if (!next || next !== current?.toLowerCase()) {
          // MUST await: BE removes Redis nonce in /wallet/disconnect.
          // Without await, page navigate may kill the in-flight fetch
          // → nonce stays valid 24h → security hole.
          await useWalletStore.getState().disconnect();
          window.location.href = '/';
        }
      };

      const onDisconnect = async () => {
        await useWalletStore.getState().disconnect();
        window.location.href = '/';
      };

      provider.on('accountsChanged', onAccountsChanged);
      provider.on('disconnect', onDisconnect);

      cleanup = () => {
        provider.removeListener('accountsChanged', onAccountsChanged);
        provider.removeListener('disconnect', onDisconnect);
      };
    };

    const tryAttach = (): boolean => {
      const provider = detectCoin98();
      if (!provider) return false;
      attach(provider);
      return true;
    };

    if (!tryAttach()) {
      // Late injection — poll 10 × 500ms = 5s, then give up.
      pollInterval = window.setInterval(() => {
        attempts++;
        if (tryAttach() || attempts >= 10) {
          if (pollInterval) window.clearInterval(pollInterval);
        }
      }, 500);
    }

    return () => {
      if (pollInterval) window.clearInterval(pollInterval);
      cleanup?.();
    };
  }, [status]);
}
