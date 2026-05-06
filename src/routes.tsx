import { createBrowserRouter, Navigate } from 'react-router-dom';
import { BuilderPage } from './pages/BuilderPage';
import { BotMonitoringPage } from './features/bot-monitoring/BotMonitoringPage';
import { BotsListPage } from './features/bot-monitoring/BotsListPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/builder" replace />,
  },
  {
    path: '/builder',
    element: <BuilderPage />,
  },
  {
    path: '/bots',
    element: <BotsListPage />,
  },
  {
    path: '/bots/:id',
    element: <BotMonitoringPage />,
  },
  {
    path: '*',
    element: <Navigate to="/builder" replace />,
  },
]);
