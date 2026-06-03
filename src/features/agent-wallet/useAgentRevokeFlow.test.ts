import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAgentRevokeFlow } from './useAgentRevokeFlow';
import { agentApi } from './agent.api';
import { eip712Sign } from './agent-helpers';
import { detectCoin98 } from '@/features/wallet-auth/wallet.provider';
import { useWalletStore } from '@/features/wallet-auth/wallet.store';

vi.mock('./agent.api', () => ({
  agentApi: {
    revokePayload: vi.fn(),
    revoke: vi.fn(),
    externalRevokePayload: vi.fn(),
    externalRevoke: vi.fn(),
  },
}));
vi.mock('./agent-helpers', async () => {
  const actual =
    await vi.importActual<typeof import('./agent-helpers')>('./agent-helpers');
  return { ...actual, eip712Sign: vi.fn() };
});
vi.mock('@/features/wallet-auth/wallet.provider', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/wallet-auth/wallet.provider')
  >('@/features/wallet-auth/wallet.provider');
  return { ...actual, detectCoin98: vi.fn() };
});

beforeEach(() => {
  vi.clearAllMocks();
  useWalletStore.setState({
    address: '0xmaster',
    nonce: 'n',
    signature: 's',
    status: 'ready',
    user: null,
    error: null,
    signingMessage: null,
  });
  vi.mocked(detectCoin98).mockReturnValue({ request: vi.fn() } as never);
});

describe('useAgentRevokeFlow — app-managed branch', () => {
  it('runs happy-path: revokePayload → sign → revoke → success', async () => {
    vi.mocked(agentApi.revokePayload).mockResolvedValue({
      sign_payload: { message: { nonce: 77 } },
    });
    vi.mocked(eip712Sign).mockResolvedValue('0xrevsig');
    vi.mocked(agentApi.revoke).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAgentRevokeFlow());
    expect(result.current.state).toEqual({ stage: 'idle' });

    await act(async () => {
      await result.current.run({ type: 'app-managed', agentId: 42 });
    });

    expect(agentApi.revokePayload).toHaveBeenCalledWith(42);
    expect(eip712Sign).toHaveBeenCalledWith(expect.anything(), '0xmaster', {
      message: { nonce: 77 },
    });
    expect(agentApi.revoke).toHaveBeenCalledWith(42, {
      wallet_address: '0xmaster',
      nonce: 77,
      signature: '0xrevsig',
    });
    await waitFor(() => expect(result.current.state.stage).toBe('success'));
  });

  it('reports userRejected=true when user cancels EIP-712 sign', async () => {
    const { UserRejectedError } =
      await import('@/features/wallet-auth/wallet.provider');
    vi.mocked(agentApi.revokePayload).mockResolvedValue({
      sign_payload: { message: { nonce: 1 } },
    });
    vi.mocked(eip712Sign).mockRejectedValue(new UserRejectedError());

    const { result } = renderHook(() => useAgentRevokeFlow());
    await act(async () => {
      await result.current.run({ type: 'app-managed', agentId: 5 });
    });

    expect(result.current.state.stage).toBe('error');
    if (result.current.state.stage === 'error') {
      expect(result.current.state.userRejected).toBe(true);
    }
  });

  it('reports generic error when revoke API call fails', async () => {
    vi.mocked(agentApi.revokePayload).mockResolvedValue({
      sign_payload: { message: { nonce: 2 } },
    });
    vi.mocked(eip712Sign).mockResolvedValue('0xsig');
    vi.mocked(agentApi.revoke).mockRejectedValue(new Error('BE 500'));

    const { result } = renderHook(() => useAgentRevokeFlow());
    await act(async () => {
      await result.current.run({ type: 'app-managed', agentId: 5 });
    });

    expect(result.current.state.stage).toBe('error');
    if (result.current.state.stage === 'error') {
      expect(result.current.state.message).toBe('BE 500');
      expect(result.current.state.userRejected).toBe(false);
    }
  });
});

describe('useAgentRevokeFlow — external branch', () => {
  it('uses agent NAME (not address) in externalRevokePayload and externalRevoke', async () => {
    vi.mocked(agentApi.externalRevokePayload).mockResolvedValue({
      sign_payload: { message: { nonce: 55 } },
    });
    vi.mocked(eip712Sign).mockResolvedValue('0xextsig');
    vi.mocked(agentApi.externalRevoke).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAgentRevokeFlow());
    await act(async () => {
      await result.current.run({ type: 'external', agentName: 'Gamma Bot' });
    });

    // Must use agentName in the payload call
    expect(agentApi.externalRevokePayload).toHaveBeenCalledWith('Gamma Bot');
    // Must carry agentName into the submit body
    expect(agentApi.externalRevoke).toHaveBeenCalledWith({
      wallet_address: '0xmaster',
      agent_name: 'Gamma Bot',
      nonce: 55,
      signature: '0xextsig',
    });
    await waitFor(() => expect(result.current.state.stage).toBe('success'));
  });

  it('uses empty string name for unnamed external agents', async () => {
    vi.mocked(agentApi.externalRevokePayload).mockResolvedValue({
      sign_payload: { message: { nonce: 0 } },
    });
    vi.mocked(eip712Sign).mockResolvedValue('0xsig');
    vi.mocked(agentApi.externalRevoke).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAgentRevokeFlow());
    await act(async () => {
      await result.current.run({ type: 'external', agentName: '' });
    });

    expect(agentApi.externalRevokePayload).toHaveBeenCalledWith('');
    expect(agentApi.externalRevoke).toHaveBeenCalledWith(
      expect.objectContaining({ agent_name: '' }),
    );
  });
});

describe('useAgentRevokeFlow — guards', () => {
  it('errors immediately when wallet address is null', async () => {
    useWalletStore.setState({
      address: null,
      nonce: 'n',
      signature: 's',
      status: 'ready',
      user: null,
      error: null,
      signingMessage: null,
    });

    const { result } = renderHook(() => useAgentRevokeFlow());
    await act(async () => {
      await result.current.run({ type: 'app-managed', agentId: 1 });
    });

    expect(result.current.state.stage).toBe('error');
    expect(agentApi.revokePayload).not.toHaveBeenCalled();
  });

  it('errors immediately when no Coin98 provider', async () => {
    vi.mocked(detectCoin98).mockReturnValue(null);

    const { result } = renderHook(() => useAgentRevokeFlow());
    await act(async () => {
      await result.current.run({ type: 'app-managed', agentId: 1 });
    });

    expect(result.current.state.stage).toBe('error');
    expect(agentApi.revokePayload).not.toHaveBeenCalled();
  });

  it('reset() returns to idle', () => {
    const { result } = renderHook(() => useAgentRevokeFlow());
    act(() => result.current.reset());
    expect(result.current.state).toEqual({ stage: 'idle' });
  });
});
