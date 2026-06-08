import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HeaderToolbar } from './HeaderToolbar';

// WalletChip calls useRequireWallet() unconditionally, which throws without a
// RequireWalletProvider. This test only asserts the header chrome, so stub it.
vi.mock('@/features/wallet-auth/WalletChip', () => ({
  WalletChip: () => <div data-testid="wallet-chip" />,
}));

describe('HeaderToolbar', () => {
  it('renders a "New" (reset) button', () => {
    render(
      <MemoryRouter>
        <HeaderToolbar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /^New$/i })).toBeInTheDocument();
  });

  it('keeps the header fixed and uses the shared app header pill', () => {
    const { container } = render(
      <MemoryRouter>
        <HeaderToolbar />
      </MemoryRouter>,
    );

    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    const headerClassName = header?.className ?? '';
    expect(headerClassName).toMatch(/fixed/);
    expect(headerClassName).toMatch(/inset-x-0/);
    expect(headerClassName).toMatch(/top-0/);

    const pill = container.querySelector('header > div');
    expect(pill).not.toBeNull();
    const className = pill?.className ?? '';

    expect(className).not.toMatch(/card-coin98/);
    expect(className).toMatch(/app-header-pill/);
    expect(className).toMatch(/max-w-\[1200px\]/);
    expect(className).toMatch(/h-16/);
  });
});
