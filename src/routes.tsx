import { createBrowserRouter, Navigate } from 'react-router-dom';
import { BuilderPage } from './pages/BuilderPage';
import { BotMonitoringPage } from './features/bot-monitoring/BotMonitoringPage';
import { BotsListPage } from './features/bot-monitoring/BotsListPage';
import { LoginPage } from './features/auth/LoginPage';
import { ProtectedRoute } from './features/auth/ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <Navigate to="/builder" replace />,
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
    path: '/bots',
    element: (
      <ProtectedRoute>
        <BotsListPage />
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
    element: <Navigate to="/builder" replace />,
  },
]);
