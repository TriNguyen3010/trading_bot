import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { ManageAgentsModal } from './ManageAgentsModal';
import { agentApi } from './agent.api';
import { botApi } from '@/features/bot-monitoring/bot.api';

// Mock API modules
vi.mock('./agent.api', () => ({
  agentApi: {
    hyperliquidWallets: vi.fn(),
    list: vi.fn(),
    syncStatus: vi.fn(),
    revokePayload: vi.fn(),
    revoke: vi.fn(),
    externalRevokePayload: vi.fn(),
    externalRevoke: vi.fn(),
  },
}));
vi.mock('@/features/bot-monitoring/bot.api', () => ({
  botApi: { rotateWallet: vi.fn() },
}));
// Mock the revoke flow hook to keep tests pure. The factory returns a SINGLE
// stable object (created once), so `run`/`reset`/`state` keep the same identity
// across re-renders — matching the real hook (reset/run are useCallback). A
// fresh object per render would make `resetRevoke` change identity every render,
// re-firing the open-effect (deps include resetRevoke) → infinite render loop.
vi.mock('./useAgentRevokeFlow', () => {
  const idle = { state: { stage: 'idle' }, run: vi.fn(), reset: vi.fn() };
  return { useAgentRevokeFlow: vi.fn(() => idle) };
});

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  onRequestOnboarding: vi.fn(),
  onRotateErrors: vi.fn(),
};

const noMismatchStatus = {
  has_db_active_agent: false,
  db_active_agent_id: null,
  db_active_agent_address: null,
  onchain_verification_status: 'ok',
  onchain_active_addresses: [],
  is_db_agent_onchain_active: null,
  mismatch_db_active_but_onchain_missing: false,
  message: 'ok',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(agentApi.syncStatus).mockResolvedValue(noMismatchStatus);
});

describe('ManageAgentsModal — list rendering', () => {
  it('renders on-chain wallets merged with DB list — app-managed tag', async () => {
    vi.mocked(agentApi.hyperliquidWallets).mockResolvedValue([
      { address: '0xAABB', name: 'Gamma Bot', valid_until: null },
    ]);
    vi.mocked(agentApi.list).mockResolvedValue([
      {
        id: 7,
        agent_address: '0xAABB',
        label: 'Gamma Bot',
        spending_limit_usd: null,
        spent_today_usd: 0,
        is_active: true,
        created_at: '2026-06-01T00:00:00Z',
        revoked_at: null,
      },
    ]);

    render(<ManageAgentsModal {...defaultProps} />);

    await waitFor(() =>
      expect(screen.getByText('Gamma Bot')).toBeInTheDocument(),
    );
    expect(screen.getByText('App')).toBeInTheDocument();
    // Short address rendered
    expect(screen.getByText(/0xAABB/)).toBeInTheDocument();
  });

  it('renders external tag for on-chain wallet not in DB list', async () => {
    vi.mocked(agentApi.hyperliquidWallets).mockResolvedValue([
      {
        address: '0xEXTERNAL',
        name: 'My DeFi Bot',
        valid_until: 9999999999999,
      },
    ]);
    vi.mocked(agentApi.list).mockResolvedValue([]);

    render(<ManageAgentsModal {...defaultProps} />);

    await waitFor(() =>
      expect(screen.getByText('My DeFi Bot')).toBeInTheDocument(),
    );
    expect(screen.getByText('External')).toBeInTheDocument();
  });

  it('shows empty state when no on-chain agents', async () => {
    vi.mocked(agentApi.hyperliquidWallets).mockResolvedValue([]);
    vi.mocked(agentApi.list).mockResolvedValue([]);

    render(<ManageAgentsModal {...defaultProps} />);

    await waitFor(() =>
      expect(
        screen.getByText(/Không có agent nào trên Hyperliquid/),
      ).toBeInTheDocument(),
    );
  });
});

describe('ManageAgentsModal — sync-mismatch banner', () => {
  it('shows mismatch banner when mismatch_db_active_but_onchain_missing is true', async () => {
    vi.mocked(agentApi.hyperliquidWallets).mockResolvedValue([]);
    vi.mocked(agentApi.list).mockResolvedValue([]);
    vi.mocked(agentApi.syncStatus).mockResolvedValue({
      ...noMismatchStatus,
      mismatch_db_active_but_onchain_missing: true,
      message: 'Agent missing on-chain',
    });

    render(<ManageAgentsModal {...defaultProps} />);

    await waitFor(() =>
      expect(
        screen.getByText(/Agent đang active đã bị xoá trên Hyperliquid/),
      ).toBeInTheDocument(),
    );
  });
});

describe('ManageAgentsModal — active-agent revoke warning', () => {
  it('shows stronger confirm text when revoking the active app-managed agent', async () => {
    vi.mocked(agentApi.hyperliquidWallets).mockResolvedValue([
      { address: '0xACTIVE', name: 'Active Agent', valid_until: null },
    ]);
    vi.mocked(agentApi.list).mockResolvedValue([
      {
        id: 1,
        agent_address: '0xACTIVE',
        label: 'Active Agent',
        spending_limit_usd: null,
        spent_today_usd: 0,
        is_active: true,
        created_at: '2026-06-01T00:00:00Z',
        revoked_at: null,
      },
    ]);

    render(<ManageAgentsModal {...defaultProps} />);
    await waitFor(() => screen.getByText('Active Agent'));

    // Click revoke button to open confirm
    fireEvent.click(screen.getByRole('button', { name: /revoke/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/Agent này đang được các bot sử dụng/),
      ).toBeInTheDocument(),
    );
  });
});

describe('ManageAgentsModal — external revoke uses agent NAME', () => {
  it('calls useAgentRevokeFlow.run with type=external and agentName (not address)', async () => {
    const mockRun = vi.fn();
    const { useAgentRevokeFlow } = await import('./useAgentRevokeFlow');
    vi.mocked(useAgentRevokeFlow).mockReturnValue({
      state: { stage: 'idle' },
      run: mockRun,
      reset: vi.fn(),
    });

    vi.mocked(agentApi.hyperliquidWallets).mockResolvedValue([
      { address: '0xEXT', name: 'External Bot', valid_until: null },
    ]);
    vi.mocked(agentApi.list).mockResolvedValue([]);

    render(<ManageAgentsModal {...defaultProps} />);
    await waitFor(() => screen.getByText('External Bot'));

    fireEvent.click(screen.getByRole('button', { name: /revoke/i }));
    // Confirm dialog should appear — click confirm
    await waitFor(() => screen.getByRole('button', { name: /confirm/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(mockRun).toHaveBeenCalledWith({
      type: 'external',
      agentName: 'External Bot', // name, not address '0xEXT'
    });
  });
});

describe('ManageAgentsModal — rotate-wallet', () => {
  it('shows rotate button when an active DB agent exists', async () => {
    vi.mocked(agentApi.hyperliquidWallets).mockResolvedValue([
      { address: '0xA', name: 'Bot A', valid_until: null },
    ]);
    vi.mocked(agentApi.list).mockResolvedValue([
      {
        id: 1,
        agent_address: '0xA',
        label: 'Bot A',
        spending_limit_usd: null,
        spent_today_usd: 0,
        is_active: true,
        created_at: '2026-06-01T00:00:00Z',
        revoked_at: null,
      },
    ]);

    render(<ManageAgentsModal {...defaultProps} />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /cập nhật agent/i }),
      ).toBeInTheDocument(),
    );
  });

  it('calls botApi.rotateWallet and fires onRotateErrors when error_count > 0', async () => {
    vi.mocked(agentApi.hyperliquidWallets).mockResolvedValue([
      { address: '0xA', name: 'Bot A', valid_until: null },
    ]);
    vi.mocked(agentApi.list).mockResolvedValue([
      {
        id: 1,
        agent_address: '0xA',
        label: 'Bot A',
        spending_limit_usd: null,
        spent_today_usd: 0,
        is_active: true,
        created_at: '2026-06-01T00:00:00Z',
        revoked_at: null,
      },
    ]);
    vi.mocked(botApi.rotateWallet).mockResolvedValue({
      total_bots: 2,
      updated_count: 1,
      restarted_count: 0,
      error_count: 1,
      results: [
        {
          bot_id: 99,
          bot_name: 'Fail Bot',
          was_running: true,
          updated: false,
          restart_attempted: false,
          restarted: false,
          error: 'No config',
        },
      ],
      message: '1/2 updated',
    });

    render(<ManageAgentsModal {...defaultProps} />);
    await waitFor(() =>
      screen.getByRole('button', { name: /cập nhật agent/i }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /cập nhật agent/i }));
    });

    await waitFor(() => expect(botApi.rotateWallet).toHaveBeenCalled());
    expect(defaultProps.onRotateErrors).toHaveBeenCalledWith([
      expect.objectContaining({ bot_name: 'Fail Bot', error: 'No config' }),
    ]);
  });
});

// Placed last: this overrides the revoke-flow mock to a 'success' state which
// would leak into later tests (clearAllMocks does not clear mockReturnValue).
describe('ManageAgentsModal — C-1: revoke stage reset after success', () => {
  it('resets the revoke stage when handling a successful revoke (so a later confirm is not swallowed) and does not fire onboarding for a non-active agent', async () => {
    const reset = vi.fn();
    const { useAgentRevokeFlow } = await import('./useAgentRevokeFlow');
    // Stable object (same ref each call) so no render loop; stage stays 'success'.
    vi.mocked(useAgentRevokeFlow).mockReturnValue({
      state: { stage: 'success' },
      run: vi.fn(),
      reset,
    });
    // External (not in DB) → non-active, so onboarding must NOT be triggered.
    vi.mocked(agentApi.hyperliquidWallets).mockResolvedValue([
      { address: '0xEXT', name: 'External Bot', valid_until: null },
    ]);
    vi.mocked(agentApi.list).mockResolvedValue([]);
    const onRequestOnboarding = vi.fn();

    render(
      <ManageAgentsModal
        {...defaultProps}
        onRequestOnboarding={onRequestOnboarding}
      />,
    );
    await waitFor(() => screen.getByText('External Bot'));

    // Opening a row's confirm makes `confirm` truthy while stage is already
    // 'success' → the post-success effect fires. With the fix it calls
    // resetRevoke() (stage→idle); without it, the stage stays 'success' and a
    // later confirm would be swallowed + onboarding spuriously triggered.
    fireEvent.click(screen.getByRole('button', { name: /revoke/i }));

    await waitFor(() => expect(reset).toHaveBeenCalled());
    expect(onRequestOnboarding).not.toHaveBeenCalled();
  });
});
