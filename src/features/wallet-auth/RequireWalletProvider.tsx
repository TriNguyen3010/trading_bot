import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ConnectWalletModal } from './ConnectWalletModal';
import { useWalletStore } from './wallet.store';

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

  const isConnected = useWalletStore(
    (s) => !!s.address && !!s.signature,
  );

  const requireWalletThen = useCallback(
    (action: () => void) => {
      if (isConnected) {
        action();
        return;
      }
      pendingAction.current = action;
      setOpen(true);
    },
    [isConnected],
  );

  const openConnect = useCallback(() => {
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
