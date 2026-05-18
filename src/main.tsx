import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './routes';
import { RequireWalletProvider } from './features/wallet-auth/RequireWalletProvider';
import { useWalletStore } from './features/wallet-auth/wallet.store';
import './index.css';

// Bootstrap: hydrate wallet credentials from sessionStorage before render.
useWalletStore.getState().hydrate();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RequireWalletProvider>
      <RouterProvider router={router} />
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
