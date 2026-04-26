import { createBrowserRouter, Navigate } from 'react-router-dom';
import { BuilderPage } from './pages/BuilderPage';

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
    path: '*',
    element: <Navigate to="/builder" replace />,
  },
]);
