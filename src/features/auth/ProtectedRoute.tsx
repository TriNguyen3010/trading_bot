import { Navigate } from 'react-router-dom';
import { useAuthStore } from './auth.store';

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => !!s.token);
  if (!BYPASS_AUTH && !isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
