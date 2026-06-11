import { describe, it, expect, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import {
  createMemoryRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router-dom';
import { AppLayout } from '../AppLayout';
import { useHeaderActions } from '../header-actions-context';
import { RequireWalletProvider } from '@/features/wallet-auth/RequireWalletProvider';
import { useWalletStore } from '@/features/wallet-auth/wallet.store';

function setWallet() {
  useWalletStore.setState({
    address: '0xabc',
    nonce: 'n',
    signature: 's',
    status: 'ready',
    user: null,
    error: null,
    signingMessage: null,
  });
}

function renderRouter(initial: string, children: RouteObject[]) {
  const router = createMemoryRouter([{ element: <AppLayout />, children }], {
    initialEntries: [initial],
  });
  return render(
    <RequireWalletProvider>
      <RouterProvider router={router} />
    </RequireWalletProvider>,
  );
}

describe('AppLayout', () => {
  beforeEach(() => {
    setWallet();
  });

  it('renders the shared header above the routed page', () => {
    renderRouter('/x', [{ path: '/x', element: <div>PAGE_X</div> }]);
    expect(screen.getByText('COIN98 BOT')).toBeInTheDocument();
    expect(screen.getByText('PAGE_X')).toBeInTheDocument();
  });

  it('lets a routed page push actions into the header via context', () => {
    function Pusher() {
      const setActions = useHeaderActions();
      useEffect(() => {
        setActions(<span>PUSHED_ACTION</span>);
        return () => setActions(null);
      }, [setActions]);
      return <div>PAGE</div>;
    }
    renderRouter('/x', [{ path: '/x', element: <Pusher /> }]);
    expect(screen.getByText('PUSHED_ACTION')).toBeInTheDocument();
  });
});
