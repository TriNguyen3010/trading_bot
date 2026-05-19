import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ConnectWalletModal } from './ConnectWalletModal';
import { useIsWalletConnected } from './wallet.store';

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true';

interface RequireWalletContextValue {
  /**
   * Open the intent-gate modal if the user is not connected yet, otherwise
   * run the action immediately. The action runs once after a successful
   * connect (or right away if already connected).
   */
  requireWalletThen: (action: () => void) => void;
  /** Open the modal without an action (power-user "Connect" chip click). */
  openConnect: () => void;
}

const RequireWalletContext = createContext<RequireWalletContextValue | null>(
  null,
);

export function useRequireWallet(): RequireWalletContextValue {
  const ctx = useContext(RequireWalletContext);
  if (!ctx) {
    throw new Error(
      'useRequireWallet must be used within <RequireWalletProvider>',
    );
  }
  return ctx;
}

export function RequireWalletProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  // Shared hook checks all 3 credential fields AND honours BYPASS_AUTH.
  // Using it (instead of a local 2-field check) keeps the gate in sync
  // with http.ts validation and the rest of the app.
  const isConnected = useIsWalletConnected();

  const requireWalletThen = useCallback(
    (action: () => void) => {
      // BYPASS_AUTH already collapsed into isConnected via the hook,
      // but keep the explicit check so the intent reads at the call
      // site — "if bypass or really-connected, just run."
      if (BYPASS_AUTH || isConnected) {
        action();
        return;
      }
      pendingAction.current = action;
      setOpen(true);
    },
    [isConnected],
  );

  const openConnect = useCallback(() => {
    // In bypass mode, the chip has nothing useful to do — silently no-op
    // so a stray click doesn't pop a modal that can't progress.
    if (BYPASS_AUTH) return;
    pendingAction.current = null;
    setOpen(true);
  }, []);

  const handleSuccess = useCallback(() => {
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action) action();
  }, []);

  return (
    <RequireWalletContext.Provider value={{ requireWalletThen, openConnect }}>
      {children}
      <ConnectWalletModal
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) pendingAction.current = null;
        }}
        onSuccess={handleSuccess}
      />
    </RequireWalletContext.Provider>
  );
}
