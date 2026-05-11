import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './routes';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
    <Toaster
      theme="dark"
      position="top-right"
      toastOptions={{
        className: 'rounded-2xl card-coin98 text-fg shadow-2xl',
      }}
    />
  </StrictMode>,
);
