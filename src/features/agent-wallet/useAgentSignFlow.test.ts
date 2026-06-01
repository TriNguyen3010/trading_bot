import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAgentSignFlow } from './useAgentSignFlow';
import { agentApi } from './agent.api';
import { eip712Sign } from './agent-helpers';
import { detectCoin98 } from '@/features/wallet-auth/wallet.provider';
import { useWalletStore } from '@/features/wallet-auth/wallet.store';

vi.mock('./agent.api', () => ({
  agentApi: { create: vi.fn(), confirm: vi.fn() },
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
    address: '0xuser',
    nonce: 'n',
    signature: 's',
    status: 'ready',
    user: null,
    error: null,
    signingMessage: null,
  });
});

describe('useAgentSignFlow', () => {
  it('runs full happy-path: create → sign → confirm → success', async () => {
    vi.mocked(agentApi.create).mockResolvedValue({
      agent_address: '0xagent',
      label: 'main',
      spending_limit_usd: 1000,
      sign_payload: { message: { nonce: 999 } },
    });
    vi.mocked(eip712Sign).mockResolvedValue('0xsig');
    vi.mocked(agentApi.confirm).mockResolvedValue({
      id: 1,
      agent_address: '0xagent',
      label: 'main',
      spending_limit_usd: 1000,
      is_active: true,
      spent_today_usd: 0,
      created_at: '2026-05-28T00:00:00Z',
    });
    vi.mocked(detectCoin98).mockReturnValue({ request: vi.fn() } as never);

    const { result } = renderHook(() => useAgentSignFlow());
    expect(result.current.state).toEqual({ stage: 'idle' });

    await act(async () => {
      await result.current.run({ label: 'main', spendingLimitUsd: 1000 });
    });

    expect(agentApi.create).toHaveBeenCalledWith({
      label: 'main',
      spending_limit_usd: 1000,
    });
    expect(eip712Sign).toHaveBeenCalledWith(expect.anything(), '0xuser', {
      message: { nonce: 999 },
    });
    expect(agentApi.confirm).toHaveBeenCalledWith({
      wallet_address: '0xuser',
      agent_address: '0xagent',
      signature: '0xsig',
      nonce: 999,
    });
    await waitFor(() => expect(result.current.state.stage).toBe('success'));
  });

  it('reports userRejected error when wallet sign throws UserRejectedError', async () => {
    const { UserRejectedError } =
      await import('@/features/wallet-auth/wallet.provider');
    vi.mocked(agentApi.create).mockResolvedValue({
      agent_address: '0xagent',
      label: null,
      spending_limit_usd: null,
      sign_payload: { message: { nonce: 1 } },
    });
    vi.mocked(eip712Sign).mockRejectedValue(new UserRejectedError());
    vi.mocked(detectCoin98).mockReturnValue({ request: vi.fn() } as never);

    const { result } = renderHook(() => useAgentSignFlow());
    await act(async () => {
      await result.current.run({});
    });
    expect(result.current.state.stage).toBe('error');
    if (result.current.state.stage === 'error') {
      expect(result.current.state.userRejected).toBe(true);
    }
  });

  it('reset() returns to idle', async () => {
    const { result } = renderHook(() => useAgentSignFlow());
    act(() => result.current.reset());
    expect(result.current.state).toEqual({ stage: 'idle' });
  });
});
