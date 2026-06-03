import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WalletChip } from '../WalletChip';

// Mock wallet store so chip renders as connected
vi.mock('../wallet.store', () => ({
  useWalletStore: (sel: (s: object) => unknown) =>
    sel({
      address: '0xABCD1234ABCD1234ABCD1234ABCD1234ABCD1234',
      status: 'ready',
      nonce: 'n',
      signature: 's',
      user: null,
      error: null,
      signingMessage: null,
    }),
}));
// ManageAgentsModal is a heavy component — stub it
vi.mock('@/features/agent-wallet/ManageAgentsModal', () => ({
  ManageAgentsModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="manage-modal">ManageAgentsModal</div> : null,
}));
// AgentOnboardingDialog — stub it
vi.mock('@/features/agent-wallet/AgentOnboardingDialog', () => ({
  AgentOnboardingDialog: () => null,
}));
// RequireWalletProvider — stub the hook
vi.mock('../RequireWalletProvider', () => ({
  useRequireWallet: () => ({ openConnect: vi.fn() }),
}));

describe('WalletChip — Manage agents entry', () => {
  it('renders "Manage agents" button in popover when wallet is connected', async () => {
    render(<WalletChip />);
    // Open the wallet popover first (the trigger shows the truncated address)
    fireEvent.click(screen.getByTitle('Wallet menu'));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /manage agents/i }),
      ).toBeInTheDocument(),
    );
  });

  it('opens ManageAgentsModal when "Manage agents" is clicked', async () => {
    render(<WalletChip />);
    // Open the wallet popover first
    fireEvent.click(screen.getByTitle('Wallet menu'));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /manage agents/i }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /manage agents/i }));
    await waitFor(() =>
      expect(screen.getByTestId('manage-modal')).toBeInTheDocument(),
    );
  });
});
