import { createBrowserRouter, Navigate } from 'react-router-dom';
import { BuilderPage } from './pages/BuilderPage';
import { DashboardPage } from './pages/DashboardPage';
import { LandingPage } from './pages/LandingPage';
import { BotMonitoringPage } from './features/bot-monitoring/BotMonitoringPage';
import { ProtectedRoute } from './features/wallet-auth/ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/builder',
    element: (
      <ProtectedRoute>
        <BuilderPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/bots/:id',
    element: (
      <ProtectedRoute>
        <BotMonitoringPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
