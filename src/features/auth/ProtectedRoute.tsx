import { Navigate } from 'react-router-dom';
import { useAuthStore } from './auth.store';
import { useIsWalletConnected } from '@/features/wallet-auth/wallet.store';

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const hasEmailToken = useAuthStore((s) => !!s.token);
  const hasWallet = useIsWalletConnected();
  const isAuthenticated = hasEmailToken || hasWallet;

  if (!BYPASS_AUTH && !isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
