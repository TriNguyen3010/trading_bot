import { StrictMode, useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './routes';
import { RequireWalletProvider } from './features/wallet-auth/RequireWalletProvider';
import { useWalletEvents } from './features/wallet-auth/useWalletEvents';
import { useWalletStore } from './features/wallet-auth/wallet.store';
import './index.css';

// Bootstrap: hydrate wallet credentials from sessionStorage before render.
// Synchronous read so the first render sees the correct auth status (no
// auth-flicker on protected routes).
useWalletStore.getState().hydrate();

function AppBootstrap({ children }: { children: ReactNode }) {
  // After hydrate, refresh user info from BE. http.ts handles 401 → clear
  // + redirect, 403 → toast, so loadUser stays simple. Re-runs on
  // sessionStorage changes the rare time they happen (vd manual edit in
  // devtools).
  useEffect(() => {
    const store = useWalletStore.getState();
    if (store.address && store.nonce && store.signature) {
      void store.loadUser();
    }
  }, []);

  // Mount Coin98 wallet-event listeners (accountsChanged + disconnect)
  // exactly once for the lifetime of the app.
  useWalletEvents();

  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RequireWalletProvider>
      <AppBootstrap>
        <RouterProvider router={router} />
      </AppBootstrap>
    </RequireWalletProvider>
    <Toaster
      theme="dark"
      position="top-right"
      toastOptions={{
        className: 'rounded-2xl card-coin98 text-fg shadow-2xl',
      }}
    />
  </StrictMode>,
);
