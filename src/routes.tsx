import { createBrowserRouter, Navigate } from 'react-router-dom';
import { BuilderPage } from './pages/BuilderPage';
import { DashboardPage } from './pages/DashboardPage';
import { LandingPage } from './pages/LandingPage';
import { AppLayout } from './pages/AppLayout';
import { BotMonitoringPage } from './features/bot-monitoring/BotMonitoringPage';
import { ProtectedRoute } from './features/wallet-auth/ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    // Shared-chrome layout: AppHeader mounts once, child routes render in Outlet.
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/builder', element: <BuilderPage /> },
      { path: '/bots/:id', element: <BotMonitoringPage /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
