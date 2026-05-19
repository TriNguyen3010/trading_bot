import { Navigate } from 'react-router-dom';
import { useIsWalletConnected } from './wallet.store';

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true';

// =============================================================================
// ProtectedRoute · wallet-auth version
//
// Replaces src/features/auth/ProtectedRoute (deleted in Task 11).
//
// Adaptation: plan T7 redirects to /connect (forced-auth UX). Em's
// defer-auth UX has no /connect route — unauth users land on the public
// Landing (/) where the wallet chip / CTAs re-trigger the wallet modal.
// =============================================================================
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsWalletConnected();
  if (!BYPASS_AUTH && !isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
