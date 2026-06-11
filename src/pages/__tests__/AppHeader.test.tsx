import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppHeader } from '../AppHeader';
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

function renderAt(path: string, actions?: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RequireWalletProvider>
        <AppHeader actions={actions} />
      </RequireWalletProvider>
    </MemoryRouter>,
  );
}

describe('AppHeader', () => {
  beforeEach(() => {
    setWallet();
  });

  it('marks Dashboard active at /dashboard', () => {
    renderAt('/dashboard');
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: 'Builder' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('marks Builder active at /builder', () => {
    renderAt('/builder');
    expect(screen.getByRole('button', { name: 'Builder' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('marks Dashboard active on bot detail routes (/bots/:id)', () => {
    renderAt('/bots/123');
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('marks nothing active on the landing page', () => {
    renderAt('/');
    expect(
      screen.getByRole('button', { name: 'Dashboard' }),
    ).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Builder' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('renders actions passed via the actions prop', () => {
    renderAt('/dashboard', <span>MY_ACTIONS</span>);
    expect(screen.getByText('MY_ACTIONS')).toBeInTheDocument();
  });
});
