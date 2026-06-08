import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WalletChip } from '../WalletChip';

// NOTE: variables referenced inside a vi.mock() factory MUST be prefixed with
// `mock` — Vitest hoists vi.mock() to the top of the file and only allows
// factory references to identifiers matching /^(mock|Mock)/. Hence the names.
let mockUser: { is_admin: boolean; wallet_address: string } | null = null;
const mockDisconnect = vi.fn(() => Promise.resolve());
const mockSwitchAccount = vi.fn(() => Promise.resolve());
const mockNavigate = vi.fn();

vi.mock('../wallet.store', () => ({
  useWalletStore: (sel: (s: object) => unknown) =>
    sel({
      address: '0xABCD1234ABCD1234ABCD1234ABCD1234ABCD1234',
      status: 'ready',
      nonce: 'n',
      signature: 's',
      user: mockUser,
      error: null,
      signingMessage: null,
      disconnect: mockDisconnect,
      switchAccount: mockSwitchAccount,
    }),
}));
vi.mock('@/features/agent-wallet/ManageAgentsModal', () => ({
  ManageAgentsModal: () => null,
}));
vi.mock('@/features/agent-wallet/AgentOnboardingDialog', () => ({
  AgentOnboardingDialog: () => null,
}));
vi.mock('../RequireWalletProvider', () => ({
  useRequireWallet: () => ({ openConnect: vi.fn() }),
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

beforeEach(() => {
  mockUser = null;
  mockDisconnect.mockClear();
  mockSwitchAccount.mockClear();
  mockNavigate.mockClear();
});

describe('WalletChip — role badge', () => {
  it('shows "Admin" when the user is an admin', async () => {
    mockUser = { is_admin: true, wallet_address: '0xABCD' };
    render(<WalletChip />);
    fireEvent.click(screen.getByTitle('Wallet menu'));
    await waitFor(() =>
      expect(screen.getByText(/^Admin$/)).toBeInTheDocument(),
    );
  });

  it('shows "Member" when the user is not an admin', async () => {
    mockUser = { is_admin: false, wallet_address: '0xABCD' };
    render(<WalletChip />);
    fireEvent.click(screen.getByTitle('Wallet menu'));
    await waitFor(() =>
      expect(screen.getByText(/^Member$/)).toBeInTheDocument(),
    );
  });

  it('hides the role badge when the user is not loaded', async () => {
    mockUser = null;
    render(<WalletChip />);
    fireEvent.click(screen.getByTitle('Wallet menu'));
    await waitFor(() =>
      expect(screen.getByText(/connected wallet/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/^Admin$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Member$/)).not.toBeInTheDocument();
  });
});

describe('WalletChip — redirectOnDisconnect', () => {
  it('navigates to the given path (replace) after disconnect', async () => {
    render(<WalletChip redirectOnDisconnect="/" />);
    fireEvent.click(screen.getByTitle('Wallet menu'));
    const btn = await screen.findByRole('button', { name: /^Disconnect$/ });
    fireEvent.click(btn);
    await waitFor(() => expect(mockDisconnect).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }),
    );
  });

  it('does not navigate when redirectOnDisconnect is omitted', async () => {
    render(<WalletChip />);
    fireEvent.click(screen.getByTitle('Wallet menu'));
    const btn = await screen.findByRole('button', { name: /^Disconnect$/ });
    fireEvent.click(btn);
    await waitFor(() => expect(mockDisconnect).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('WalletChip — triggerVariant', () => {
  it('renders the ghost trigger (User icon) with the truncated address', () => {
    render(<WalletChip triggerVariant="ghost" />);
    const trigger = screen.getByTitle('Wallet menu');
    expect(trigger).toHaveTextContent('0xABCD…1234');
    // The ghost variant shows the lucide <User> icon (an <svg>); the
    // address-chip variant shows a status-dot <span> and no icon. This
    // distinguishes the two — a text-only assertion would pass for both.
    expect(trigger.querySelector('svg')).not.toBeNull();
  });

  it('renders the address-chip trigger (status dot, no icon) by default', () => {
    render(<WalletChip />);
    const trigger = screen.getByTitle('Wallet menu');
    expect(trigger).toHaveTextContent('0xABCD…1234');
    expect(trigger.querySelector('svg')).toBeNull();
  });
});
