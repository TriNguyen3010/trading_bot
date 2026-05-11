import { Navigate } from 'react-router-dom';
import { useAuthStore } from './auth.store';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => !!s.token);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
